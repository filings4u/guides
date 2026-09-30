window.S4UGuides=(()=>{
 const c=window.S4UGuidesConfig;
 const sb=window.supabase.createClient(c.supabaseUrl,c.supabasePublishableKey,{auth:{storageKey:"s4u-guides-auth-v1",persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
 const endpoint=c.supabaseUrl+"/functions/v1/guide-builder";
 async function session(){const {data,error}=await sb.auth.getSession();if(error)throw error;return data.session||null}
 async function requireAuth(){const s=await session();if(!s){location.replace("login.html?next="+encodeURIComponent(location.pathname.split("/").pop()+location.search));throw new Error("Authentication required")}return s}
 async function api(body){const s=await requireAuth();const r=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json","apikey":c.supabasePublishableKey,"Authorization":"Bearer "+s.access_token},body:JSON.stringify(body||{})});const j=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(new Error(j.error||"Guide Builder request failed."),{status:r.status,data:j});return j}
 async function bootstrap(){return api({action:"bootstrap"})}
 async function signOut(){await sb.auth.signOut();location.replace("login.html")}
 return {sb,session,requireAuth,api,bootstrap,signOut};
})();