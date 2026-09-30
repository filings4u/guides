const KEY='s4u_guides_v1';
const $=s=>document.querySelector(s);
const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return[]}};
const write=v=>localStorage.setItem(KEY,JSON.stringify(v));
const id=()=>crypto.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function render(){
 const guides=read(),q=($('#search').value||'').toLowerCase(),portal=$('#portalFilter').value;
 const filtered=guides.filter(g=>(!q||[g.title,g.portal,g.audience].join(' ').toLowerCase().includes(q))&&(!portal||g.portal===portal));
 $('#guideCount').textContent=guides.length;$('#draftCount').textContent=guides.filter(g=>g.status!=='published').length;$('#publishedCount').textContent=guides.filter(g=>g.status==='published').length;
 const portals=[...new Set(guides.map(g=>g.portal).filter(Boolean))].sort(),current=portal;
 $('#portalFilter').innerHTML='<option value="">All portals</option>'+portals.map(p=>'<option '+(p===current?'selected':'')+' value="'+esc(p)+'">'+esc(p.replaceAll('-',' '))+'</option>').join('');
 $('#emptyLibrary').hidden=guides.length>0;
 $('#guideGrid').innerHTML=filtered.map(g=>`<article class="guide-card"><div class="guide-card-top"><span class="status ${g.status==='published'?'published':'draft'}">${esc(g.status||'draft')}</span><span class="portal-pill">${esc((g.portal||'portal').replaceAll('-',' '))}</span></div><h3>${esc(g.title||'Untitled Guide')}</h3><p>${esc(g.intro||'No description yet.')}</p><div class="guide-meta"><span>${g.steps?.length||0} steps</span><span>${esc(g.audience||'Customer')}</span></div><div class="card-actions"><a class="btn secondary" href="guide.html?id=${encodeURIComponent(g.id)}">View</a><a class="btn primary" href="editor.html?id=${encodeURIComponent(g.id)}">Edit</a></div></article>`).join('');
}
function openModal(){$('#modal').hidden=false;setTimeout(()=>$('#newTitle').focus(),0)}
function closeModal(){$('#modal').hidden=true;$('#newGuideForm').reset()}
function createGuide(e){e.preventDefault();const guides=read(),g={id:id(),title:$('#newTitle').value.trim(),portal:$('#newPortal').value,audience:$('#newAudience').value,status:'draft',intro:'',created_at:new Date().toISOString(),updated_at:new Date().toISOString(),steps:[]};guides.unshift(g);write(guides);location.href='editor.html?id='+encodeURIComponent(g.id)}
['#newGuide','#heroNewGuide','#emptyNewGuide'].forEach(s=>$(s).onclick=openModal);
$('#closeModal').onclick=$('#cancelModal').onclick=closeModal;$('#newGuideForm').onsubmit=createGuide;$('#search').oninput=render;$('#portalFilter').onchange=render;
$('#importFile').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{const data=JSON.parse(await f.text()),guides=read(),incoming=Array.isArray(data)?data:[data];for(const raw of incoming)guides.unshift({id:raw.id||id(),title:raw.title||'Imported Guide',portal:raw.portal||'ctpa-dot',audience:raw.audience||'Customer',status:raw.status||'draft',intro:raw.intro||'',created_at:raw.created_at||new Date().toISOString(),updated_at:new Date().toISOString(),steps:Array.isArray(raw.steps)?raw.steps:[]});write(guides);render()}catch{alert('That file is not a valid Guide Builder JSON file.')}finally{e.target.value=''}};
render();