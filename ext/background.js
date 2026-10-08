const SUPABASE_URL = "https://elpbnytpciqnbexiaebp.supabase.co";
const SUPABASE_KEY = "sb_publishable_xVI6Mjkk1bNVMGHZCPuK6w_8FSHKdkC";
const GUIDE_API = SUPABASE_URL + "/functions/v1/guide-builder";
const STATE_KEY = "s4u_guide_recorder_state_v4";
const AUTH_KEY = "s4u_guide_recorder_auth_v1";
let captureQueue = Promise.resolve();

async function getState(){const x=await chrome.storage.local.get(STATE_KEY);return x[STATE_KEY]||{recording:false,guide:null,steps:[],saving:false,last_error:null,target_tab_id:null}}
async function setState(s){await chrome.storage.local.set({[STATE_KEY]:s})}
async function getAuth(){const x=await chrome.storage.local.get(AUTH_KEY);return x[AUTH_KEY]||null}
async function setAuth(a){await chrome.storage.local.set({[AUTH_KEY]:a})}
async function clearAuth(){await chrome.storage.local.remove(AUTH_KEY)}
function expiresAt(r){return Date.now()+Math.max(60,Number(r.expires_in||3600)-60)*1000}
async function signIn(email,password){
  const r=await fetch(SUPABASE_URL+"/auth/v1/token?grant_type=password",{method:"POST",headers:{"Content-Type":"application/json",apikey:SUPABASE_KEY},body:JSON.stringify({email,password})});
  const j=await r.json().catch(()=>({})); if(!r.ok||!j.access_token)throw new Error(j.error_description||j.msg||j.error||"Unable to sign in.");
  const a={access_token:j.access_token,refresh_token:j.refresh_token,expires_at:expiresAt(j),user:j.user?{id:j.user.id,email:j.user.email}:null}; await setAuth(a); await guideApi({action:"status"},a.access_token); return a;
}
async function refreshAuth(a){
  if(!a?.refresh_token)throw new Error("Guide Recorder sign-in is required.");
  const r=await fetch(SUPABASE_URL+"/auth/v1/token?grant_type=refresh_token",{method:"POST",headers:{"Content-Type":"application/json",apikey:SUPABASE_KEY},body:JSON.stringify({refresh_token:a.refresh_token})});
  const j=await r.json().catch(()=>({})); if(!r.ok||!j.access_token){await clearAuth();throw new Error("Your Guide Recorder session expired. Sign in again.")}
  const n={access_token:j.access_token,refresh_token:j.refresh_token||a.refresh_token,expires_at:expiresAt(j),user:j.user?{id:j.user.id,email:j.user.email}:a.user};await setAuth(n);return n;
}
async function getToken(){let a=await getAuth();if(!a)throw new Error("Sign in to the screenings4u Guide Recorder first.");if(!a.expires_at||Date.now()>=a.expires_at)a=await refreshAuth(a);return a.access_token}
async function guideApi(payload,token=null){
  let jwt=token||await getToken(); const request=t=>fetch(GUIDE_API,{method:"POST",headers:{"Content-Type":"application/json",apikey:SUPABASE_KEY,Authorization:"Bearer "+t},body:JSON.stringify(payload)});
  let r=await request(jwt);if(r.status===401&&!token){const a=await refreshAuth(await getAuth());jwt=a.access_token;r=await request(jwt)}const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||"Guide Builder request failed.");return j;
}
function recordable(url){try{const u=new URL(url),h=u.hostname.toLowerCase();return u.protocol==="https:"&&(h==="screenings4u.com"||h.endsWith(".screenings4u.com"))&&h!=="guides.screenings4u.com"}catch{return false}}
async function findTarget(){const tabs=await chrome.tabs.query({currentWindow:true});const a=tabs.filter(t=>t.id&&t.url&&recordable(t.url)).sort((x,y)=>Number(y.lastAccessed||0)-Number(x.lastAccessed||0));if(!a.length)throw new Error("Open the screenings4u portal you want to record in another tab first.");return a[0]}
async function ensureContent(tab){tab=tab||await findTarget();try{const p=await chrome.tabs.sendMessage(tab.id,{type:"RECORDER_PING"});if(p?.ok)return tab}catch{}await chrome.scripting.executeScript({target:{tabId:tab.id},files:["content.js"]});const p=await chrome.tabs.sendMessage(tab.id,{type:"RECORDER_PING"});if(!p?.ok)throw new Error("The recorder could not attach to this portal page.");return tab}
async function pushState(tabId,on){if(!tabId)return;try{await chrome.tabs.sendMessage(tabId,{type:"RECORDER_STATE",recording:!!on})}catch{}}
function normalized(s,i){return{id:s.id,step_number:i+1,title:s.title||`Step ${i+1}`,instruction:s.instruction||"",page_url:s.url||null,page_title:s.page_title||null,clicked_element:s.element?.selector||s.element?.label||null,screenshot_path:s.screenshot_path||null,click_x:Number(s.click?.x_pct??0),click_y:Number(s.click?.y_pct??0),annotation_data:{},metadata:{element:s.element||{},captured_at:s.captured_at||null,capture_mode:"extension_click",marker_baked:true,sequence:i+1}}}
async function saveGuide(state){if(!state.guide)return;state.saving=true;await setState(state);try{const r=await guideApi({action:"save_guide",create_version:false,guide:{id:state.guide.id,title:state.guide.title,portal_code:state.guide.portal,audience:state.guide.audience||"Customer",intro:state.guide.intro||"",status:"draft",steps:(state.steps||[]).map(normalized)}});state.saving=false;state.last_error=null;state.guide={...state.guide,id:r.guide?.id||state.guide.id,version:r.guide?.version||state.guide.version};await setState(state)}catch(e){state.saving=false;state.last_error=e?.message||String(e);await setState(state);throw e}}
async function captureInteraction(message,sender){
  if(!sender.tab?.id)return{ok:false,ignored:true};
  const state=await getState(); if(!state.recording||!state.guide?.id)return{ok:false,ignored:true};
  const stepNumber=(state.steps?.length||0)+1, tabId=sender.tab.id, winId=sender.tab.windowId;
  const click=message.click||{},x=Number(click.x||0),y=Number(click.y||0);
  try{await chrome.tabs.sendMessage(tabId,{type:"SHOW_CAPTURE_MARKER",number:stepNumber,x,y});await new Promise(r=>setTimeout(r,20))}catch{}
  let shot;try{shot=await chrome.tabs.captureVisibleTab(winId,{format:"jpeg",quality:92})}finally{try{await chrome.tabs.sendMessage(tabId,{type:"HIDE_CAPTURE_MARKER"})}catch{}}
  const stepId=crypto.randomUUID();const up=await guideApi({action:"upload_screenshot",guide_id:state.guide.id,step_id:stepId,data_url:shot});
  const label=message.element?.label||"the highlighted control";
  state.steps.push({id:stepId,title:message.title||`Step ${stepNumber}`,instruction:message.instruction||`Select ${label}.`,url:message.url||sender.tab.url||"",page_title:message.page_title||sender.tab.title||"",element:message.element||{},click:message.click||{},screenshot_path:up.path,screenshot_url:up.url||null,captured_at:new Date().toISOString(),marker_baked:true});
  await setState(state);await saveGuide(state);return{ok:true,count:state.steps.length,step_number:stepNumber,guide_id:state.guide.id};
}
chrome.runtime.onInstalled.addListener(async()=>{const s=await getState();s.recording=false;s.saving=false;s.target_tab_id=null;await setState(s)});
chrome.runtime.onMessage.addListener((m,sender,respond)=>{(async()=>{
  if(m?.type==="RECORDER_PING_PAGE")return respond({ok:true,recording:(await getState()).recording});
  if(m?.type==="AUTH_STATUS"){const a=await getAuth();return respond({ok:true,signed_in:!!a,user:a?.user||null})}
  if(m?.type==="SIGN_IN"){const a=await signIn(String(m.email||"").trim(),String(m.password||""));return respond({ok:true,user:a.user})}
  if(m?.type==="SIGN_OUT"){await clearAuth();const s=await getState();s.recording=false;await setState(s);return respond({ok:true})}
  if(m?.type==="GET_STATE")return respond({ok:true,state:await getState()});
  if(m?.type==="AUTH_FROM_SITE"){const t=String(m.access_token||"").trim();if(!t)throw new Error("Guide Builder session is missing.");await guideApi({action:"status"},t);await setAuth({access_token:t,refresh_token:String(m.refresh_token||""),expires_at:Number(m.expires_at||0)>1e10?Number(m.expires_at):Number(m.expires_at||0)*1000,user:m.user||null});return respond({ok:true})}
  if(m?.type==="START_RECORDING"||m?.type==="START_RECORDING_FROM_SITE"){
    await getToken();const tab=await ensureContent();const g={id:crypto.randomUUID(),title:String(m.title||"New Guide"),portal:String(m.portal||"custom"),audience:String(m.audience||"Customer"),intro:"",created_at:new Date().toISOString()};
    const r=await guideApi({action:"save_guide",create_version:false,guide:{id:g.id,title:g.title,portal_code:g.portal,audience:g.audience,intro:"",status:"draft",steps:[]}});
    const st={recording:true,saving:false,last_error:null,guide:{...g,id:r.guide?.id||g.id,version:r.guide?.version||1},steps:[],target_tab_id:tab.id};await setState(st);await pushState(tab.id,true);await chrome.tabs.update(tab.id,{active:true});if(tab.windowId)try{await chrome.windows.update(tab.windowId,{focused:true})}catch{};return respond({ok:true,state:st,guide_id:st.guide.id})
  }
  if(m?.type==="STOP_RECORDING"){const st=await getState();st.recording=false;await setState(st);await pushState(st.target_tab_id,false);await saveGuide(st);return respond({ok:true,state:await getState(),guide_id:st.guide?.id||null})}
  if(m?.type==="CLEAR_RECORDING"){const p=await getState();await pushState(p.target_tab_id,false);const st={recording:false,guide:null,steps:[],saving:false,last_error:null,target_tab_id:null};await setState(st);return respond({ok:true,state:st})}
  if(m?.type==="RECORD_INTERACTION"){const task=captureQueue.then(()=>captureInteraction(m,sender));captureQueue=task.catch(()=>{});return respond(await task)}
  if(m?.type==="OPEN_GUIDE"){const st=await getState();if(!st.guide?.id)throw new Error("No guide is currently recorded.");await chrome.tabs.create({url:"https://guides.screenings4u.com/editor.html?id="+encodeURIComponent(st.guide.id)});return respond({ok:true})}
  return respond({ok:false,error:"Unknown recorder action."});
})().catch(e=>respond({ok:false,error:e?.message||String(e)}));return true});

chrome.tabs.onUpdated.addListener(async(tabId,changeInfo,tab)=>{
  if(changeInfo.status!=="complete"||!tab?.url||!recordable(tab.url))return;
  const st=await getState();
  if(!st.recording)return;
  try{await ensureContent(tab);await pushState(tabId,true);if(st.target_tab_id!==tabId){st.target_tab_id=tabId;await setState(st)}}catch(e){console.warn("Recorder attach after navigation failed",e)}
});
