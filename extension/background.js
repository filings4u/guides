const STATE_KEY="s4u_guide_recorder_state_v1";

async function getState(){
  const data=await chrome.storage.local.get(STATE_KEY);
  return data[STATE_KEY]||{recording:false,guide:null,steps:[]};
}
async function setState(state){await chrome.storage.local.set({[STATE_KEY]:state})}

chrome.runtime.onInstalled.addListener(()=>setState({recording:false,guide:null,steps:[]}));

chrome.runtime.onMessage.addListener((msg,sender,sendResponse)=>{
  (async()=>{
    if(msg?.type==="GET_STATE"){sendResponse({ok:true,state:await getState()});return}
    if(msg?.type==="START_RECORDING"){
      const state={recording:true,guide:{id:crypto.randomUUID(),title:String(msg.title||"New Guide"),portal:String(msg.portal||"ctpa-dot"),audience:String(msg.audience||"Customer"),created_at:new Date().toISOString()},steps:[]};
      await setState(state);sendResponse({ok:true,state});return;
    }
    if(msg?.type==="STOP_RECORDING"){
      const state=await getState();state.recording=false;await setState(state);sendResponse({ok:true,state});return;
    }
    if(msg?.type==="CLEAR_RECORDING"){
      const state={recording:false,guide:null,steps:[]};await setState(state);sendResponse({ok:true,state});return;
    }
    if(msg?.type==="RECORD_CLICK"){
      const state=await getState();
      if(!state.recording||!sender.tab?.id){sendResponse({ok:false,ignored:true});return}
      let screenshot=null;
      try{
        screenshot=await chrome.tabs.captureVisibleTab(sender.tab.windowId,{format:"png"});
      }catch(error){
        const stateNow=await getState();
        stateNow.last_error="Screenshot capture failed: "+(error?.message||String(error));
        await setState(stateNow);
        sendResponse({ok:false,error:stateNow.last_error});
        return;
      }
      const step={
        id:crypto.randomUUID(),
        title:msg.title||("Step "+(state.steps.length+1)),
        instruction:msg.instruction||"",
        url:sender.tab.url||msg.url||"",
        page_title:sender.tab.title||msg.page_title||"",
        element:msg.element||{},
        click:msg.click||{x_pct:50,y_pct:50},
        screenshot,
        captured_at:new Date().toISOString()
      };
      state.steps.push(step);
      await setState(state);
      sendResponse({ok:true,count:state.steps.length});
      return;
    }
    sendResponse({ok:false,error:"Unknown recorder action."});
  })().catch(error=>sendResponse({ok:false,error:error?.message||String(error)}));
  return true;
});