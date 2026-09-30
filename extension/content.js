(()=>{
  const SENSITIVE='input[type="password"],input[name*="ssn" i],input[id*="ssn" i],input[name*="social" i],input[id*="social" i],input[name*="card" i],input[id*="card" i],input[name*="account" i],input[id*="account" i],input[name*="routing" i],input[id*="routing" i],input[name*="dob" i],input[id*="dob" i]';

  function labelFor(el){
    const aria=el.getAttribute?.("aria-label");if(aria)return aria.trim();
    const labelled=el.getAttribute?.("aria-labelledby");
    if(labelled){const n=document.getElementById(labelled);if(n?.textContent?.trim())return n.textContent.trim()}
    if(el.id){const lab=document.querySelector('label[for="'+CSS.escape(el.id)+'"]');if(lab?.textContent?.trim())return lab.textContent.trim()}
    const closest=el.closest?.("button,a,label,[role='button']");
    return (closest?.innerText||el.innerText||el.textContent||el.getAttribute?.("title")||el.getAttribute?.("name")||el.id||el.tagName||"Control").trim().replace(/\s+/g," ").slice(0,120);
  }
  function selectorFor(el){
    if(el.id)return "#"+CSS.escape(el.id);
    const name=el.getAttribute?.("name");if(name)return el.tagName.toLowerCase()+'[name="'+CSS.escape(name)+'"]';
    const dt=el.getAttribute?.("data-testid");if(dt)return '[data-testid="'+CSS.escape(dt)+'"]';
    return el.tagName.toLowerCase();
  }
  function addMasks(){
    const masks=[];
    document.querySelectorAll(SENSITIVE).forEach(el=>{
      const r=el.getBoundingClientRect();if(r.width<1||r.height<1)return;
      const m=document.createElement("div");
      Object.assign(m.style,{position:"fixed",left:r.left+"px",top:r.top+"px",width:r.width+"px",height:r.height+"px",background:"#111827",borderRadius:"4px",zIndex:"2147483647",pointerEvents:"none"});
      document.documentElement.appendChild(m);masks.push(m);
    });
    return ()=>masks.forEach(m=>m.remove());
  }

  document.addEventListener("click",async event=>{
    const target=event.target instanceof Element?event.target:null;
    if(!target)return;
    let state;
    try{state=(await chrome.runtime.sendMessage({type:"GET_STATE"}))?.state}catch{return}
    if(!state?.recording)return;

    const x=Math.max(0,Math.min(100,(event.clientX/window.innerWidth)*100));
    const y=Math.max(0,Math.min(100,(event.clientY/window.innerHeight)*100));
    const cleanup=addMasks(),label=labelFor(target);
    try{
      await chrome.runtime.sendMessage({
        type:"RECORD_CLICK",
        title:"Select "+label,
        instruction:"",
        url:location.href,
        page_title:document.title,
        element:{tag:target.tagName.toLowerCase(),label,selector:selectorFor(target)},
        click:{x:event.clientX,y:event.clientY,x_pct:x,y_pct:y,viewport:{width:window.innerWidth,height:window.innerHeight}}
      });
    }finally{
      setTimeout(cleanup,250);
    }
  },true);
})();