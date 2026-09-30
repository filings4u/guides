(async()=>{
 const m=document.querySelector("#authMessage"),f=document.querySelector("#loginForm");
 const show=(x,bad=true)=>{m.hidden=false;m.textContent=x;m.className="auth-message "+(bad?"bad":"good")};
 const s=await S4UGuides.session();if(s){try{await S4UGuides.bootstrap();location.replace("./");return}catch{}}
 f.onsubmit=async e=>{
   e.preventDefault();m.hidden=true;
   const turnstileToken=window.S4UTurnstile?.getToken?.()||"";
   if(!turnstileToken){show("Complete the security verification before signing in.");return}
   try{
     const sec=await fetch(S4UGuidesConfig.supabaseUrl+"/functions/v1/guide-login-security",{method:"POST",headers:{"Content-Type":"application/json","apikey":S4UGuidesConfig.supabasePublishableKey},body:JSON.stringify({turnstile_token:turnstileToken})});
     const sj=await sec.json().catch(()=>({}));
     if(!sec.ok)throw new Error(sj.error||"Security verification failed.");
   }catch(err){window.S4UTurnstile?.reset?.();show(err.message||"Security verification failed.");return}
   const email=document.querySelector("#email").value.trim(),password=document.querySelector("#password").value;
   const {data,error}=await S4UGuides.sb.auth.signInWithPassword({email,password});
   if(error||!data.session){window.S4UTurnstile?.reset?.();show(error?.message||"Unable to sign in.");return}
   try{await S4UGuides.bootstrap()}catch(err){await S4UGuides.sb.auth.signOut();window.S4UTurnstile?.reset?.();show(err.message||"Guide Builder access is not authorized.");return}
   location.replace("./");
 };
})();