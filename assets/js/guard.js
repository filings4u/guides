window.S4UGuard=(()=>{
 async function init(){
  document.documentElement.classList.add("guard-pending");
  try{
   await S4UGuides.requireAuth();
   const status=await S4UGuides.api({action:"status"});
   if(!status?.member?.active)throw Object.assign(new Error("Guide Builder access is not active."),{status:403});
   document.documentElement.classList.remove("guard-pending");
   return status.member;
  }catch(err){
   document.documentElement.classList.remove("guard-pending");
   if(err?.status===401){
    await S4UGuides.sb.auth.signOut().catch(()=>{});
    location.replace("login.html?reason=session");
   }else if(err?.status===403){
    location.replace("login.html?reason=access");
   }else{
    await S4UDialog.alert(err?.message||"Guide Builder could not load.","Guide Builder unavailable");
   }
   throw err;
  }
 }
 function touch(){ /* inactivity logout intentionally disabled for Guide Center */ }
 return {init,touch};
})();
