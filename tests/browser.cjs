const { chromium }=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
(async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.JIANGUO_BROWSER_PATH?{executablePath:process.env.JIANGUO_BROWSER_PATH}:{})});
  const context=await browser.newContext({viewport:{width:1440,height:1050}});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const base=process.env.JIANGUO_TEST_URL||'http://localhost:4173/jianguo/';
  await page.goto(base);await page.evaluate(()=>document.fonts.ready);await page.waitForFunction(()=>document.fonts.check('12px Pixel'));
  await fs.mkdir(path.join(__dirname,'../test-results'),{recursive:true});
  await page.screenshot({path:path.join(__dirname,'../test-results/desktop.png'),fullPage:true});
  await page.locator('#text').fill('中文像素测试\nHello <script>');
  await page.waitForFunction(()=>document.getElementById('display').getAttribute('aria-label').includes('中文像素测试'));
  assert.equal(await page.locator('script:not([src])').count(),0);
  await page.locator('#scroll').check();assert.equal(await page.locator('#scrollOptions').isVisible(),true);
  const first=await page.locator('#display').evaluate(c=>c.toDataURL());await page.waitForTimeout(200);
  assert.notEqual(await page.locator('#display').evaluate(c=>c.toDataURL()),first);
  await page.locator('#scroll').uncheck();await page.waitForTimeout(150);const still=await page.locator('#display').evaluate(c=>c.toDataURL());
  await page.waitForTimeout(200);assert.equal(await page.locator('#display').evaluate(c=>c.toDataURL()),still);
  await page.reload();assert.equal(await page.locator('#text').inputValue(),'中文像素测试\nHello <script>');
  await page.locator('#share').click();const link=await page.locator('#shareUrl').inputValue();await page.locator('#closeShare').click();
  const fresh=await browser.newContext();const imported=await fresh.newPage();await imported.goto(link);assert.equal(await imported.locator('#text').inputValue(),'中文像素测试\nHello <script>');await fresh.close();
  // Background/reload expiry and persisted pause use real UI with a synthetic saved deadline.
  await page.addInitScript(()=>{if(sessionStorage.getItem('timer-test-initialized'))return;sessionStorage.setItem('timer-test-initialized','1');localStorage.setItem('jianguo.state.v1',JSON.stringify({mode:'timer',minutes:1}));localStorage.setItem('jianguo.timers.v1',JSON.stringify({timer:{duration:60000,left:60000,end:Date.now()+1000,status:'running'},phase:'work'}));});
  await page.reload();await page.waitForFunction(()=>document.getElementById('timerStart').textContent==='已完成',{},{timeout:5000});
  await page.locator('#timerReset').click();await page.locator('#timerStart').click();await page.waitForTimeout(200);await page.locator('#timerStart').click();await page.reload();assert.equal(await page.locator('#timerStart').textContent(),'继续计时');
  await page.locator('[data-mode=pomodoro]').click();await page.locator('#nextPhase').click();assert.match(await page.locator('#timerState').textContent(),/休息阶段/);await page.reload();assert.match(await page.locator('#timerState').textContent(),/休息阶段/);
  await page.locator('[data-mode=text]').click();await page.locator('#text').fill('认真工作\n好好生活');
  await page.setViewportSize({width:393,height:852});await page.waitForTimeout(200);await page.waitForFunction(()=>{const c=document.getElementById('display'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;return d.some((v,i)=>i%4===0&&v>100);});await page.screenshot({path:path.join(__dirname,'../test-results/phone-portrait.png'),fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  for(const viewport of [{width:780,height:360},{width:936,height:432},{width:640,height:360}]){
    await page.setViewportSize(viewport);await page.locator('#present').click();await page.waitForTimeout(150);
    const box=await page.locator('#display').boundingBox();assert.ok(box.x>=15&&box.y>=15);assert.ok(box.x+box.width<=viewport.width-15);assert.ok(box.y+box.height<=viewport.height-15);
    assert.ok(await page.locator('#display').evaluate(c=>{const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]>100&&d[i+1]>100)n++;return n>100;}));
    await page.screenshot({path:path.join(__dirname,'../test-results/phone-landscape-'+viewport.width+'.png')});await page.locator('#exitPresent').click();
  }
  // PWA under /jianguo/ must be controlled and reload from its own cache offline.
  await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>navigator.serviceWorker.controller!==null);
  await page.waitForFunction(()=>document.getElementById('offlineTitle').textContent==='已准备好离线使用');
  await context.setOffline(true);await page.reload();await page.locator('#text').fill('离线新文字：坚果屏');await page.waitForFunction(()=>document.fonts.check('12px Pixel'));await page.waitForFunction(()=>document.getElementById('display').getAttribute('aria-label').includes('离线新文字'));
  await context.close();
  // Standalone must actually work with no network, including edits and timer controls.
  const offline=await browser.newContext({offline:true,viewport:{width:936,height:432}});const file=await offline.newPage();const requests=[];file.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});file.on('pageerror',e=>errors.push(e.message));
  await file.goto(pathToFileURL(path.join(__dirname,'../dist/坚果像素屏-离线版.html')).href);
  await file.evaluate(()=>document.fonts.ready);await file.locator('#text').fill('完全离线 · 测试');await file.waitForFunction(()=>document.getElementById('display').getAttribute('aria-label').includes('完全离线'));
  assert.equal(await file.evaluate(()=>document.fonts.check('12px Pixel')),true);
  await file.locator('#scroll').check();await file.locator('#scroll').uncheck();await file.locator('[data-mode=timer]').click();await file.locator('#timerStart').click();assert.equal(await file.locator('#timerStart').textContent(),'暂停');
  await file.locator('#present').click();await file.screenshot({path:path.join(__dirname,'../test-results/offline-landscape.png')});
  assert.deepEqual(requests,[]);assert.deepEqual(errors,[]);
  await browser.close();console.log('浏览器验收通过：编辑/滚动/分享/计时恢复/横竖屏/3种横屏尺寸/PWA子路径离线/单文件零网络且可操作');
})().catch(e=>{console.error(e);process.exit(1);});
