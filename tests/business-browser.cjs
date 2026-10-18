const {chromium}=require('playwright');
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs/promises');
const {pathToFileURL}=require('node:url');
const base=process.env.JIANGUO_TEST_URL||'http://localhost:4173/jianguo/';
const current=p=>p.locator('#display').getAttribute('aria-label');
const canvas=p=>p.locator('#display').evaluate(c=>c.toDataURL());
async function label(p,text){await p.waitForFunction(t=>document.getElementById('display').getAttribute('aria-label').includes(t),text);}
async function colorEmoji(p){await p.waitForFunction(()=>{
  const c=document.getElementById('display'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
  let red=0,blue=0;for(let i=0;i<d.length;i+=4){if(d[i]>180&&d[i+1]<100&&d[i+2]<110)red++;if(d[i]<100&&d[i+1]>70&&d[i+2]>150)blue++;}
  return red>30&&blue>30;
});}
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.JIANGUO_BROWSER_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),errors=[];
  try{
    await fs.mkdir(path.join(__dirname,'../test-results'),{recursive:true});
    const context=await browser.newContext({viewport:{width:1440,height:1050}}),p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
    await p.goto(base);await p.evaluate(()=>document.fonts.ready);await p.locator('#text').fill('旧的文字');await p.locator('#scroll').uncheck();
    await p.locator('[data-mode=business]').click();assert.equal(await p.locator('[data-business]').count(),7);assert.ok(await p.locator('#scroll').isChecked());
    for(const [id,text] of [['open','欢迎交流'],['focus','Deep Work'],['busy','Do Not Disturb'],['break','On Break'],['back','Be Right Back'],['closed','Closed for Today'],['paused','Out of Service']]){
      await p.locator(`[data-business=${id}]`).click();await label(p,text);assert.equal(await p.locator(`[data-business=${id}]`).getAttribute('aria-pressed'),'true');
    }
    let first=await canvas(p);await p.waitForTimeout(220);assert.notEqual(await canvas(p),first);
    await p.locator('#scroll').uncheck();await p.waitForTimeout(350);first=await canvas(p);await p.waitForTimeout(200);assert.equal(await canvas(p),first);
    await p.locator('#businessLang').selectOption('en');await p.waitForFunction(()=>document.getElementById('display').getAttribute('aria-label')==='营业状态：⏸️ Out of Service');
    await p.locator('#businessLang').selectOption('zh');await p.waitForFunction(()=>document.getElementById('display').getAttribute('aria-label')==='营业状态：⏸️ 暂停服务');
    await p.locator('#businessLang').selectOption('both');await p.locator('#businessNote').fill('14:30 回来 💻❤️');await label(p,'14:30');
    await p.locator('#businessEmoji').uncheck();await p.waitForTimeout(100);assert.ok(!(await current(p)).includes('⏸'));
    await p.locator('#businessEmoji').check();await label(p,'⏸');
    await p.reload();assert.ok(!(await p.locator('#scroll').isChecked()));assert.equal(await p.locator('#businessNote').inputValue(),'14:30 回来 💻❤️');
    await p.locator('#share').click();const share=await p.locator('#shareUrl').inputValue();await p.locator('#closeShare').click();
    const fresh=await browser.newContext(),q=await fresh.newPage();await q.goto(share);await label(q,'Out of Service');assert.equal(await q.locator('#businessNote').inputValue(),'14:30 回来 💻❤️');await fresh.close();
    await p.screenshot({path:path.join(__dirname,'../test-results/business-desktop.png'),fullPage:true});
    for(const viewport of [{width:936,height:432},{width:780,height:360},{width:640,height:360},{width:393,height:852}]){
      await p.setViewportSize(viewport);await p.locator('#present').click();await p.waitForTimeout(250);
      assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await p.screenshot({path:path.join(__dirname,`../test-results/business-${viewport.width}.png`)});await p.locator('#exitPresent').click();
    }
    await p.locator('[data-mode=text]').click();assert.equal(await p.locator('#text').inputValue(),'旧的文字');assert.ok(!(await p.locator('#scroll').isChecked()));
    // Prove both independent scroll preferences survive mode switches.
    await p.locator('#scroll').check();await p.locator('[data-mode=business]').click();assert.ok(!(await p.locator('#scroll').isChecked()));await p.locator('[data-mode=text]').click();assert.ok(await p.locator('#scroll').isChecked());
    await p.locator('#scroll').uncheck();await p.locator('#dots').uncheck();await p.locator('#color').fill('#ffffff');
    await p.locator('#text').fill('🔴💻');await colorEmoji(p);await p.waitForTimeout(200);first=await canvas(p);await p.waitForTimeout(150);assert.equal(await canvas(p),first,'静态表情完成加载后不闪烁');
    await p.locator('#text').fill('你好👩🏽‍💻🇨🇳1️⃣❤️');await label(p,'👩🏽‍💻');
    assert.equal(await p.evaluate(()=>JianguoEmoji.tokenize('👩🏽‍💻🇨🇳1️⃣❤️').length),4);
    await p.locator('#text').fill('AB');await p.locator('#text').evaluate(e=>e.setSelectionRange(1,1));await p.getByRole('button',{name:'插入咖啡',exact:true}).click();assert.equal(await p.locator('#text').inputValue(),'A☕B');
    await p.locator('#text').fill('<img onerror="throw 1"> 😂');await label(p,'<img');assert.equal(await p.locator('#text img').count(),0);
    await p.evaluate(()=>navigator.serviceWorker.ready);await p.waitForFunction(()=>navigator.serviceWorker.controller!==null);await p.waitForFunction(()=>document.getElementById('offlineTitle').textContent==='已准备好离线使用');
    await context.setOffline(true);await p.reload();await p.locator('#text').fill('🔴💻');await colorEmoji(p);
    await p.locator('[data-mode=business]').click();await p.locator('[data-business=paused]').click();await label(p,'Out of Service');await context.close();
    const offline=await browser.newContext({offline:true,viewport:{width:936,height:432}}),file=await offline.newPage(),requests=[];file.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});file.on('pageerror',e=>errors.push(e.message));
    await file.goto(pathToFileURL(path.join(__dirname,'../dist/坚果像素屏-离线版.html')).href);await file.evaluate(()=>document.fonts.ready);
    await file.locator('#text').fill('🔴💻');await colorEmoji(file);await file.locator('[data-mode=business]').click();await file.locator('[data-business=break]').click();await label(file,'On Break');
    await file.locator('#scroll').uncheck();await file.locator('#present').click();await file.waitForTimeout(250);await file.screenshot({path:path.join(__dirname,'../test-results/business-offline.png')});
    assert.deepEqual(requests,[]);assert.deepEqual(errors,[]);await offline.close();
    console.log('营业状态/表情验收通过：7状态/双语/备注/独立滚动/分享保存/4尺寸/彩色像素/组合表情/插入/防注入/PWA离线/单文件零网络');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
