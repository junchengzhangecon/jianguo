(function(root){
  'use strict';
  // Resource controller only: visibility, media and Wake Lock are injected so
  // Android permission failures and late results can be tested deterministically.
  function createController(env={}){
    let mode='off',suspended=false,epoch=0,sentinel=null,nativePending=null;
    let video=null,videoPending=null,videoActive=false,authorized=false,videoReject=null,videoTimer=null;
    let nativeError='',videoError='',retryCount=0,retryTimer=null;
    const visible=env.isVisible||(()=>true),schedule=env.schedule||((f,ms)=>setTimeout(f,ms)),cancel=env.cancel||clearTimeout;
    const wanted=()=>mode!=='off'&&!suspended&&visible();
    const nativeSupported=typeof env.requestNative==='function';
    function getStatus(){
      const nativeActive=Boolean(sentinel&&!sentinel.released);
      const mediaActive=Boolean(videoActive&&video&&!video.paused);
      let method=mode==='off'?'off':!wanted()?'paused':nativeActive&&mediaActive?'dual':nativeActive?'native':mediaActive?'video':nativePending||videoPending?'pending':nativeError||videoError?'failed':'needs-gesture';
      return {mode,method,nativeSupported,nativeActive,videoActive:mediaActive,nativeError,videoError};
    }
    function emit(){if(env.onStatus)env.onStatus(getStatus());}
    function release(lock){try{return Promise.resolve(lock.release()).catch(()=>{});}catch(_){return Promise.resolve();}}
    function clearVideoTimer(){if(videoTimer!==null){clearTimeout(videoTimer);videoTimer=null;}}
    function clearResources(){
      epoch++;if(retryTimer!==null){cancel(retryTimer);retryTimer=null;}
      const old=sentinel,v=video,reject=videoReject;sentinel=null;nativePending=null;video=null;videoPending=null;videoReject=null;videoActive=false;clearVideoTimer();if(reject)reject(new Error('cancelled'));
      if(v){try{v.pause();v.remove();}catch(_){}}
      return old?release(old):Promise.resolve();
    }
    function requestNative(){
      if(!nativeSupported||!wanted())return Promise.resolve();
      if(retryTimer!==null){cancel(retryTimer);retryTimer=null;}
      if(sentinel&&!sentinel.released)return Promise.resolve();
      if(nativePending)return nativePending;
      const generation=epoch;let requested;
      try{requested=env.requestNative();}catch(error){nativeError=error.name||error.message||'request-failed';emit();return Promise.resolve();}
      nativePending=Promise.resolve(requested).then(lock=>{
        if(generation!==epoch||!wanted())return release(lock);
        nativePending=null;
        if(lock.released){nativeError='released';emit();return;}
        sentinel=lock;nativeError='';
        lock.addEventListener('release',()=>{
          if(sentinel!==lock)return;sentinel=null;nativeError='released';emit();
          if(wanted()&&retryCount<2){
            if(retryTimer!==null)cancel(retryTimer);
            const delay=1000*Math.pow(2,retryCount++);let id;
            id=schedule(()=>{if(generation!==epoch||!wanted()||retryTimer!==id)return Promise.resolve();retryTimer=null;return requestNative();},delay);retryTimer=id;
          }
        });emit();
      }).catch(error=>{if(generation===epoch){nativePending=null;nativeError=error.name||error.message||'request-failed';emit();}});
      emit();return nativePending;
    }
    function requestVideo(gesture){
      if(!wanted()||mode==='auto'&&nativeSupported)return Promise.resolve();
      if(videoActive&&video&&!video.paused)return Promise.resolve();
      if(videoPending)return videoPending;
      if(!authorized&&!gesture){emit();return Promise.resolve();}
      if(gesture)authorized=true;
      const generation=epoch;let v=video;
      try{
        if(!v){v=env.makeVideo();video=v;
          const interrupted=()=>{
            if(video!==v||!wanted())return;
            if(videoReject){videoReject(new Error('media-error'));return;}
            if(videoActive){videoActive=false;videoError='playback-stopped';video=null;v.pause();v.remove();emit();}
          };
          v.addEventListener('pause',interrupted);v.addEventListener('error',interrupted);v.addEventListener('ended',interrupted);
        }
        // Must be invoked synchronously inside the user's click, before awaiting
        // any native request. No audio or unmuted autoplay is used.
        const playing=v.play();
        const failed=new Promise((_,reject)=>{videoReject=reject;videoTimer=setTimeout(()=>reject(new Error('media-timeout')),12000);});
        videoPending=Promise.race([Promise.resolve(playing),failed]).then(()=>{
          if(generation!==epoch||video!==v||!wanted()){v.pause();return;}
          clearVideoTimer();videoPending=null;videoReject=null;videoActive=!v.paused;videoError=videoActive?'':'playback-stopped';emit();
        }).catch(error=>{
          if(generation!==epoch||video!==v)return;
          clearVideoTimer();videoPending=null;videoReject=null;videoActive=false;videoError=error.message==='media-timeout'?'media-timeout':error.name||error.message||'play-failed';video=null;v.pause();v.remove();emit();
        });
        emit();return videoPending;
      }catch(error){videoActive=false;videoError=error.name||error.message||'play-failed';emit();return Promise.resolve();}
    }
    function resume(options={}){
      if(options.gesture){authorized=true;retryCount=0;nativeError='';videoError='';if(retryTimer!==null){cancel(retryTimer);retryTimer=null;}}
      suspended=false;if(!wanted()){emit();return Promise.resolve();}
      // Start legacy playback first while transient user activation is intact.
      const media=requestVideo(Boolean(options.gesture)),native=requestNative();emit();
      return Promise.all([media,native]);
    }
    function setMode(value,options={}){
      const cleanup=clearResources();mode=['auto','compat','off'].includes(value)?value:'off';suspended=false;nativeError='';videoError='';retryCount=0;
      return Promise.all([cleanup,resume(options)]);
    }
    function suspend(){suspended=true;const done=clearResources();emit();return done;}
    return {setMode,resume,suspend,getStatus,dispose:()=>setMode('off')};
  }
  const api={createController};root.JianguoWake=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:window);
