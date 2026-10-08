const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const q=new URLSearchParams(location.search),id=q.get('id');
function safeReturnUrl(){
  const raw=q.get('return_to')||'';
  try{
    const u=new URL(raw);
    const h=u.hostname.toLowerCase();
    if(h==='screenings4u.com'||h.endsWith('.screenings4u.com')) return u.href;
  }catch{}
  return '';
}
const back=document.querySelector('#backPortal');
const returnUrl=safeReturnUrl();
function returnToPortal(){
  try{
    if(window.opener && !window.opener.closed){
      window.opener.focus();
      window.close();
      setTimeout(()=>{ if(!window.closed && returnUrl) location.href=returnUrl; },120);
      return;
    }
  }catch{}
  if(history.length>1){ history.back(); return; }
  if(returnUrl){ location.href=returnUrl; return; }
  location.href='https://screenings4u.com/';
}
if(back){
  back.href='#';
  back.textContent='← Back to Portal';
  back.addEventListener('click',e=>{e.preventDefault();returnToPortal();});
}
async function load(){
  const c=S4UGuidesConfig,r=await fetch(c.supabaseUrl+'/functions/v1/guide-catalog-public',{method:'POST',headers:{'Content-Type':'application/json','apikey':c.supabasePublishableKey},body:JSON.stringify({action:'get_guide',id})}),j=await r.json();
  if(!r.ok||j.error)throw new Error(j.error||'Guide unavailable.');
  const g=j.guide;
  document.title=(g.title||'Guide')+' | screenings4u';
  document.querySelector('#guideView').innerHTML=`<section class="guide-cover"><img class="guide-cover-logo" src="images/logo.png" alt="screenings4u"><span class="eyebrow">SCREENINGS4U HOW-TO GUIDE</span><h1>${esc(g.title)}</h1><p>${esc(g.intro||'')}</p><div class="cover-meta"><span>${esc(g.category||'How-To')}</span><span>${esc(g.audience||'Customer')}</span><span>${g.steps?.length||0} steps</span><span>Version ${Number(g.version||1)}</span></div></section>`+(g.steps||[]).map((s,i)=>`<article class="viewer-step"><div class="viewer-num">${i+1}</div><div><h2>${esc(s.title||'Step '+(i+1))}</h2><p>${esc(s.instruction||'')}</p>${s.screenshot_url?`<div class="shot-wrap"><img src="${s.screenshot_url}" alt="Step ${i+1}">${(s.metadata?.marker_baked===true||s.metadata?.capture_mode==='native_screen_share'||s.click_x==null||s.click_y==null)?'':`<span class="click-marker" style="left:${Number(s.click_x)}%;top:${Number(s.click_y)}%">${i+1}</span>`}</div>`:''}</div></article>`).join('');
  if(q.get('print')==='1')setTimeout(()=>window.print(),500);
}
document.querySelector('#print').onclick=()=>window.print();
load().catch(e=>{document.querySelector('#guideView').innerHTML='<section class="guide-cover"><h1>Guide unavailable</h1><p>'+esc(e.message||'Unable to load this guide.')+'</p></section>'});
