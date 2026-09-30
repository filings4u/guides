window.S4UTurnstile=(()=>{
 const SITE_KEY="0x4AAAAAADP2ITOhCvv9QbYf";
 let widgetId=null,token="";
 function load(){
   return new Promise((resolve,reject)=>{
     if(window.turnstile)return resolve(window.turnstile);
     const s=document.createElement("script");
     s.src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
     s.async=true;s.defer=true;
     s.onload=()=>resolve(window.turnstile);
     s.onerror=()=>reject(new Error("Security verification could not load."));
     document.head.appendChild(s);
   });
 }
 async function init(){
   const api=await load(),mount=document.querySelector("#turnstileMount");
   if(!mount)return;
   widgetId=api.render(mount,{sitekey:SITE_KEY,action:"guides_login",theme:"auto",callback:v=>token=v,"expired-callback":()=>token="","error-callback":()=>token=""});
 }
 function getToken(){return token}
 function reset(){token="";if(window.turnstile&&widgetId!==null)window.turnstile.reset(widgetId)}
 document.addEventListener("DOMContentLoaded",()=>init().catch(()=>{}));
 return {getToken,reset};
})();