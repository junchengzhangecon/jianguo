const {chromium}=require('playwright');
const http=require('node:http');
const fs=require('node:fs/promises');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const assert=require('node:assert/strict');
(async()=>{
  const root=path.join(__dirname,'..'),old={},baseline=process.env.JIANGUO_UPGRADE_FROM||'f1aea7e',target='jianguo-pixel-v'+require('../package.json').version;
  for(const name of ['index.html','styles.css','app.js','core.js','sw.js',...(baseline==='f1aea7e'?[]:['display.js'])])old[name]=execFileSync('git',['show',baseline+':'+name],{cwd:root});
  try{old['wake.js']=execFileSync('git',['show',baseline+':wake.js'],{cwd:root,stdio:['ignore','pipe','ignore']});}catch(_){}
  for(const name of ['emoji.js','emoji-data.js'])try{old[name]=execFileSync('git',['show',baseline+':'+name],{cwd:root,stdio:['ignore','pipe','ignore'],maxBuffer:20*1024*1024});}catch(_){}
  const oldCache=old['sw.js'].toString().match(/jianguo-pixel-v[\d.]+/)[0];
  let updated=false;
  const server=http.createServer(async(req,res)=>{
    try{
      let name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/jianguo\//,'');if(!name)name='index.html';
      if(name.includes('..')){res.writeHead(403);res.end();return;}
      const types={'.js':'text/javascript','.css':'text/css','.html':'text/html','.woff2':'font/woff2','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
      res.setHeader('Content-Type',types[path.extname(name)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');
      res.end(!updated&&old[name]?old[name]:await fs.readFile(path.join(root,name)));
    }catch(_){res.writeHead(404);res.end();}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch({headless:true,executablePath:process.env.JIANGUO_BROWSER_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  try{
    const ctx=await browser.newContext(),p=await ctx.newPage(),url=`http://127.0.0.1:${server.address().port}/jianguo/`;
    await p.goto(url);assert.equal(await p.locator('[data-mode=nailong]').count(),baseline==='f1aea7e'?0:1);
    await p.locator('#text').fill('原手机保留的内容');
    await p.evaluate(()=>navigator.serviceWorker.ready);await p.waitForFunction(()=>navigator.serviceWorker.controller!==null);
    updated=true;const newWorkerEvent=ctx.waitForEvent('serviceworker');await p.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update();});const newWorker=await newWorkerEvent;
    await p.waitForFunction(async()=>Boolean((await navigator.serviceWorker.getRegistration()).waiting));
    await newWorker.evaluate(()=>{self.activationFinished=new Promise(resolve=>self.addEventListener('activate',()=>resolve(true)));});
    await p.close();await newWorker.evaluate(()=>self.activationFinished);
    // Closing all old clients allows normal SW activation, preserving settings.
    const next=await ctx.newPage();await next.goto(url);await next.waitForFunction(()=>Boolean(document.querySelector('[data-mode=nailong]')));
    assert.equal(await next.locator('#text').inputValue(),'原手机保留的内容');
    await next.waitForFunction(async({target,oldCache})=>{const keys=await caches.keys();return keys.includes(target)&&!keys.includes(oldCache);},{target,oldCache});
    await ctx.setOffline(true);await next.reload();await next.locator('[data-mode=nailong]').click();await next.locator('#laugh').click();await next.waitForFunction(()=>document.getElementById('display').dataset.animation==='laughing');
    await next.waitForFunction(()=>document.getElementById('nailongSprite').naturalWidth===1536);
    await next.locator('[data-mode=business]').click();await next.locator('[data-business=break]').click();
    await next.waitForFunction(()=>document.getElementById('display').getAttribute('aria-label').includes('On Break'));
    assert.match(await next.evaluate(()=>JianguoEmoji.pixelURL(JianguoEmoji.tokenize('☕')[0].key)),/^data:image\/png;base64,/);
    await ctx.close();console.log('升级验收通过：'+oldCache+' → '+target+' →关闭旧页激活→保留原文字→断网原仓库奶龙可用');
  }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exit(1);});
