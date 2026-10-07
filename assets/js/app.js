const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const uid=()=>crypto.randomUUID();
let guides=[],member=null;

function normalizeStep(s,i){
 const vp=s.click?.viewport||{};
 const px=s.click?.x_pct??s.click?.xPercent??(vp.width?Number(s.click?.x||50)/Number(vp.width)*100:50);
 const py=s.click?.y_pct??s.click?.yPercent??(vp.height?Number(s.click?.y||50)/Number(vp.height)*100:50);
 return {
   id:s.id||uid(),
   step_number:i+1,
   title:s.title||`Step ${i+1}`,
   instruction:s.instruction||'',
   page_url:s.page_url||s.url||null,
   page_title:s.page_title||null,
   clicked_element:s.clicked_element||s.element?.selector||s.element?.label||null,
   screenshot_path:s.screenshot_path||null,
   screenshot:s.screenshot||null,
   click_x:Math.max(0,Math.min(100,Number(px)||50)),
   click_y:Math.max(0,Math.min(100,Number(py)||50)),
   annotation_data:s.annotation_data||{},
   metadata:{...(s.metadata||{}),element:s.element||undefined}
 };
}

function render(){
 const q=($('#search').value||'').toLowerCase(),portal=$('#portalFilter').value;
 const filtered=guides.filter(g=>(!q||[g.title,g.portal_code,g.audience].join(' ').toLowerCase().includes(q))&&(!portal||g.portal_code===portal));
 $('#guideCount').textContent=guides.length;
 $('#draftCount').textContent=guides.filter(g=>g.status!=='published').length;
 $('#publishedCount').textContent=guides.filter(g=>g.status==='published').length;
 const portals=[...new Set(guides.map(g=>g.portal_code).filter(Boolean))].sort(),current=portal;
 $('#portalFilter').innerHTML='<option value="">All portals</option>'+portals.map(p=>'<option '+(p===current?'selected':'')+' value="'+esc(p)+'">'+esc(p.replaceAll('-',' '))+'</option>').join('');
 $('#emptyLibrary').hidden=guides.length>0;
 $('#guideGrid').innerHTML=filtered.map(g=>`<article class="guide-card">
   <div class="guide-card-top"><span class="status ${g.status==='published'?'published':'draft'}">${esc(g.status||'draft')}</span><span class="portal-pill">${esc((g.portal_code||'portal').replaceAll('-',' '))}</span></div>
   <h3>${esc(g.title||'Untitled Guide')}</h3>
   <p>${esc(g.intro||'No description yet.')}</p>
   <div class="guide-meta"><span>${g.steps?.length||0} steps</span><span>${esc(g.audience||'Customer')}</span><span>v${Number(g.version||1)}</span></div>
   <div class="card-actions"><a class="btn secondary" href="guide.html?id=${encodeURIComponent(g.id)}">View</a><a class="btn primary" href="editor.html?id=${encodeURIComponent(g.id)}">Edit</a></div>
 </article>`).join('');
}

async function load(){
 member=await S4UGuard.init();
 if(member?.role==='admin')$('#membersLink').hidden=false;
 const r=await S4UGuides.api({action:'list_guides'});
 guides=r.guides||[];
 render();
}

function openModal(){$('#modal').hidden=false;setTimeout(()=>$('#newTitle').focus(),0)}
function closeModal(){$('#modal').hidden=true;$('#newGuideForm').reset()}

async function createGuide(e){
 e.preventDefault();
 const guide={id:uid(),title:$('#newTitle').value.trim(),portal_code:$('#newPortal').value,audience:$('#newAudience').value,status:'draft',intro:'',steps:[]};
 const r=await S4UGuides.api({action:'save_guide',guide});
 location.href='editor.html?id='+encodeURIComponent(r.guide.id);
}

async function importGuide(file){
 const raw=JSON.parse(await file.text());
 const source=Array.isArray(raw)?raw:[raw];
 for(const item of source){
   const guide={id:uid(),title:item.title||'Imported Guide',portal_code:item.portal_code||item.portal||'ctpa-dot',audience:item.audience||'Customer',status:'draft',intro:item.intro||'',steps:(item.steps||[]).map(normalizeStep)};
   for(const step of guide.steps){
     if(step.screenshot&&step.screenshot.startsWith('data:image/')){
       const up=await S4UGuides.api({action:'upload_screenshot',guide_id:guide.id,step_id:step.id,data_url:step.screenshot});
       step.screenshot_path=up.path;
       delete step.screenshot;
     }
   }
   await S4UGuides.api({action:'save_guide',guide});
 }
 const r=await S4UGuides.api({action:'list_guides'});guides=r.guides||[];render();
}

['#newGuide','#heroNewGuide','#emptyNewGuide'].forEach(s=>$(s).onclick=openModal);
$('#closeModal').onclick=$('#cancelModal').onclick=closeModal;
$('#newGuideForm').onsubmit=e=>createGuide(e).catch(err=>S4UDialog.alert(err.message||'Could not create guide.','Create guide'));
$('#search').oninput=render;$('#portalFilter').onchange=render;
$('#signOut').onclick=async()=>{if(captureStream){for(const t of captureStream.getTracks())t.stop()}await S4UGuides.signOut()};
$('#importFile').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{await importGuide(f)}catch(err){await S4UDialog.alert(err.message||'Could not import guide.','Import failed')}finally{e.target.value=''}};
load().catch(async err=>{if(err.status!==401&&err.status!==403)await S4UDialog.alert(err.message||'Could not load Guide Builder.','Guide Builder')});
// ---- Recorder extension bridge (preferred) ----
let extensionReady=false,extensionMode=false,extensionPoll=null;
const bridgePending=new Map();
window.addEventListener('message',event=>{
 if(event.source!==window||event.origin!==location.origin)return;
 if(event.data?.source==='S4U_GUIDE_RECORDER_READY'){
  extensionReady=true;
  setRecorderReady('Click-perfect recorder extension connected');
 }
 if(event.data?.source==='S4U_GUIDE_RECORDER'&&event.data?.id){
  const p=bridgePending.get(event.data.id);if(p){bridgePending.delete(event.data.id);p.resolve(event.data.response)}
 }
});
function recorderBridge(type,payload={},timeout=5000){
 const id=uid();
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{bridgePending.delete(id);reject(new Error('Recorder extension did not respond.'))},timeout);
  bridgePending.set(id,{resolve:r=>{clearTimeout(timer);resolve(r)}});
  window.postMessage({source:'S4U_GUIDE_BUILDER',id,type,payload},location.origin);
 });
}
async function syncExtensionAuth(){
 const s=await S4UGuides.requireAuth();
 return recorderBridge('AUTH_FROM_SITE',{access_token:s.access_token,refresh_token:s.refresh_token,expires_at:s.expires_at,user:{id:s.user?.id,email:s.user?.email}},7000);
}
async function pollExtensionState(){
 try{
  const r=await recorderBridge('GET_STATE',{},3000),state=r?.state||null;
  if(state){renderRecorderState(state);if(!state.recording&&extensionMode){clearInterval(extensionPoll);extensionPoll=null}}
 }catch{}
}

// ---- Native browser workflow recorder ----
let recorderState=null;
let captureStream=null;
let captureVideo=null;
let captureTimer=null;
let captureBusy=false;
let lastThumb=null;
let recordedFrames=[];
let activeGuide=null;

function setRecorderReady(message='Ready to share a tab, window, or screen'){
 const box=$('#recorderConnection'),detail=$('#recorderDetail');
 box.className='recorder-status connected';
 box.querySelector('strong').textContent='Browser recorder ready';
 detail.textContent=message;
 ['#startRecorder','#startRecorderTop','#heroRecord'].forEach(sel=>{const el=$(sel);if(el)el.disabled=false});
}

function renderRecorderState(state){
 recorderState=state||null;
 const active=!!state?.recording;
 $('#recorderIdle').hidden=active;
 $('#recorderActive').hidden=!active;
 $('#recordingStepCount').textContent=String(state?.steps?.length||0);
 $('#recordingGuideTitle').textContent=state?.guide?.title||'Workflow guide';
}

function openRecorderModal(){
 $('#recorderModalMessage').hidden=true;
 $('#recorderModal').hidden=false;
 setTimeout(()=>$('#recordTitle').focus(),0);
}
function closeRecorderModal(){ $('#recorderModal').hidden=true;$('#recorderForm').reset();$('#recorderModalMessage').hidden=true }

function canvasData(video,maxWidth=1440,quality=.82){
 const sw=video.videoWidth,sh=video.videoHeight;
 if(!sw||!sh)return null;
 const scale=Math.min(1,maxWidth/sw),w=Math.max(1,Math.round(sw*scale)),h=Math.max(1,Math.round(sh*scale));
 const c=document.createElement('canvas');c.width=w;c.height=h;
 c.getContext('2d',{alpha:false}).drawImage(video,0,0,w,h);
 return c.toDataURL('image/jpeg',quality);
}

function thumbFingerprint(video){
 const c=document.createElement('canvas');c.width=32;c.height=18;
 const ctx=c.getContext('2d',{willReadFrequently:true,alpha:false});ctx.drawImage(video,0,0,32,18);
 const d=ctx.getImageData(0,0,32,18).data;
 let out=[];for(let i=0;i<d.length;i+=16)out.push((d[i]+d[i+1]+d[i+2])>>5);
 return out;
}
function thumbDifference(a,b){
 if(!a||!b||a.length!==b.length)return 1;
 let total=0;for(let i=0;i<a.length;i++)total+=Math.abs(a[i]-b[i]);
 return total/(a.length*24);
}

async function captureChangedFrame(force=false){
 if(captureBusy||!captureVideo||captureVideo.readyState<2||recordedFrames.length>=250)return;
 captureBusy=true;
 try{
  const thumb=thumbFingerprint(captureVideo);
  const diff=thumbDifference(lastThumb,thumb);
  if(force||!lastThumb||diff>.025){
   const dataUrl=canvasData(captureVideo);
   if(dataUrl){
    recordedFrames.push({id:uid(),screenshot:dataUrl,captured_at:new Date().toISOString()});
    lastThumb=thumb;
    renderRecorderState({recording:true,guide:activeGuide,steps:recordedFrames});
   }
  }
 }finally{captureBusy=false}
}

async function nativeBeginRecording(e){
 e.preventDefault();
 const msg=$('#recorderModalMessage'),btn=$('#beginRecording');
 msg.hidden=true;btn.disabled=true;btn.textContent='Choose screen…';
 try{
  if(!navigator.mediaDevices?.getDisplayMedia)throw new Error('Screen capture is not supported in this browser. Use current Chrome or Edge over HTTPS.');
  captureStream=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:{ideal:10,max:15}},audio:false});
  captureVideo=document.createElement('video');captureVideo.muted=true;captureVideo.playsInline=true;captureVideo.srcObject=captureStream;
  await captureVideo.play();
  activeGuide={id:uid(),title:$('#recordTitle').value.trim()||'Recorded Workflow',portal_code:$('#recordPortal').value,audience:$('#recordAudience').value,status:'draft',intro:'',steps:[]};
  recordedFrames=[];lastThumb=null;
  closeRecorderModal();
  renderRecorderState({recording:true,guide:activeGuide,steps:recordedFrames});
  setRecorderReady('Fallback screen-share recorder active. For click-perfect capture, use the screenings4u Guide Recorder extension.');
  await captureChangedFrame(true);
  captureTimer=setInterval(()=>captureChangedFrame(false),450);
  const track=captureStream.getVideoTracks()[0];
  track.addEventListener('ended',()=>{ if(recorderState?.recording) finishRecording(false).catch(err=>S4UDialog.alert(err.message||'Could not finish recording.','Recording error')); },{once:true});
 }catch(err){
  if(err?.name==='NotAllowedError') msg.textContent='Screen sharing was cancelled. Click Start Recording and choose the tab/window you want to capture.';
  else msg.textContent=err.message||'Could not start screen recording.';
  msg.hidden=false;
 }finally{btn.disabled=false;btn.textContent='Start Recording'}
}


async function beginRecording(e){
 e.preventDefault();
 const msg=$('#recorderModalMessage'),btn=$('#beginRecording');msg.hidden=true;btn.disabled=true;btn.textContent='Starting…';
 try{
  if(extensionReady){
   const auth=await syncExtensionAuth();if(!auth?.ok)throw new Error(auth?.error||'Recorder extension authentication failed.');
   const r=await recorderBridge('START_RECORDING_FROM_SITE',{title:$('#recordTitle').value.trim()||'Recorded Workflow',portal:$('#recordPortal').value,audience:$('#recordAudience').value},10000);
   if(!r?.ok)throw new Error(r?.error||'Could not start the recorder extension.');
   extensionMode=true;closeRecorderModal();renderRecorderState(r.state);setRecorderReady('Recording actual portal clicks with the screenings4u Guide Recorder');
   if(extensionPoll)clearInterval(extensionPoll);extensionPoll=setInterval(pollExtensionState,700);await pollExtensionState();return;
  }
  await nativeBeginRecording(e);
 }catch(err){msg.textContent=err?.message||'Could not start recording.';msg.hidden=false}
 finally{btn.disabled=false;btn.textContent='Start Recording'}
}

async function finishRecording(redirect=true){
 if(extensionMode){
  const btn=$('#finishRecorder');if(btn){btn.disabled=true;btn.textContent='Saving…'}
  try{const r=await recorderBridge('STOP_RECORDING',{},15000);if(!r?.ok)throw new Error(r?.error||'Could not finish recording.');extensionMode=false;if(extensionPoll){clearInterval(extensionPoll);extensionPoll=null}renderRecorderState(r.state);const id=r.guide_id||r.state?.guide?.id;if(redirect&&id)location.href='editor.html?id='+encodeURIComponent(id);return}finally{if(btn){btn.disabled=false;btn.textContent='Finish Recording'}}
 }
 if(!activeGuide)return;
 const btn=$('#finishRecorder');if(btn){btn.disabled=true;btn.textContent='Saving…'}
 try{
  if(captureTimer){clearInterval(captureTimer);captureTimer=null}
  await captureChangedFrame(true);
  if(captureStream){for(const t of captureStream.getTracks())if(t.readyState==='live')t.stop()}
  const steps=[];
  for(let i=0;i<recordedFrames.length;i++){
   const f=recordedFrames[i];
   const up=await S4UGuides.api({action:'upload_screenshot',guide_id:activeGuide.id,step_id:f.id,data_url:f.screenshot});
   steps.push({id:f.id,step_number:i+1,title:`Step ${i+1}`,instruction:'Describe what happens in this step.',page_url:null,page_title:null,clicked_element:null,screenshot_path:up.path,click_x:50,click_y:50,annotation_data:{},metadata:{capture_mode:'native_screen_share',captured_at:f.captured_at}});
  }
  activeGuide.steps=steps;
  const r=await S4UGuides.api({action:'save_guide',guide:activeGuide});
  const savedId=r.guide.id;
  recorderState={recording:false,guide:r.guide,steps:r.guide.steps||steps};
  renderRecorderState(recorderState);
  captureStream=null;captureVideo=null;activeGuide=null;recordedFrames=[];lastThumb=null;
  const list=await S4UGuides.api({action:'list_guides'});guides=list.guides||[];render();
  if(redirect)location.href='editor.html?id='+encodeURIComponent(savedId);
 }finally{if(btn){btn.disabled=false;btn.textContent='Finish Recording'}}
}

function openRecordedGuide(){
 const id=recorderState?.guide?.id;
 if(id)location.href='editor.html?id='+encodeURIComponent(id);
}

['#startRecorder','#startRecorderTop','#heroRecord'].forEach(sel=>{const el=$(sel);if(el)el.onclick=openRecorderModal});
$('#closeRecorderModal').onclick=$('#cancelRecorderModal').onclick=closeRecorderModal;
$('#recorderForm').onsubmit=e=>beginRecording(e);
$('#finishRecorder').onclick=()=>finishRecording(true).catch(err=>S4UDialog.alert(err.message||'Could not finish recording.','Recording error'));
$('#openRecordedGuide').onclick=openRecordedGuide;
setRecorderReady();
renderRecorderState(null);
