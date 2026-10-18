const {chromium}=require('playwright');
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs/promises');
const {pathToFileURL}=require('node:url');
const base=process.env.JIANGUO_TEST_URL||'http://localhost:4173/jianguo/';
async function checkPixels(p){
  const result=await p.evaluate(async()=>{
    const E=JianguoEmoji,key=E.tokenize('🔴')[0].key;
    const url=await E.pixelURL(key),image=new Image();image.src=url;await new Promise((r,j)=>{image.onload=r;image.onerror=j;});
    const c=document.createElement('canvas');c.width=c.height=120;const ctx=c.getContext('2d');
    await new Promise((resolve,reject)=>{const draw=E.createPainter(()=>{draw(ctx,key,0,0,120,12,1);resolve();},reject);draw(ctx,key,0,0,120,12,1);});
    const data=ctx.getImageData(0,0,120,120).data;let lit=0,partial=0,gap=0,colors=new Set();
    for(let y=0;y<120;y++)for(let x=0;x<120;x++){const i=(y*120+x)*4,a=data[i+3];if(a){lit++;if(a!==255)partial++;colors.add([data[i],data[i+1],data[i+2]].join(','));}if(x%10>=7&&a)gap++;}
    return {url:url.slice(0,22),w:image.naturalWidth,h:image.naturalHeight,lit,partial,gap,colors:colors.size,smoothing:ctx.imageSmoothingEnabled};
  });
  assert.equal(result.url,'data:image/png;base64,');assert.equal(result.w,12);assert.equal(result.h,12);
  assert.ok(result.lit>1000);assert.equal(result.partial,0);assert.equal(result.gap,0);assert.ok(result.colors<40);assert.equal(result.smoothing,false);
  const fractional=await p.evaluate(async()=>{
    const out=[],E=JianguoEmoji,key=E.tokenize('🔴')[0].key;
    for(const dpr of [1,1.25,1.5,2]){
      const c=document.createElement('canvas');c.width=c.height=Math.round(120*dpr);const ctx=c.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);
      await new Promise((resolve,reject)=>{const draw=E.createPainter(()=>{draw(ctx,key,.25,.5,48,24,dpr);resolve();},reject);draw(ctx,key,.25,.5,48,24,dpr);});
      const data=ctx.getImageData(0,0,c.width,c.height).data;let partial=0;for(let i=3;i<data.length;i+=4)if(data[i]>0&&data[i]<255)partial++;
      out.push({dpr,partial});
    }
    return out;
  });
  assert.deepEqual(fractional,[1,1.25,1.5,2].map(dpr=>({dpr,partial:0})));
  const cache=await p.evaluate(async()=>{
    const E=JianguoEmoji,key=E.tokenize('☕')[0].key,c=document.createElement('canvas');c.width=c.height=300;const ctx=c.getContext('2d');
    const tiles=[],originalDraw=ctx.drawImage.bind(ctx);ctx.drawImage=(image,...args)=>{tiles.push(image);originalDraw(image,...args);};
    let painter;await new Promise((resolve,reject)=>{painter=E.createPainter(()=>{painter(ctx,key,0,0,120,12,1);resolve();},reject);painter(ctx,key,0,0,120,12,1);});
    const initial=tiles[0],create=document.createElement.bind(document);let allocations=0;
    document.createElement=(name,...args)=>{if(name==='canvas')allocations++;return create(name,...args);};
    try{
      for(let i=0;i<30;i++)painter(ctx,key,i*.4,0,120,12,1);
      const scrolling=allocations,reused=tiles.every(t=>t===initial);
      painter(ctx,key,0,0,144,24,2);const resized=tiles[tiles.length-1];
      painter(ctx,key,1,0,144,24,2);
      const stable=allocations===1&&tiles[tiles.length-1]===resized,width=resized.width;
      painter(ctx,key,0,0,120,12,1);
      return {scrolling,reused,stable,width,allocations,replaced:tiles[tiles.length-1]!==initial&&initial.width===0&&resized.width===0};
    }finally{document.createElement=create;}
  });
  assert.equal(cache.scrolling,0);assert.ok(cache.reused);assert.ok(cache.stable);assert.equal(cache.width,288);assert.equal(cache.allocations,2);assert.ok(cache.replaced);
  const bounded=await p.evaluate(async()=>{
    const E=JianguoEmoji,keys=Object.keys(JianguoEmojiData.images).slice(0,34),c=document.createElement('canvas');c.width=c.height=120;
    const ctx=c.getContext('2d'),tiles=[],drawImage=ctx.drawImage.bind(ctx);ctx.drawImage=(tile,...args)=>{tiles.push(tile);drawImage(tile,...args);};
    let ready;const draw=E.createPainter(()=>ready());
    for(const key of keys)await new Promise(resolve=>{ready=()=>{draw(ctx,key,0,0,120,12,1);resolve();};draw(ctx,key,0,0,120,12,1);});
    const live=tiles.filter(t=>t.width>0).length,evicted=tiles[0].width===0;
    draw(ctx,keys[0],0,0,120,12,1);
    return {live,evicted,restored:tiles[tiles.length-1].width===120&&tiles.length===35};
  });
  assert.equal(bounded.live,32);assert.ok(bounded.evicted);assert.ok(bounded.restored);
}
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.JIANGUO_BROWSER_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),errors=[];
  try{
    await fs.mkdir(path.join(__dirname,'../test-results'),{recursive:true});
    const ctx=await browser.newContext({viewport:{width:936,height:432}});ctx.setDefaultNavigationTimeout(120000);ctx.setDefaultTimeout(90000);
    const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(base);await checkPixels(p);
    await p.waitForFunction(()=>Array.from(document.querySelectorAll('#emojiPicker img, #businessPresets img')).every(i=>i.src.startsWith('data:image/png;')&&i.naturalWidth===12));
    await p.locator('#text').fill('☕ 休息一下 👋\n🔴 📚 🌙 ⏸️');await p.locator('#scroll').uncheck();await p.locator('#present').click();
    for(const width of [936,780,640]){await p.setViewportSize({width,height:width===936?432:360});await p.waitForTimeout(200);await p.screenshot({path:path.join(__dirname,`../test-results/pixel-emoji-${width}.png`)});}
    await p.locator('#exitPresent').click();await p.locator('[data-mode=business]').click();await p.locator('[data-business=break]').click();await p.locator('#scroll').uncheck();await p.locator('#present').click();await p.waitForTimeout(200);await p.screenshot({path:path.join(__dirname,'../test-results/pixel-business.png')});await p.locator('#exitPresent').click();
    await p.evaluate(()=>navigator.serviceWorker.ready);await p.waitForFunction(()=>navigator.serviceWorker.controller!==null);await p.waitForFunction(()=>document.getElementById('offlineTitle').textContent==='已准备好离线使用');
    await ctx.setOffline(true);await p.reload();await checkPixels(p);await ctx.close();
    const offline=await browser.newContext({offline:true}),f=await offline.newPage(),requests=[];f.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});f.on('pageerror',e=>errors.push(e.message));
    await f.goto(pathToFileURL(path.join(__dirname,'../dist/坚果像素屏-离线版.html')).href);await checkPixels(f);assert.deepEqual(requests,[]);assert.deepEqual(errors,[]);await offline.close();
    console.log('像素表情验收通过：12×12采样/彩色硬边/点阵间隙/禁平滑/像素按钮/滚动缓存零分配/字号DPR缓存替换/3横屏尺寸/营业状态/PWA断网/单文件零网络');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
