const $=s=>document.querySelector(s);
async function call(msg){return chrome.runtime.sendMessage(msg)}
async function render(){
 const r=await call({type:"GET_STATE"}),s=r?.state||{};
 const hasGuide=!!s.guide;
 $("#setup").hidden=!!s.recording||hasGuide;
 $("#active").hidden=!s.recording&&!hasGuide;
 $("#recordingStatus").textContent=s.recording?"● Recording":"● Recording stopped";
 $("#recordingStatus").className=s.recording?"on":"";
 $("#count").textContent=(s.steps?.length||0)+" steps captured";
 $("#stop").hidden=!s.recording;
}
$("#start").onclick=async()=>{const title=$("#title").value.trim();if(!title){$("#message").hidden=false;$("#message").textContent="Enter a guide title.";return}await call({type:"START_RECORDING",title,portal:$("#portal").value,audience:"Customer"});await render()};
$("#stop").onclick=async()=>{await call({type:"STOP_RECORDING"});await render()};
$("#export").onclick=async()=>{
 const r=await call({type:"GET_STATE"}),s=r?.state||{};
 if(!s.guide){$("#message").hidden=false;$("#message").textContent="There is no recording to export.";return}
 const guide={...s.guide,status:"draft",intro:"",steps:s.steps||[]};
 const blob=new Blob([JSON.stringify(guide,null,2)],{type:"application/json"});
 const url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download=(guide.title||"screenings4u-guide").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")+".json";a.click();
 setTimeout(()=>URL.revokeObjectURL(url),30000);
 $("#message").hidden=false;$("#message").textContent="Guide exported. Import it at guides.screenings4u.com.";
};
$("#clear").onclick=async()=>{await call({type:"CLEAR_RECORDING"});await render()};
render();