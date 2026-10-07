window.S4UGuides=(()=>{
 const c=window.S4UGuidesConfig;
 const sb=window.supabase.createClient(c.supabaseUrl,c.supabasePublishableKey,{auth:{storageKey:"s4u-guides-auth-v1",persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
 const endpoint=c.supabaseUrl+"/functions/v1/guide-builder";
 async function session(){
  let {data,error}=await sb.auth.getSession();
  if(error)throw error;
  let s=data.session||null;
  if(s?.expires_at && (s.expires_at*1000-Date.now())<90000){
   const refreshed=await sb.auth.refreshSession();
   if(!refreshed.error && refreshed.data.session)s=refreshed.data.session;
  }
  return s;
 }
 async function requireAuth(){const s=await session();if(!s){location.replace("login.html?next="+encodeURIComponent(location.pathname.split("/").pop()+location.search));throw Object.assign(new Error("Authentication required"),{status:401})}return s}
 async function api(body){
  let s=await requireAuth();
  const request=token=>fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json","apikey":c.supabasePublishableKey,"Authorization":"Bearer "+token},body:JSON.stringify(body||{})});
  let r=await request(s.access_token);
  if(r.status===401){
   const refreshed=await sb.auth.refreshSession();
   if(refreshed.error||!refreshed.data.session){await sb.auth.signOut().catch(()=>{});throw Object.assign(new Error("Your Guide Builder session expired. Please sign in again."),{status:401})}
   s=refreshed.data.session;
   r=await request(s.access_token);
  }
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw Object.assign(new Error(j.error||"Guide Builder request failed."),{status:r.status,data:j});
  return j;
 }
 async function bootstrap(){return api({action:"bootstrap"})}
 async function signOut(){await sb.auth.signOut();location.replace("login.html")}
 return {sb,session,requireAuth,api,bootstrap,signOut};
})();
