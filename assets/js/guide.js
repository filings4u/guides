const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const q=new URLSearchParams(location.search),id=q.get('id');
async function load(){
 await S4UGuides.requireAuth();
 const r=await S4UGuides.api({action:'get_guide',id});
 const g=r.guide;
 document.title=(g.title||'Guide')+' | screenings4u';
 document.querySelector('#guideView').innerHTML=`<section class="guide-cover"><span class="eyebrow">SCREENINGS4U HOW-TO GUIDE</span><h1>${esc(g.title)}</h1><p>${esc(g.intro||'')}</p><div class="cover-meta"><span>${esc((g.portal_code||'portal').replaceAll('-',' '))}</span><span>${esc(g.audience||'Customer')}</span><span>${g.steps?.length||0} steps</span><span>Version ${Number(g.version||1)}</span></div></section>`+(g.steps||[]).map((s,i)=>`<article class="viewer-step"><div class="viewer-num">${i+1}</div><div><h2>${esc(s.title||'Step '+(i+1))}</h2><p>${esc(s.instruction||'')}</p>${s.screenshot_url?`<div class="shot-wrap"><img src="${s.screenshot_url}" alt="Step ${i+1}"><span class="click-marker" style="left:${Number(s.click_x??50)}%;top:${Number(s.click_y??50)}%">${i+1}</span></div>`:''}</div></article>`).join('');
 if(q.get('print')==='1')setTimeout(()=>window.print(),400);
}
document.querySelector('#print').onclick=()=>window.print();
load().catch(e=>{document.querySelector('#guideView').innerHTML='<section class="guide-cover"><h1>Guide unavailable</h1><p>'+esc(e.message||'Unable to load this guide.')+'</p></section>'});