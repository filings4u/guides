const $=s=>document.querySelector(s);
async function state(){return (await chrome.storage.local.get(['s4u_recording','s4u_guide']));}
async function render(){const s=await state(), rec=!!s.s4u_recording; $('#idleView').hidden=rec;$('#recordingView').hidden=!rec;$('#count').textContent=`${s.s4u_guide?.steps?.length||0} steps captured`;}
$('#start').onclick=async()=>{const title=$('#title').value.trim()||'Untitled Guide',portal=$('#portal').value;const [tab]=await chrome.tabs.query({active:true,currentWindow:true});await chrome.runtime.sendMessage({type:'START_RECORDING',title,portal,tabId:tab.id});await render();};
$('#stop').onclick=async()=>{await chrome.runtime.sendMessage({type:'STOP_RECORDING'});await chrome.tabs.create({url:chrome.runtime.getURL('editor.html')});window.close();};
$('#openEditor').onclick=()=>chrome.tabs.create({url:chrome.runtime.getURL('editor.html')});render();
