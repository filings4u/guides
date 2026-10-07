const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const params=new URLSearchParams(location.search),guideId=params.get('id');
let guide=null,saveTimer=null,saving=false,portalRegistry=[];

function markerStyle(step){
 const x=Number(step.click_x??50),y=Number(step.click_y??50);
 return `left:${Math.max(0,Math.min(100,x))}%;top:${Math.max(0,Math.min(100,y))}%`;
}
function normalized(){
 return {
   ...guide,
   portal_code:$('#guidePortal').value.trim()||'nondot_employer',
   category:$('#guideCategory').value||'Support',
   title:$('#guideTitle').value.trim()||'Untitled Guide',
   audience:$('#guideAudience').value.trim()||'Customer',
   status:$('#guideStatus').value,
   intro:$('#guideIntro').value,
   steps:(guide.steps||[]).map((s,i)=>({...s,step_number:i+1}))
 };
}
async function save(createVersion=false){
 if(!guide||saving)return;
 saving=true;$('#saveState').textContent=createVersion?'Saving version…':'Saving…';
 try{
   const r=await S4UGuides.api({action:'save_guide',guide:normalized(),create_version:createVersion});
   guide=r.guide;
   $('#saveState').textContent=(createVersion?'Version '+guide.version+' saved':'Saved')+' · '+new Date().toLocaleTimeString([], {hour:'numeric',minute:'2-digit'});
 }finally{saving=false}
}
function scheduleSave(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>save(false).catch(e=>{$('#saveState').textContent=e.message}),700)}
function render(){
 if(!guide)return;
 $('#guideTitle').value=guide.title||'';
 $('#guidePortal').value=guide.portal_code||'nondot_employer';
 $('#guideCategory').value=guide.category||'Support';
 $('#guideAudience').value=guide.audience||'Customer';
 $('#guideStatus').value=guide.status||'draft';
 $('#guideIntro').value=guide.intro||'';
 $('#editorHeading').textContent=guide.title||'Untitled Guide';
 $('#steps').innerHTML=(guide.steps||[]).map((s,i)=>`<article class="step-card" data-i="${i}">
 <div class="step-handle">⋮⋮</div><div class="step-num">${i+1}</div><div class="step-content">
 <div class="step-toolbar"><input class="step-title" data-field="title" value="${esc(s.title||'Step '+(i+1))}"><button data-action="up" title="Move up">↑</button><button data-action="down" title="Move down">↓</button><button data-action="delete" class="danger-text" title="Delete">Delete</button></div>
 <textarea class="instruction" data-field="instruction" rows="3" placeholder="Describe what the user should do.">${esc(s.instruction||'')}</textarea>
 <div class="shot-wrap">${s.screenshot_url?`<img src="${s.screenshot_url}" alt="Step screenshot"><span class="click-marker" style="${markerStyle(s)}">${i+1}</span>`:'<div class="missing-shot">No screenshot for this step.</div>'}</div>
 <div class="step-footer"><span>${esc(s.page_title||s.page_url||'')}</span><label class="replace-shot">Replace screenshot<input type="file" accept="image/png,image/jpeg,image/webp" data-action="image" hidden></label></div>
 </div></article>`).join('');
}
async function load(){
 await S4UGuard.init();
 try{const r=await fetch(S4UGuidesConfig.supabaseUrl+'/functions/v1/guide-catalog-public',{method:'POST',headers:{'Content-Type':'application/json','apikey':S4UGuidesConfig.supabasePublishableKey},body:JSON.stringify({action:'portals'})});const j=await r.json();portalRegistry=j.portals||[];$('#guidePortal').innerHTML=portalRegistry.map(p=>`<option value="${esc(p.portal_code)}">${esc(p.name)} — ${esc(p.hostname||p.portal_code)}</option>`).join('')}catch{}
 if(!guideId){location.replace('./');return}
 const r=await S4UGuides.api({action:'get_guide',id:guideId});
 guide=r.guide;
 render();
}
['guideTitle','guidePortal','guideCategory','guideAudience','guideIntro'].forEach(k=>$('#'+k).addEventListener('input',e=>{if(k==='guideTitle')$('#editorHeading').textContent=e.target.value;scheduleSave()}));
$('#guideStatus').addEventListener('change',()=>save(true).catch(e=>S4UDialog.alert(e.message||'Could not save status.','Save failed')));
$('#steps').addEventListener('input',e=>{const card=e.target.closest('.step-card');if(!card||!guide)return;const i=+card.dataset.i,field=e.target.dataset.field;if(field){guide.steps[i][field]=e.target.value;scheduleSave()}});
$('#steps').addEventListener('click',e=>{const btn=e.target.closest('button');if(!btn||!guide)return;const card=btn.closest('.step-card'),i=+card.dataset.i,a=btn.dataset.action;if(a==='delete')guide.steps.splice(i,1);if(a==='up'&&i>0)[guide.steps[i-1],guide.steps[i]]=[guide.steps[i],guide.steps[i-1]];if(a==='down'&&i<guide.steps.length-1)[guide.steps[i+1],guide.steps[i]]=[guide.steps[i],guide.steps[i+1]];render();scheduleSave()});
$('#steps').addEventListener('change',e=>{if(e.target.dataset.action!=='image'||!guide)return;const card=e.target.closest('.step-card'),i=+card.dataset.i,f=e.target.files?.[0];if(!f)return;const reader=new FileReader();reader.onload=async()=>{try{const step=guide.steps[i],up=await S4UGuides.api({action:'upload_screenshot',guide_id:guide.id,step_id:step.id,data_url:reader.result});step.screenshot_path=up.path;step.screenshot_url=up.url;render();await save(false)}catch(err){S4UDialog.alert(err.message||'Could not replace screenshot.','Upload failed')}};reader.readAsDataURL(f)});
$('#addStep').onclick=()=>{if(!guide)return;guide.steps.push({id:crypto.randomUUID(),title:'Step '+(guide.steps.length+1),instruction:'',screenshot_path:null,screenshot_url:null,click_x:50,click_y:50,annotation_data:{},metadata:{}});render();scheduleSave()};
$('#saveVersion').onclick=()=>save(true).catch(e=>S4UDialog.alert(e.message||'Could not save version.','Save failed'));
$('#previewGuide').onclick=()=>window.open('guide.html?id='+encodeURIComponent(guide.id),'_blank');
$('#printGuide').onclick=()=>window.open('guide.html?id='+encodeURIComponent(guide.id)+'&print=1','_blank');
$('#exportJson').onclick=()=>{const exportGuide=normalized(),blob=new Blob([JSON.stringify(exportGuide,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=(guide.title||'guide').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')+'.json';a.click();URL.revokeObjectURL(a.href)};
$('#deleteGuide').onclick=async()=>{if(!await S4UDialog.confirm('Delete this guide? This cannot be undone.',{title:'Delete guide',confirmText:'Delete Guide',danger:true}))return;try{await S4UGuides.api({action:'delete_guide',id:guide.id});location.href='./'}catch(e){await S4UDialog.alert(e.message||'Could not delete guide.','Delete failed')}};
load().catch(async e=>{if(e.status!==401&&e.status!==403)await S4UDialog.alert(e.message||'Could not load guide.','Guide Editor');if(e.status===401)location.replace('login.html')});