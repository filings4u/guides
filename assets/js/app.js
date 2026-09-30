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
$('#signOut').onclick=()=>S4UGuides.signOut();
$('#importFile').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{await importGuide(f)}catch(err){alert(err.message||'Could not import guide.')}finally{e.target.value=''}};
load().catch(err=>{if(err.status!==401)alert(err.message||'Could not load Guide Builder.')});