const {chromium}=require('playwright');
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs/promises');
const {pathToFileURL}=require('node:url');
const base=process.env.JIANGUO_TEST_URL||'http://localhost:4173/jianguo/';
const status=(p,method)=>p.waitForFunction(m=>document.getElementById('wakeStatus').dataset.method===m,method);
async function noNative(ctx){await ctx.addInitScript(()=>Object.defineProperty(navigator,'wakeLock',{value:undefined,configurable:true}));}
async function playing(p){await p.waitForFunction(()=>{const v=document.getElementById('keepAwakeVideo');return v&&!v.paused&&v.readyState>=2;});assert.ok(await p.locator('#keepAwakeVideo').evaluate(v=>v.muted&&v.volume===0&&v.playsInline&&v.loop));}
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.JIANGUO_BROWSER_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),errors=[];
  try{
    const modern=await browser.newContext({serviceWorkers:'block'});
    await modern.addInitScript(()=>{
      window.testLocks=[];window.testHidden=false;
      Object.defineProperty(document,'hidden',{get:()=>window.testHidden,configurable:true});
      class Lock extends EventTarget{constructor(){super();this.released=false;}async release(){this.released=true;this.dispatchEvent(new Event('release'));}}
      Object.defineProperty(navigator,'wakeLock',{configurable:true,value:{request:async()=>{const l=new Lock();window.testLocks.push(l);return l;}}});
    });
    const p=await modern.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(base);await status(p,'native');
    await p.locator('#wakeRetry').click();assert.equal(await p.evaluate(()=>window.testLocks.length),1);
    await p.evaluate(()=>window.testLocks.at(-1).release());await p.waitForFunction(()=>window.testLocks.length===2);await status(p,'native');
    await p.evaluate(()=>{window.testHidden=true;document.dispatchEvent(new Event('visibilitychange'));});await status(p,'paused');assert.ok(await p.evaluate(()=>window.testLocks.every(l=>l.released)));
    await p.evaluate(()=>{window.testHidden=false;document.dispatchEvent(new Event('visibilitychange'));});await status(p,'native');
    await p.locator('#keepAwakeMode').selectOption('off');await status(p,'off');assert.ok(await p.evaluate(()=>window.testLocks.every(l=>l.released)));await modern.close();

    // A real, local muted video must decode and advance in a browser without API.
    const legacy=await browser.newContext({viewport:{width:393,height:852}});await noNative(legacy);
    const q=await legacy.newPage();q.on('pageerror',e=>errors.push(e.message));await q.goto(base);await status(q,'needs-gesture');assert.equal(await q.locator('video').count(),0);
    await q.locator('#present').click();await status(q,'video');await playing(q);
    const before=await q.locator('#keepAwakeVideo').evaluate(v=>v.currentTime);await q.waitForTimeout(200);const after=await q.locator('#keepAwakeVideo').evaluate(v=>v.currentTime);assert.notEqual(after,before,'兼容短片必须实际推进，而不只是 play() Promise 成功');
    await q.locator('#exitPresent').click();await status(q,'video');await q.locator('#keepAwakeMode').selectOption('off');await status(q,'off');assert.equal(await q.locator('video').count(),0);
    await q.locator('#keepAwakeMode').selectOption('compat');await status(q,'video');await playing(q);
    await fs.mkdir(path.join(__dirname,'../test-results'),{recursive:true});await q.locator('.wake-panel').screenshot({path:path.join(__dirname,'../test-results/keep-awake-panel.png')});
    await q.reload();assert.equal(await q.locator('#keepAwakeMode').inputValue(),'compat');await status(q,'needs-gesture');await q.locator('#wakeRetry').click();await status(q,'video');await playing(q);
    await q.evaluate(()=>navigator.serviceWorker.ready);await q.waitForFunction(()=>navigator.serviceWorker.controller!==null);await q.waitForFunction(()=>document.getElementById('offlineTitle').textContent==='已准备好离线使用');
    await legacy.setOffline(true);await q.reload();await status(q,'needs-gesture');await q.locator('#wakeRetry').click();await status(q,'video');await playing(q);await legacy.close();

    const denied=await browser.newContext({serviceWorkers:'block'});await denied.addInitScript(()=>Object.defineProperty(navigator,'wakeLock',{value:{request:()=>Promise.reject(new DOMException('Power saver','NotAllowedError'))},configurable:true}));
    const d=await denied.newPage();d.on('pageerror',e=>errors.push(e.message));await d.goto(base);await status(d,'failed');await d.locator('#keepAwakeMode').selectOption('compat');await status(d,'video');await playing(d);assert.match(await d.locator('#wakeDiagnostics').textContent(),/NotAllowedError/);await denied.close();

    const broken=await browser.newContext({serviceWorkers:'block'});await noNative(broken);const b=await broken.newPage();b.on('pageerror',e=>errors.push(e.message));
    await b.route('**/assets/wake.*',r=>r.fulfill({status:404,body:'not found'}));await b.goto(base);await b.locator('#keepAwakeMode').selectOption('compat');await b.waitForFunction(()=>document.getElementById('wakeStatus').dataset.method==='failed',null,{timeout:4000});
    assert.equal(await b.locator('video').count(),0);await b.unroute('**/assets/wake.*');await b.locator('#wakeRetry').click();await status(b,'video');await playing(b);await broken.close();

    const offline=await browser.newContext({offline:true});await noNative(offline);const f=await offline.newPage(),requests=[];f.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});f.on('pageerror',e=>errors.push(e.message));
    await f.goto(pathToFileURL(path.join(__dirname,'../dist/坚果像素屏-离线版.html')).href);await f.locator('#keepAwakeMode').selectOption('compat');await status(f,'video');await playing(f);
    assert.ok(await f.locator('#wakeMedia').evaluate(e=>e.dataset.webm.startsWith('data:video/webm;base64,')&&e.dataset.mp4.startsWith('data:video/mp4;base64,')));
    await f.locator('#keepAwakeMode').selectOption('off');await status(f,'off');assert.equal(await f.locator('video').count(),0);assert.deepEqual(requests,[]);await offline.close();assert.deepEqual(errors,[]);
    console.log('防息屏浏览器验收通过：标准接口/释放重试/前后台/拒绝不误报/真实无声短片解码及推进/双视频源失败与重新加载/模式保存/关闭释放/PWA断网/单文件零网络');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
