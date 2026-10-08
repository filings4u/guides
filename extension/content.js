(() => {
  if (globalThis.__S4U_GUIDE_RECORDER_LOADED__) return;
  globalThis.__S4U_GUIDE_RECORDER_LOADED__ = true;

  const isGuideBuilder = location.hostname.toLowerCase() === "guides.screenings4u.com";
  let recorderActive = false;
  let lastSignature = "";
  let lastAt = 0;

  if (isGuideBuilder) {
    window.addEventListener("message", async event => {
      if (event.source !== window || event.origin !== location.origin) return;
      const msg = event.data;
      if (!msg || msg.source !== "S4U_GUIDE_BUILDER" || !msg.id) return;
      const allowed = new Set(["AUTH_FROM_SITE","AUTH_STATUS","GET_STATE","START_RECORDING_FROM_SITE","STOP_RECORDING","OPEN_GUIDE","CLEAR_RECORDING"]);
      if (!allowed.has(msg.type)) return;
      let response;
      try { response = await chrome.runtime.sendMessage({ type: msg.type, ...(msg.payload || {}) }); }
      catch (error) { response = { ok:false, error:error?.message || String(error) }; }
      window.postMessage({ source:"S4U_GUIDE_RECORDER", id:msg.id, response }, location.origin);
    });
    window.postMessage({ source:"S4U_GUIDE_RECORDER_READY" }, location.origin);
    return;
  }

  const SENSITIVE_SELECTOR = [
    'input[type="password"]','input[name*="ssn" i]','input[id*="ssn" i]','input[name*="social" i]','input[id*="social" i]',
    'input[name*="dob" i]','input[id*="dob" i]','input[name*="birth" i]','input[id*="birth" i]','input[name*="card" i]','input[id*="card" i]',
    'input[name*="account" i]','input[id*="account" i]','input[name*="routing" i]','input[id*="routing" i]','input[name*="license" i]','input[id*="license" i]',
    'input[name*="cdl" i]','input[id*="cdl" i]','[data-s4u-sensitive="true"]'
  ].join(",");
  const INTERACTIVE_SELECTOR = ["button","a[href]","input","select","textarea","label","summary","[role='button']","[role='link']","[role='menuitem']","[role='tab']","[role='checkbox']","[role='radio']","[tabindex]"].join(",");

  function labelFor(element) {
    const aria=element.getAttribute?.("aria-label"); if(aria?.trim()) return aria.trim();
    const labelledBy=element.getAttribute?.("aria-labelledby"); if(labelledBy){const label=document.getElementById(labelledBy);if(label?.textContent?.trim())return label.textContent.trim().replace(/\s+/g," ").slice(0,140)}
    if(element.id){const label=document.querySelector('label[for="'+CSS.escape(element.id)+'"]');if(label?.textContent?.trim())return label.textContent.trim().replace(/\s+/g," ").slice(0,140)}
    const text=element.innerText||element.textContent||element.getAttribute?.("title")||element.getAttribute?.("placeholder")||element.getAttribute?.("name")||element.id||element.tagName||"Control";
    return String(text).trim().replace(/\s+/g," ").slice(0,140) || element.tagName.toLowerCase();
  }
  function selectorFor(element){if(element.id)return "#"+CSS.escape(element.id);const testId=element.getAttribute?.("data-testid");if(testId)return '[data-testid="'+CSS.escape(testId)+'"]';const name=element.getAttribute?.("name");if(name)return element.tagName.toLowerCase()+'[name="'+CSS.escape(name)+'"]';return element.tagName.toLowerCase()}
  function createPrivacyMasks(){const masks=[];document.querySelectorAll(SENSITIVE_SELECTOR).forEach(element=>{const rect=element.getBoundingClientRect();if(rect.width<1||rect.height<1)return;const mask=document.createElement("div");Object.assign(mask.style,{position:"fixed",left:rect.left+"px",top:rect.top+"px",width:rect.width+"px",height:rect.height+"px",background:"#111827",borderRadius:"5px",zIndex:"2147483647",pointerEvents:"none"});document.documentElement.appendChild(mask);masks.push(mask)});return()=>masks.forEach(m=>m.remove())}
  function shouldSkip(target){return !!target?.closest?.(SENSITIVE_SELECTOR)}

  function recordTarget(target,event,verb="Select"){
    if(!recorderActive||!target||shouldSkip(target))return;
    const label=labelFor(target),now=Date.now(),sig=[verb,selectorFor(target),Math.round(event.clientX||0),Math.round(event.clientY||0)].join("|");
    if(sig===lastSignature&&now-lastAt<120)return; lastSignature=sig;lastAt=now;
    const cleanup=createPrivacyMasks(); setTimeout(cleanup,260);
    const x=Number(event.clientX??(target.getBoundingClientRect().left+target.getBoundingClientRect().width/2));
    const y=Number(event.clientY??(target.getBoundingClientRect().top+target.getBoundingClientRect().height/2));
    chrome.runtime.sendMessage({
      type:"RECORD_CLICK", title:verb+" "+label, instruction:verb+" "+label+".", url:location.href, page_title:document.title,
      element:{tag:target.tagName.toLowerCase(),label,selector:selectorFor(target)},
      click:{x,y,x_pct:Math.max(0,Math.min(100,x/window.innerWidth*100)),y_pct:Math.max(0,Math.min(100,y/window.innerHeight*100)),viewport:{width:window.innerWidth,height:window.innerHeight}}
    }).catch(error=>console.error("[screenings4u Guide Recorder]",error));
  }

  document.addEventListener("pointerdown",event=>{
    if(event.button!==undefined&&event.button!==0)return;
    const raw=event.target instanceof Element?event.target:null;if(!raw)return;
    const target=raw.closest(INTERACTIVE_SELECTOR)||raw;
    if(target.matches?.('select,input[type="checkbox"],input[type="radio"]'))return; // capture after value changes
    recordTarget(target,event,"Select");
  },true);

  document.addEventListener("change",event=>{
    const target=event.target instanceof Element?event.target:null;if(!target)return;
    if(target.matches('select,input[type="checkbox"],input[type="radio"]')){
      const rect=target.getBoundingClientRect();recordTarget(target,{clientX:rect.left+rect.width/2,clientY:rect.top+rect.height/2},target.matches('select')?"Choose":"Set");
    }
  },true);

  document.addEventListener("keydown",event=>{
    if(event.key!=="Enter"||!recorderActive)return;
    const target=event.target instanceof Element?event.target:null;if(!target)return;
    if(target.matches('input,textarea,[contenteditable="true"]')){
      const rect=target.getBoundingClientRect();recordTarget(target,{clientX:rect.left+rect.width/2,clientY:rect.top+rect.height/2},"Submit");
    }
  },true);

  let captureMarker=null;
  function showCaptureMarker(message){
    hideCaptureMarker();
    const marker=document.createElement("div");
    marker.id="s4u-guide-capture-marker";
    marker.textContent=String(message.number||"");
    Object.assign(marker.style,{
      position:"fixed",left:Number(message.x||0)+"px",top:Number(message.y||0)+"px",
      transform:"translate(-50%,-50%)",width:"34px",height:"34px",borderRadius:"50%",
      background:"#ff6500",color:"#fff",border:"3px solid #fff",boxShadow:"0 2px 8px rgba(0,0,0,.35)",
      display:"flex",alignItems:"center",justifyContent:"center",font:"800 16px Arial,sans-serif",
      zIndex:"2147483647",pointerEvents:"none"
    });
    document.documentElement.appendChild(marker);
    captureMarker=marker;
  }
  function hideCaptureMarker(){if(captureMarker){captureMarker.remove();captureMarker=null}else document.getElementById("s4u-guide-capture-marker")?.remove()}

  chrome.runtime.onMessage.addListener((message,_sender,sendResponse)=>{
    if(message?.type==="RECORDER_PING")sendResponse({ok:true,loaded:true});
    if(message?.type==="RECORDER_STATE"){recorderActive=!!message.recording;sendResponse({ok:true});}
    if(message?.type==="SHOW_CAPTURE_MARKER"){showCaptureMarker(message);sendResponse({ok:true});}
    if(message?.type==="HIDE_CAPTURE_MARKER"){hideCaptureMarker();sendResponse({ok:true});}
  });
  chrome.runtime.sendMessage({type:"GET_STATE"}).then(r=>{recorderActive=!!r?.state?.recording}).catch(()=>{});
})();
