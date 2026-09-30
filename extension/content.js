let recording=false,busy=false;
const sensitiveSelector=[
  'input[type="password"]','input[name*="ssn" i]','input[id*="ssn" i]','input[name*="social" i]','input[id*="social" i]',
  'input[name*="dob" i]','input[id*="dob" i]','input[name*="birth" i]','input[id*="birth" i]','input[name*="card" i]',
  'input[name*="account_number" i]','input[name*="routing" i]','input[name*="license" i]','input[name*="cdl" i]',
  '[data-s4u-sensitive="true"]'
].join(',');
chrome.storage.local.get('s4u_recording').then(x=>recording=!!x.s4u_recording);
chrome.runtime.onMessage.addListener(msg=>{if(msg.type==='RECORDER_STATE')recording=!!msg.recording});
function textFor(el){const aria=el.getAttribute?.('aria-label'),title=el.getAttribute?.('title');let txt=(aria||title||el.innerText||el.textContent||el.value||el.name||el.id||el.tagName||'').trim().replace(/\s+/g,' ');return txt.slice(0,120)}
function selectorFor(el){if(el.id)return '#'+CSS.escape(el.id);const test=el.getAttribute?.('data-testid');if(test)return `[data-testid="${test}"]`;const name=el.getAttribute?.('name');if(name)return `${el.tagName.toLowerCase()}[name="${CSS.escape(name)}"]`;return el.tagName.toLowerCase()}
function overlays(){const nodes=[];document.querySelectorAll(sensitiveSelector).forEach(el=>{const r=el.getBoundingClientRect();if(r.width<1||r.height<1)return;const d=document.createElement('div');Object.assign(d.style,{position:'fixed',left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px',background:'#111827',borderRadius:'6px',zIndex:'2147483647',pointerEvents:'none'});d.dataset.s4uRedaction='1';document.documentElement.appendChild(d);nodes.push(d)});return nodes}
async function capture(ev){if(!recording||busy||ev.button!==0)return;const el=ev.target.closest?.('button,a,input,select,textarea,[role="button"],[tabindex]')||ev.target;if(!el||el.closest?.('[data-s4u-recorder-ignore]'))return;busy=true;const r=el.getBoundingClientRect(),cover=overlays();await new Promise(res=>setTimeout(res,80));try{await chrome.runtime.sendMessage({type:'CAPTURE_STEP',url:location.href,pageTitle:document.title,element:{tag:el.tagName.toLowerCase(),label:textFor(el),selector:selectorFor(el)},click:{x:Math.round(ev.clientX),y:Math.round(ev.clientY),element_rect:{x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.round(r.height)},viewport:{width:innerWidth,height:innerHeight}}});}finally{cover.forEach(x=>x.remove());setTimeout(()=>busy=false,250)}}
document.addEventListener('click',capture,true);
