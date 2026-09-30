window.S4UGuard=(()=>{
 const IDLE_MS=10*60*1000,WARN_MS=60*1000;
 let idleTimer=null,warnTimer=null,last=Date.now(),modal=null;
 function ensureModal(){
  if(modal)return modal;
  modal=document.createElement("div");
  modal.id="sessionWarning";
  modal.className="session-warning";
  modal.hidden=true;
  modal.innerHTML='<div class="session-warning-card"><span class="eyebrow">SESSION SECURITY</span><h2>You are about to be signed out</h2><p>For security, Guide Builder signs you out after 10 minutes of inactivity.</p><div class="session-warning-actions"><button id="staySignedIn" class="btn primary">Stay Signed In</button><button id="signOutNow" class="btn secondary">Sign Out</button></div></div>';
  document.body.appendChild(modal);
  modal.querySelector("#staySignedIn").onclick=()=>{touch();modal.hidden=true};
  modal.querySelector("#signOutNow").onclick=()=>S4UGuides.signOut();
  return modal;
 }
 function schedule(){
  clearTimeout(idleTimer);clearTimeout(warnTimer);
  const elapsed=Date.now()-last,remaining=IDLE_MS-elapsed;
  if(remaining<=0){S4UGuides.signOut();return}
  warnTimer=setTimeout(()=>{ensureModal().hidden=false},Math.max(0,remaining-WARN_MS));
  idleTimer=setTimeout(()=>S4UGuides.signOut(),remaining);
 }
 function touch(){last=Date.now();if(modal)modal.hidden=true;schedule()}
 async function init(){
  document.documentElement.classList.add("guard-pending");
  await S4UGuides.requireAuth();
  const status=await S4UGuides.api({action:"status"});
  if(!status?.member?.active)throw new Error("Guide Builder access is not active.");
  document.documentElement.classList.remove("guard-pending");
  ["click","keydown","mousemove","scroll","touchstart"].forEach(ev=>window.addEventListener(ev,touch,{passive:true}));
  document.addEventListener("visibilitychange",()=>{if(!document.hidden){last=Date.now();schedule()}});
  schedule();
  return status.member;
 }
 return {init,touch};
})();