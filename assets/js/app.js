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
$('#newGuideForm').onsubmit=e=>createGuide(e).catch(err=>alert(err.message));
$('#search').oninput=render;$('#portalFilter').onchange=render;
$('#signOut').onclick=async()=>{try{if(recorderConnected)await recorderCall('SIGN_OUT',{},1000)}catch{}await S4UGuides.signOut()};
$('#importFile').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{await importGuide(f)}catch(err){alert(err.message||'Could not import guide.')}finally{e.target.value=''}};
load().catch(err=>{if(err.status!==401)alert(err.message||'Could not load Guide Builder.')});
// ---- Browser workflow recorder bridge ----
let recorderConnected=false, recorderState=null, recorderPoll=null;

function recorderCall(type,payload={},timeout=1800){
 return new Promise((resolve,reject)=>{
  const id='s4u-rec-'+uid();
  const timer=setTimeout(()=>{window.removeEventListener('message',onMessage);reject(new Error('Recorder extension is not connected. Reload the screenings4u Guide Recorder extension, then refresh this page.'))},timeout);
  function onMessage(event){
   const d=event.data;
   if(event.source!==window||event.origin!==location.origin||d?.source!=='S4U_GUIDE_RECORDER'||d?.id!==id)return;
   clearTimeout(timer);window.removeEventListener('message',onMessage);resolve(d.response||{ok:false,error:'Recorder did not respond.'});
  }
  window.addEventListener('message',onMessage);
  window.postMessage({source:'S4U_GUIDE_BUILDER',id,type,payload},location.origin);
 });
}

async function connectRecorder(){
 const box=$('#recorderConnection'),detail=$('#recorderDetail');
 try{
  const session=await S4UGuides.session();
  if(!session)throw new Error('Guide Builder login is required.');
  const auth=await recorderCall('AUTH_FROM_SITE',{
   access_token:session.access_token,
   refresh_token:session.refresh_token||'',
   expires_at:session.expires_at||0,
   user:session.user?{id:session.user.id,email:session.user.email}:null
  },2500);
  if(!auth?.ok)throw new Error(auth?.error||'Recorder authentication failed.');
  recorderConnected=true;
  box.className='recorder-status connected';
  box.querySelector('strong').textContent='Recorder connected';
  detail.textContent='Ready to capture screenshots and workflow steps';
  await refreshRecorderState();
  return true;
 }catch(err){
  recorderConnected=false;
  box.className='recorder-status disconnected';
  box.querySelector('strong').textContent='Recorder not connected';
  detail.textContent=err.message||'Reload the browser recorder extension and refresh this page.';
  renderRecorderState(null);
  return false;
 }
}

function renderRecorderState(state){
 recorderState=state||null;
 const active=!!state?.recording;
 $('#recorderIdle').hidden=active;
 $('#recorderActive').hidden=!active;
 $('#recordingStepCount').textContent=String(state?.steps?.length||0);
 $('#recordingGuideTitle').textContent=state?.guide?.title||'Workflow guide';
 ['#startRecorder','#startRecorderTop','#heroRecord'].forEach(sel=>{const el=$(sel);if(el)el.disabled=!recorderConnected});
}

async function refreshRecorderState(){
 if(!recorderConnected)return;
 try{
  const r=await recorderCall('GET_STATE',{},1200);
  if(r?.ok)renderRecorderState(r.state);
 }catch{}
}

function openRecorderModal(){
 if(!recorderConnected){connectRecorder();return}
 $('#recorderModalMessage').hidden=true;
 $('#recorderModal').hidden=false;
 setTimeout(()=>$('#recordTitle').focus(),0);
}
function closeRecorderModal(){ $('#recorderModal').hidden=true;$('#recorderForm').reset();$('#recorderModalMessage').hidden=true }

async function beginRecording(e){
 e.preventDefault();
 const msg=$('#recorderModalMessage'),btn=$('#beginRecording');
 msg.hidden=true;btn.disabled=true;btn.textContent='Starting…';
 try{
  const response=await recorderCall('START_RECORDING_FROM_SITE',{
   title:$('#recordTitle').value.trim(),
   portal:$('#recordPortal').value,
   audience:$('#recordAudience').value
  },5000);
  if(!response?.ok)throw new Error(response?.error||'Could not start recording.');
  closeRecorderModal();
  renderRecorderState(response.state);
 }catch(err){msg.textContent=err.message||'Could not start recording.';msg.hidden=false}
 finally{btn.disabled=false;btn.textContent='Start Recording'}
}

async function finishRecording(){
 const btn=$('#finishRecorder');btn.disabled=true;btn.textContent='Finishing…';
 try{
  const r=await recorderCall('STOP_RECORDING',{},6000);
  if(!r?.ok)throw new Error(r?.error||'Could not finish recording.');
  renderRecorderState(r.state);
  const list=await S4UGuides.api({action:'list_guides'});guides=list.guides||[];render();
  if(r.guide_id)location.href='editor.html?id='+encodeURIComponent(r.guide_id);
 }catch(err){alert(err.message||'Could not finish recording.')}
 finally{btn.disabled=false;btn.textContent='Finish Recording'}
}

async function openRecordedGuide(){
 const id=recorderState?.guide?.id;
 if(id){location.href='editor.html?id='+encodeURIComponent(id);return}
 const r=await recorderCall('OPEN_GUIDE',{},2000);
 if(!r?.ok)alert(r?.error||'No recorded guide is available.');
}

['#startRecorder','#startRecorderTop','#heroRecord'].forEach(sel=>{const el=$(sel);if(el)el.onclick=openRecorderModal});
$('#closeRecorderModal').onclick=$('#cancelRecorderModal').onclick=closeRecorderModal;
$('#recorderForm').onsubmit=e=>beginRecording(e);
$('#finishRecorder').onclick=finishRecording;
$('#openRecordedGuide').onclick=openRecordedGuide;

connectRecorder().finally(()=>{
 recorderPoll=setInterval(()=>{ if(document.visibilityState==='visible')refreshRecorderState() },2000);
});
