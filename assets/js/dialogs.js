window.S4UDialog=(()=>{
  let root=null;
  function ensure(){
    if(root)return root;
    root=document.createElement('div');
    root.className='s4u-dialog';
    root.hidden=true;
    root.innerHTML=`<div class="s4u-dialog-card" role="dialog" aria-modal="true" aria-labelledby="s4uDialogTitle">
      <div class="s4u-dialog-brand"><img src="images/logo2.png" alt="screenings4u"></div>
      <div class="s4u-dialog-body"><span class="eyebrow" id="s4uDialogEyebrow">GUIDE BUILDER</span><h2 id="s4uDialogTitle">Notice</h2><p id="s4uDialogMessage"></p><div class="s4u-dialog-actions"><button class="btn secondary" data-cancel>Cancel</button><button class="btn primary" data-confirm>OK</button></div></div>
    </div>`;
    document.body.appendChild(root);
    return root;
  }
  function open({title='Notice',message='',eyebrow='GUIDE BUILDER',confirmText='OK',cancelText='Cancel',danger=false,showCancel=false}={}){
    const el=ensure(), titleEl=el.querySelector('#s4uDialogTitle'), msg=el.querySelector('#s4uDialogMessage'), eye=el.querySelector('#s4uDialogEyebrow'), yes=el.querySelector('[data-confirm]'), no=el.querySelector('[data-cancel]');
    titleEl.textContent=title; msg.textContent=message; eye.textContent=eyebrow; yes.textContent=confirmText; no.textContent=cancelText; no.hidden=!showCancel; yes.className='btn '+(danger?'danger':'primary'); el.hidden=false;
    setTimeout(()=>yes.focus(),0);
    return new Promise(resolve=>{
      let done=false;
      const finish=v=>{if(done)return;done=true;el.hidden=true;yes.onclick=no.onclick=null;document.removeEventListener('keydown',key);resolve(v)};
      const key=e=>{if(e.key==='Escape'&&showCancel)finish(false);if(e.key==='Enter')finish(true)};
      yes.onclick=()=>finish(true); no.onclick=()=>finish(false); document.addEventListener('keydown',key);
    });
  }
  return {
    alert:(message,title='Notice')=>open({title,message,showCancel:false}),
    confirm:(message,{title='Please confirm',confirmText='Confirm',cancelText='Cancel',danger=false}={})=>open({title,message,confirmText,cancelText,danger,showCancel:true})
  };
})();
