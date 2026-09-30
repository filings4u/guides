const GUIDE_KEY='s4u_guide', REC_KEY='s4u_recording';
const uid=()=>crypto.randomUUID();
async function getGuide(){return (await chrome.storage.local.get(GUIDE_KEY))[GUIDE_KEY]||null}
async function saveGuide(g){await chrome.storage.local.set({[GUIDE_KEY]:g});}
chrome.runtime.onMessage.addListener((msg,sender,sendResponse)=>{(async()=>{
  if(msg.type==='START_RECORDING'){
    const guide={id:uid(),title:msg.title,portal:msg.portal,status:'draft',created_at:new Date().toISOString(),updated_at:new Date().toISOString(),steps:[]};
    await chrome.storage.local.set({[REC_KEY]:true,[GUIDE_KEY]:guide});
    if(msg.tabId) try{await chrome.tabs.sendMessage(msg.tabId,{type:'RECORDER_STATE',recording:true})}catch{}
    sendResponse({ok:true});return;
  }
  if(msg.type==='STOP_RECORDING'){await chrome.storage.local.set({[REC_KEY]:false});sendResponse({ok:true});return;}
  if(msg.type==='CAPTURE_STEP'){
    const rec=(await chrome.storage.local.get(REC_KEY))[REC_KEY];if(!rec){sendResponse({ok:false});return;}
    let screenshot='';try{screenshot=await chrome.tabs.captureVisibleTab(sender.tab.windowId,{format:'png'});}catch(e){console.warn(e)}
    const g=await getGuide();if(!g){sendResponse({ok:false});return;}
    const n=g.steps.length+1, label=msg.element?.label||msg.element?.text||msg.element?.tag||'the highlighted control';
    g.steps.push({id:uid(),number:n,title:`Step ${n}`,instruction:`Select ${label}.`,url:msg.url,page_title:msg.pageTitle,element:msg.element,click:msg.click,screenshot,created_at:new Date().toISOString()});
    g.updated_at=new Date().toISOString();await saveGuide(g);sendResponse({ok:true,count:g.steps.length});return;
  }
  if(msg.type==='GET_GUIDE'){sendResponse({ok:true,guide:await getGuide()});return;}
  if(msg.type==='SAVE_GUIDE'){await saveGuide(msg.guide);sendResponse({ok:true});return;}
})().catch(e=>sendResponse({ok:false,error:String(e)}));return true;});
