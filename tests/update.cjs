const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs/promises');
const {pathToFileURL}=require('node:url');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.JIANGUO_BROWSER_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  try{
    const errors=[],ctx=await browser.newContext({viewport:{width:936,height:432}}),p=await ctx.newPage();
    p.on('pageerror',e=>errors.push(e.message));
    await p.addInitScript(()=>{window.pixelFonts=[];const f=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(...args){window.pixelFonts.push(this.font);return f.apply(this,args);};});
    await p.goto(process.env.JIANGUO_TEST_URL||'http://localhost:4173/jianguo/');await p.evaluate(()=>document.fonts.ready);
    await p.locator('[data-mode=badge]').click();await p.locator('#name').fill('Juncheng Zhang');await p.locator('#role').fill('Experimenter');await p.locator('#organization').fill('Working Hours: 9:00-17:00');
    await p.locator('#color').fill('#bfb2f5');await p.locator('#scroll').uncheck();
    await fs.mkdir(path.join(__dirname,'../test-results'),{recursive:true});
    for(const viewport of [{width:936,height:432},{width:640,height:360},{width:393,height:852}]){
      await p.setViewportSize(viewport);await p.locator('#present').click();await p.waitForTimeout(250);
      assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await p.screenshot({path:path.join(__dirname,`../test-results/badge-fixed-${viewport.width}.png`)});await p.locator('#exitPresent').click();
    }
    assert.ok(await p.evaluate(()=>window.pixelFonts.every(font=>{const m=font.match(/(\d+(?:\.\d+)?)px/);return m&&Number(m[1])%12===0;})),'像素字形必须为原生12px的整数倍');
    await p.setViewportSize({width:393,height:852});await p.locator('[data-mode=clock]').click();await p.waitForTimeout(200);
    assert.ok(!(await p.locator('#displayHint').textContent()).includes('内容较长'),'默认时钟应在竖屏预览正常显示');
    await p.setViewportSize({width:936,height:432});
    // A saved scrolling setting must not make the idle character render forever.
    await p.locator('#scroll').check();await p.locator('[data-mode=nailong]').click();
    assert.equal(await p.locator('#textAppearance').isVisible(),false);
    await p.waitForFunction(()=>document.getElementById('display').dataset.animation==='idle');
    const idle=await p.locator('#display').evaluate(c=>c.toDataURL());await p.waitForTimeout(200);assert.equal(await p.locator('#display').evaluate(c=>c.toDataURL()),idle);
    await p.locator('#present').click();await p.waitForTimeout(150);
    await p.locator('#display').click();await p.waitForFunction(()=>document.getElementById('display').dataset.animation==='laughing');
    const laughing=await p.locator('#display').evaluate(c=>c.toDataURL());await p.waitForTimeout(170);assert.notEqual(await p.locator('#display').evaluate(c=>c.toDataURL()),laughing);
    await p.screenshot({path:path.join(__dirname,'../test-results/nailong-laughing.png')});
    await p.waitForFunction(()=>document.getElementById('display').dataset.animation==='idle');
    await p.screenshot({path:path.join(__dirname,'../test-results/nailong-idle.png')});
    await p.locator('#display').press('Enter');await p.waitForFunction(()=>document.getElementById('display').dataset.animation==='laughing');
    await p.locator('#exitPresent').click();await p.locator('#laugh').click();
    await p.waitForFunction(()=>document.getElementById('display').dataset.animation==='laughing');
    await p.reload();await p.waitForFunction(()=>document.getElementById('display').dataset.animation==='idle');assert.equal(await p.locator('[data-panel=nailong]').isVisible(),true);
    assert.equal(await p.locator('audio,video').count(),0);
    await p.evaluate(()=>navigator.serviceWorker.ready);await p.waitForFunction(()=>navigator.serviceWorker.controller!==null);
    await ctx.setOffline(true);await p.reload();await p.locator('#laugh').click();await p.waitForFunction(()=>document.getElementById('display').dataset.animation==='laughing');await ctx.close();
    const offline=await browser.newContext({offline:true,viewport:{width:640,height:360},reducedMotion:'reduce'}),file=await offline.newPage(),requests=[];
    file.on('pageerror',e=>errors.push(e.message));file.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
    await file.goto(pathToFileURL(path.join(__dirname,'../dist/坚果像素屏-离线版.html')).href);await file.evaluate(()=>document.fonts.ready);await file.waitForFunction(()=>document.fonts.check('12px Pixel'));await file.locator('[data-mode=nailong]').click();await file.locator('#present').click();await file.waitForTimeout(200);await file.locator('#display').press(' ');await file.waitForFunction(()=>document.getElementById('display').dataset.animation==='laughing');
    const reduced=await file.locator('#display').evaluate(c=>c.toDataURL());await file.waitForTimeout(180);assert.ok((await file.locator('#display').evaluate(c=>c.toDataURL()))===reduced,'减少动态效果时不应抖动');
    await file.waitForFunction(()=>document.getElementById('display').dataset.animation==='idle');
    assert.deepEqual(requests,[]);assert.deepEqual(errors,[]);await offline.close();
    console.log('更新验收通过：原生像素字号/照片工牌3种尺寸/点击大笑/自动待机/重复播放/键盘/持久化/PWA断网/单文件零请求/减少动态效果');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
