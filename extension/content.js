(()=>{
  let busy=false,lastCaptureAt=0;

  const SENSITIVE='input[type="password"],input[name*="ssn" i],input[id*="ssn" i],input[name*="social" i],input[id*="social" i],input[name*="card" i],input[id*="card" i],input[name*="account" i],input[id*="account" i],input[name*="routing" i],input[id*="routing" i],input[name*="dob" i],input[id*="dob" i],input[name*="birth" i],input[id*="birth" i],input[name*="license" i],input[id*="license" i],input[name*="cdl" i],input[id*="cdl" i],[data-s4u-sensitive="true"]';

  function labelFor(el){
    const aria=el.getAttribute?.("aria-label"); if(aria?.trim()) return aria.trim();
    const labelled=el.getAttribute?.("aria-labelledby");
    if(labelled){const n=document.getElementById(labelled);if(n?.textContent?.trim())return n.textContent.trim().replace(/\s+/g," ").slice(0,120)}
    if(el.id){const lab=document.querySelector('label[for="'+CSS.escape(el.id)+'"]');if(lab?.textContent?.trim())return lab.textContent.trim().replace(/\s+/g," ").slice(0,120)}
    const interactive=el.closest?.("button,a,label,[role='button'],input,select,textarea")||el;
    return String(interactive.innerText||interactive.textContent||interactive.getAttribute?.("title")||interactive.getAttribute?.("name")||interactive.id||interactive.tagName||"Control").trim().replace(/\s+/g," ").slice(0,120);
  }

  function selectorFor(el){
    if(el.id)return "#"+CSS.escape(el.id);
    const test=el.getAttribute?.("data-testid");if(test)return '[data-testid="'+CSS.escape(test)+'"]';
    const name=el.getAttribute?.("name");if(name)return el.tagName.toLowerCase()+'[name="'+CSS.escape(name)+'"]';
    return el.tagName.toLowerCase();
  }

  function addMasks(){
    const masks=[];
    document.querySelectorAll(SENSITIVE).forEach(el=>{
      const r=el.getBoundingClientRect(); if(r.width<1||r.height<1)return;
      const m=document.createElement("div");
      Object.assign(m.style,{
        position:"fixed",left:r.left+"px",top:r.top+"px",
        width:r.width+"px",height:r.height+"px",
        background:"#111827",borderRadius:"4px",
        zIndex:"2147483647",pointerEvents:"none"
      });
      document.documentElement.appendChild(m); masks.push(m);
    });
    return ()=>masks.forEach(m=>m.remove());
  }

  async function capture(event){
    if(event.button!==undefined && event.button!==0)return;
    const now=Date.now();
    if(busy || now-lastCaptureAt<350)return;

    const target=event.target instanceof Element?event.target:null;
    if(!target)return;

    let state;
    try{state=(await chrome.runtime.sendMessage({type:"GET_STATE"}))?.state}catch{return}
    if(!state?.recording)return;

    busy=true; lastCaptureAt=now;
    const cleanup=addMasks();
    const label=labelFor(target);

    // Give the redaction overlays one paint, but capture before click navigation.
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));

    try{
      const response=await chrome.runtime.sendMessage({
        type:"RECORD_CLICK",
        title:"Select "+label,
        instruction:"Select "+label+".",
        url:location.href,
        page_title:document.title,
        element:{
          tag:target.tagName.toLowerCase(),
          label,
          selector:selectorFor(target)
        },
        click:{
          x:event.clientX,
          y:event.clientY,
          x_pct:Math.max(0,Math.min(100,(event.clientX/window.innerWidth)*100)),
          y_pct:Math.max(0,Math.min(100,(event.clientY/window.innerHeight)*100)),
          viewport:{width:window.innerWidth,height:window.innerHeight}
        }
      });

      if(!response?.ok && response?.error){
        console.error("[screenings4u Guide Recorder]",response.error);
      }
    }catch(error){
      console.error("[screenings4u Guide Recorder]",error);
    }finally{
      cleanup();
      setTimeout(()=>{busy=false},250);
    }
  }

  // pointerdown happens before click/default navigation, so screenshots are not lost.
  document.addEventListener("pointerdown",capture,true);
})();