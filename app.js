(function(){
  'use strict';
  const C=window.JianguoCore,D=window.JianguoDisplay,$=id=>document.getElementById(id);
  const labels={text:['像素文字','TEXT MODE'],clock:['像素时钟','CLOCK MODE'],timer:['倒计时','COUNTDOWN'],pomodoro:['番茄钟','POMODORO'],status:['工作状态','STATUS MODE'],badge:['电子工牌','ID BADGE'],nailong:['奶龙模式','NAILONG · SILENT']};
  let laughStarted=null;
  let storageOK=true,phase='work',count=0,presenting=false,wake=null,audio=null;
  function read(k){try{return JSON.parse(localStorage.getItem(k));}catch(_){storageOK=false;return null;}}
  function write(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(_){storageOK=false;}}
  let saved=read('jianguo.state.v1'),state=C.normalize(saved);
  const imported=location.hash.startsWith('#s=')?C.decode(location.hash.slice(3)):null;
  if(imported)state=imported;
  const runtime=read('jianguo.timers.v1');
  if(runtime&&!imported){phase=runtime.phase==='rest'?'rest':'work';count=Number.isInteger(runtime.count)&&runtime.count>=0?runtime.count:0;}
  let timer=C.restoreTimer(!imported&&runtime&&runtime.timer,state.minutes*60000);
  let pomo=C.restoreTimer(!imported&&runtime&&runtime.pomo,state[phase]*60000);
  if(imported){persist();try{history.replaceState(null,'',location.href.split('#')[0]);}catch(_){location.hash='';}}
  let toastID;
  function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastID);toastID=setTimeout(()=>$('toast').classList.remove('show'),4200);}
  function persist(){write('jianguo.state.v1',state);write('jianguo.timers.v1',{timer,pomo,phase,count});}
  const fieldIDs=['text','color','size','speed','scroll','direction','dots','minutes','work','rest','name','role','organization','status','note','sound'];
  function paintControls(){
    fieldIDs.forEach(id=>{const el=$(id);if(el.type==='checkbox')el.checked=state[id];else el.value=state[id];});
    // Imported custom statuses remain editable, even when absent from presets.
    if($('status').value!==state.status){const option=document.createElement('option');option.value=option.textContent=state.status;$('status').append(option);$('status').value=state.status;}
    updatePanels();
  }
  function updatePanels(){
    document.querySelectorAll('[data-mode]').forEach(b=>{b.classList.toggle('active',b.dataset.mode===state.mode);b.setAttribute('aria-pressed',b.dataset.mode===state.mode?'true':'false');});
    document.querySelectorAll('[data-panel]').forEach(p=>p.hidden=p.dataset.panel!==state.mode);
    $('modeLabel').textContent=labels[state.mode][1];$('charCount').textContent=Array.from(state.text).length+' / 600';
    $('colorLabel').textContent=state.color.toUpperCase();$('sizeLabel').textContent=state.size;$('speedLabel').textContent=state.speed;
    $('scrollOptions').hidden=!state.scroll;
    const character=state.mode==='nailong';$('textAppearance').hidden=character;
    $('display').setAttribute('role',character?'button':'img');
    if(character){$('display').tabIndex=0;$('display').setAttribute('aria-label','奶龙待机，点击大笑（无声）');}
    else $('display').removeAttribute('tabindex');
    document.querySelectorAll('[data-color]').forEach(b=>b.classList.toggle('selected',b.dataset.color===state.color));
    const timing=state.mode==='timer'||state.mode==='pomodoro';$('timerActions').hidden=!timing;$('soundRow').hidden=!timing;
    const t=state.mode==='pomodoro'?pomo:timer;
    $('timerStart').textContent=t.status==='running'?'暂停':t.status==='paused'?'继续计时':t.status==='done'?'已完成':'开始计时';
    $('timerStart').disabled=t.status==='done';$('nextPhase').hidden=state.mode!=='pomodoro';
    $('nextPhase').textContent=phase==='work'?'进入休息':'开始下一轮';
    $('timerState').textContent=(state.mode==='pomodoro'?(phase==='work'?'专注阶段':'休息阶段')+' · 已完成 '+count+' 轮 · ':'')+({idle:'准备开始',running:'计时中',paused:'已暂停',done:'时间到'}[t.status]);
  }
  fieldIDs.forEach(id=>$(id).addEventListener('input',()=>{
    const el=$(id),value=el.type==='checkbox'?el.checked:el.type==='range'||el.type==='number'?Number(el.value):el.value;
    // Allow temporarily empty numeric input while typing; normalize on blur.
    if(el.type==='number'&&el.value==='')return;
    state=C.normalize({...state,[id]:value});
    if(id==='minutes')timer=C.newTimer(state.minutes*60000);
    if(id==='work'||id==='rest'){pomo=C.newTimer(state[phase]*60000);}
    if(id==='sound'&&state.sound)unlockAudio();
    updatePanels();invalidate();persist();
  }));
  ['minutes','work','rest'].forEach(id=>$(id).addEventListener('change',()=>{$(id).value=state[id];}));
  $('modes').addEventListener('click',e=>{const b=e.target.closest('[data-mode]');if(!b)return;state.mode=b.dataset.mode;laughStarted=null;updatePanels();invalidate();persist();});
  $('swatches').addEventListener('click',e=>{const b=e.target.closest('[data-color]');if(!b)return;state.color=b.dataset.color;$('color').value=state.color;updatePanels();invalidate();persist();});
  document.querySelectorAll('[data-preset]').forEach(b=>b.addEventListener('click',()=>{
    const p=b.dataset.preset;
    if(p==='focus')state=C.normalize({...state,mode:'status',status:'专注中',note:'认真工作，好好生活',color:'#b8f56b',scroll:false});
    if(p==='hello')state=C.normalize({...state,mode:'text',text:'HELLO, WORLD!  今天也要开心呀',color:'#ffca73',scroll:true});
    if(p==='name')state=C.normalize({...state,mode:'badge',color:'#bfb2f5',scroll:false});
    paintControls();invalidate();persist();
  }));
  $('resetSettings').addEventListener('click',()=>{if(!confirm('恢复显示设置，并重置倒计时和番茄钟？'))return;state=C.normalize(null);phase='work';count=0;timer=C.newTimer(state.minutes*60000);pomo=C.newTimer(state.work*60000);paintControls();invalidate();persist();toast('已恢复默认设置');});
  function unlockAudio(){try{if(!audio){const A=window.AudioContext||window.webkitAudioContext;if(A)audio=new A();}if(audio&&audio.state==='suspended')audio.resume().catch(()=>{});}catch(_){}}
  function bell(){if(!state.sound||!audio||audio.state!=='running')return;try{[0,.23,.46].forEach(delay=>{const o=audio.createOscillator(),g=audio.createGain();o.type='sine';o.frequency.value=660;o.connect(g);g.connect(audio.destination);const at=audio.currentTime+delay;g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(.12,at+.02);g.gain.exponentialRampToValueAtTime(.001,at+.2);o.start(at);o.stop(at+.21);});}catch(_){}}
  $('timerStart').addEventListener('click',()=>{unlockAudio();const now=Date.now();if(state.mode==='pomodoro')pomo=pomo.status==='running'?C.pause(pomo,now):C.start(pomo,now);else timer=timer.status==='running'?C.pause(timer,now):C.start(timer,now);updatePanels();invalidate();persist();});
  $('timerReset').addEventListener('click',()=>{if(state.mode==='pomodoro')pomo=C.newTimer(state[phase]*60000);else timer=C.newTimer(state.minutes*60000);updatePanels();invalidate();persist();});
  $('nextPhase').addEventListener('click',()=>{phase=C.nextPhase(phase);pomo=C.newTimer(state[phase]*60000);updatePanels();invalidate();persist();});
  function checkTimers(){
    const now=Date.now(),a=C.tick(timer,now),b=C.tick(pomo,now);timer=a.timer;pomo=b.timer;
    if(a.finished||b.finished){if(b.finished&&phase==='work')count++;persist();updatePanels();bell();toast(b.finished?'番茄钟阶段结束，休息一下吧':'倒计时结束');}
  }
  setInterval(()=>{checkTimers();if(['clock','timer','pomodoro'].includes(state.mode))dirty=true;},250);
  // Pixel rendering uses one cached text raster; scrolling moves lit pixels only.
  const canvas=$('display'),ctx=canvas.getContext('2d'),raster=document.createElement('canvas'),rctx=raster.getContext('2d',{willReadFrequently:true}),characterImage=$('nailongSprite');
  let width=0,height=0,pitch=4,dirty=true,cacheKey='',points=[],rasterW=0,rasterH=0,bgPattern=null,scrollOrigin=performance.now(),lastFrame=0,fontReady=false,renderPitch=4;
  function invalidate(){dirty=true;cacheKey='';scrollOrigin=performance.now();}
  function characterReady(){return characterImage.complete&&characterImage.naturalWidth===1536&&characterImage.naturalHeight===2288;}
  characterImage.addEventListener('load',()=>{invalidate();if(!characterReady())toast('奶龙素材尺寸不正确，请重新下载离线版或联网更新');});
  characterImage.addEventListener('error',()=>{invalidate();toast('奶龙素材加载失败，请联网重试或重新下载离线版');});
  function resize(){const rect=canvas.getBoundingClientRect();width=Math.max(1,Math.round(rect.width));height=Math.max(1,Math.round(rect.height));const dpr=Math.min(2,window.devicePixelRatio||1);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);pitch=Math.max(2.8,Math.min(6,width/170,height/75));const pattern=document.createElement('canvas');pattern.width=pattern.height=Math.round(pitch*dpr);const p=pattern.getContext('2d');p.fillStyle='#b5ce8620';const dot=Math.max(.6,pitch*dpr*.15);p.fillRect(0,0,dot,dot);bgPattern=ctx.createPattern(pattern,'repeat');dirty=true;cacheKey='';}
  if(window.ResizeObserver)new ResizeObserver(resize).observe($('screen'));else window.addEventListener('resize',resize);
  function content(){
    if(state.mode==='text')return state.text||' ';
    if(state.mode==='clock'){const d=new Date();return d.toLocaleTimeString('en-GB',{hour12:false})+'\n'+d.getFullYear()+'.'+String(d.getMonth()+1).padStart(2,'0')+'.'+String(d.getDate()).padStart(2,'0')+'  '+['星期日','星期一','星期二','星期三','星期四','星期五','星期六'][d.getDay()];}
    if(state.mode==='timer')return timer.status==='done'?'时间到\n休息一下吧':C.formatTime(C.remaining(timer,Date.now()));
    if(state.mode==='pomodoro')return (pomo.status==='done'?'阶段完成':phase==='work'?'专注时间':'休息时间')+'\n'+C.formatTime(C.remaining(pomo,Date.now()));
    if(state.mode==='status')return state.status+(state.note?'\n'+state.note:'');
    return state.name+'\n'+state.role+(state.organization?'\n'+state.organization:'');
  }
  function makeRaster(text){
    const key=[text,state.mode,state.size,state.scroll,width,height,fontReady].join('|');if(key===cacheKey)return;cacheKey=key;
    const family=fontReady?'Pixel':'monospace';
    const measure=(s,size)=>{rctx.font=size+'px '+family;return rctx.measureText(s).width;};
    const layout=D.layout(text,{width,height,size:state.size,mode:state.mode,scroll:state.scroll},measure);
    $('displayHint').textContent=layout.crowded?'内容较长，建议开启滚动或减少换行':'原生像素字形 · 舒展字距与行距';
    renderPitch=layout.pitch;rasterW=layout.width;rasterH=layout.height;raster.width=rasterW;raster.height=rasterH;
    rctx.fillStyle='#fff';rctx.textBaseline='top';
    for(const row of layout.rows){rctx.font=row.size+'px '+family;let x=state.scroll?4:(rasterW-row.width)/2;for(const char of Array.from(row.text)){rctx.fillText(char,Math.round(x),row.y);x+=rctx.measureText(char).width+row.spacing;}}
    const data=rctx.getImageData(0,0,rasterW,rasterH).data;points=[];
    for(let y=0;y<rasterH;y++)for(let x=0;x<rasterW;x++)if(data[(y*rasterW+x)*4+3]>100)points.push([x,y]);
    $('screenReader').textContent=text;canvas.setAttribute('aria-label',labels[state.mode][0]+'：'+text.replace(/\n/g,'，'));
  }
  function startLaugh(){if(state.mode!=='nailong')return;if(!characterReady()){toast('奶龙素材尚未加载成功，请稍候或重新加载页面');return;}laughStarted=performance.now();dirty=true;}
  $('laugh').addEventListener('click',startLaugh);
  function frame(now){requestAnimationFrame(frame);if(document.hidden||now-lastFrame<48)return;lastFrame=now;if(!dirty&&!(state.mode==='nailong'?laughStarted!==null:state.scroll))return;
    ctx.fillStyle=state.background;ctx.fillRect(0,0,width,height);
    if(state.dots&&bgPattern){ctx.fillStyle=bgPattern;ctx.fillRect(0,0,width,height);}
    if(state.mode==='nailong'){
      const animation=D.laugh(laughStarted,now);if(!animation.active)laughStarted=null;
      const ready=D.drawNailong(ctx,characterImage,width,height,animation,window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      canvas.dataset.animation=ready?(animation.active?'laughing':'idle'):(characterImage.complete?'error':'loading');canvas.setAttribute('aria-label',!ready?'奶龙素材尚未加载成功':animation.active?'奶龙正在无声大笑，点击重播':'奶龙待机，点击大笑（无声）');
      $('screenReader').textContent=canvas.getAttribute('aria-label');$('previewInfo').textContent='奶龙模式 · 无声 · 点击大笑';$('displayHint').textContent='点击角色即可大笑，笑完自动回到待机';dirty=false;return;
    }
    delete canvas.dataset.animation;
    const text=content();makeRaster(text);
    const y0=(height-rasterH*renderPitch)/2;let x0=(width-rasterW*renderPitch)/2;
    if(state.scroll){const gridW=width/renderPitch,cycle=rasterW+Math.max(20,gridW*.35),offset=((now-scrollOrigin)/1000*state.speed/3)%cycle;x0=state.direction==='left'?-offset*renderPitch:(offset-cycle)*renderPitch;
      draw(x0,y0);draw(x0+cycle*renderPitch,y0);if(cycle<gridW)draw(x0+cycle*2*renderPitch,y0);
    }else draw(x0,y0);
    $('previewInfo').textContent=state.scroll?'滚动显示 · '+state.speed+' 速度':'静态显示 · 自适应字号';dirty=false;
  }
  function draw(x0,y0){ctx.fillStyle=state.color;const size=renderPitch*.72;ctx.beginPath();for(const [x,y] of points){const px=x0+x*renderPitch,py=y0+y*renderPitch;if(px>=-renderPitch&&px<width&&py>=-renderPitch&&py<height)ctx.rect(px,py,size,size);}ctx.fill();}
  async function loadFont(){try{if(document.fonts){await document.fonts.load('12px Pixel');fontReady=document.fonts.check('12px Pixel');}}catch(_){}invalidate();if(!fontReady)toast('像素字体加载失败，已使用系统字体');}
  let presentHide;
  function showPresentBar(){if(!presenting)return;$('presentBar').classList.remove('dim');clearTimeout(presentHide);presentHide=setTimeout(()=>$('presentBar').classList.add('dim'),4000);}
  async function getWake(){if(!presenting||document.hidden)return;try{if('wakeLock'in navigator){wake=await navigator.wakeLock.request('screen');$('wakeState').textContent='屏幕常亮已开启';wake.addEventListener('release',()=>{wake=null;if(presenting)$('wakeState').textContent='常亮已释放，轻触重试';});}else $('wakeState').textContent='浏览器不支持常亮，请调整手机息屏时间';}catch(_){$('wakeState').textContent='常亮未开启，请调整手机息屏时间';}}
  $('present').addEventListener('click',()=>{presenting=true;document.body.classList.add('present');$('presentBar').hidden=false;unlockAudio();const request=document.documentElement.requestFullscreen||document.documentElement.webkitRequestFullscreen;if(request){try{const result=request.call(document.documentElement);if(result&&result.catch)result.catch(()=>toast('已进入沉浸展示；浏览器未允许系统全屏'));}catch(_){}}getWake();showPresentBar();resize();});
  async function exitPresent(){presenting=false;document.body.classList.remove('present');$('presentBar').hidden=true;clearTimeout(presentHide);if(wake){try{await wake.release();}catch(_){}wake=null;}if(document.fullscreenElement){try{await document.exitFullscreen();}catch(_){}}resize();}
  $('exitPresent').addEventListener('click',exitPresent);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&presenting)exitPresent();});
  document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement&&presenting)exitPresent();});
  canvas.addEventListener('click',()=>{startLaugh();showPresentBar();if(presenting&&!wake)getWake();});
  canvas.addEventListener('keydown',e=>{if(state.mode==='nailong'&&(e.key==='Enter'||e.key===' ')){e.preventDefault();startLaugh();}});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){checkTimers();invalidate();if(presenting)getWake();}});
  window.addEventListener('pagehide',persist);
  $('share').addEventListener('click',()=>{
    const base=location.protocol==='file:'?'https://junchengzhangecon.github.io/jianguo/':location.href.split('#')[0];
    $('shareUrl').value=base+'#s='+C.encode(state);
    const dialog=$('shareDialog');if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
  });
  $('closeShare').addEventListener('click',()=>$('shareDialog').close?$('shareDialog').close():$('shareDialog').removeAttribute('open'));
  $('copyLink').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('shareUrl').value);toast('配置链接已复制');}catch(_){$('shareUrl').select();toast('请长按或按 ⌘C / Ctrl+C 复制链接');}});
  $('download').addEventListener('click',()=>{if(location.protocol==='file:'){toast('这就是离线版，直接把此 HTML 文件传给手机即可');return;}const a=document.createElement('a');a.href='坚果像素屏-离线版.html';a.download='坚果像素屏-离线版.html';a.click();});
  async function initOffline(){
    if(location.protocol==='file:'){$('connection').textContent='单文件离线版 · 无需网络';$('offlineTitle').textContent='你正在使用完全离线版';$('offlineHelp').textContent='字体与程序均在此文件中。手机文件管理器需允许用浏览器打开 HTML；常亮和设置保存取决于浏览器支持。';return;}
    if(!('serviceWorker'in navigator)||!window.isSecureContext){$('offlineHelp').textContent='当前环境不支持离线缓存，请下载单文件离线版。线上版使用 HTTPS 可启用缓存。';return;}
    try{
      const registration=await navigator.serviceWorker.register('sw.js');await navigator.serviceWorker.ready;
      const updateNotice=()=>{if(registration.waiting&&navigator.serviceWorker.controller)toast('新版本已下载；请关闭此网站所有标签页后重新打开');};
      updateNotice();registration.addEventListener('updatefound',()=>{const worker=registration.installing;if(worker)worker.addEventListener('statechange',updateNotice);});
      async function status(){try{const keys=await caches.keys();const key=keys.find(k=>k.startsWith('jianguo-pixel-v'));if(!key)return;const cache=await caches.open(key);const assets=await cache.keys();const paths=assets.map(r=>new URL(r.url).pathname);if(paths.some(p=>p.endsWith('/app.js'))&&paths.some(p=>p.endsWith('/pixel.woff2'))){$('connection').textContent=navigator.onLine?'已缓存 · 可断网使用':'离线运行 · 内容已保存在本机';$('offlineTitle').textContent='已准备好离线使用';$('offlineHelp').textContent='页面和中文像素字体已缓存。关闭网络后仍可打开此网址；也可下载单文件离线版。';}}
      catch(_){} }
      navigator.serviceWorker.addEventListener('message',status);await status();setTimeout(status,1000);
    }catch(_){$('offlineHelp').textContent='浏览器未能建立离线缓存，请使用单文件离线版。';}
  }
  paintControls();resize();loadFont();requestAnimationFrame(frame);checkTimers();initOffline();
  window.addEventListener('online',()=>{if(location.protocol!=='file:')$('connection').textContent='网络已连接 · 设置保存在本机';});
  window.addEventListener('offline',()=>{$('connection').textContent='离线模式 · 本机运行中';});
  if(!storageOK)toast('浏览器未允许保存设置；当前可用，但关闭后可能无法恢复');
})();
