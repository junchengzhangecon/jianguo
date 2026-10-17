(function(root){
  'use strict';
  // Fusion Pixel is a 12px bitmap font. Keep its native grid; fit the whole
  // composition instead of downsampling individual letters into merged strokes.
  function layout(text,options,measure){
    const {width,height,size=24,mode='text',scroll=false}=options;
    const base=Math.max(12,Math.floor(size/12)*12),padding=4;
    const limit=Math.max(24,Math.floor(width*.86/1.25));
    const rows=[];
    function add(line,font){
      const spacing=Math.max(1,font/12);
      const chars=Array.from(line);
      const rowWidth=s=>Math.max(1,measure(s,font)+Math.max(0,Array.from(s).length-1)*spacing);
      if(scroll){rows.push({text:line,size:font,spacing,width:rowWidth(line)});return;}
      let part='';
      for(const char of chars){
        if(part&&rowWidth(part+char)>limit){rows.push({text:part,size:font,spacing,width:rowWidth(part)});part='';}
        part+=char;
      }
      rows.push({text:part,size:font,spacing,width:rowWidth(part)});
    }
    (scroll?[text.replace(/\n/g,'   ')]:text.split('\n')).forEach((line,i)=>add(line,mode==='badge'&&i>0?Math.max(12,base-12):base));
    function place(){let y=padding;for(const row of rows){row.y=y;y+=Math.ceil(row.size*1.3)+Math.max(6,row.size*.5);}return {width:Math.ceil(Math.max(1,...rows.map(r=>r.width)))+padding*2,height:y+padding};}
    let box=place();
    const preferred=Math.max(1.5,Math.min(5,width/150,height/65));
    let pitch=Math.min(preferred,height*.82/box.height,scroll?preferred:width*.88/box.width);
    if(!scroll&&pitch<1.25&&base>12)return layout(text,{...options,size:base-12},measure);
    const crowded=!scroll&&pitch<1.25;
    if(crowded){rows.length=0;add('内容太长',12);add('请开启滚动',12);box=place();pitch=Math.min(preferred,height*.82/box.height,width*.88/box.width);}
    // Integer display cells when possible keep edges crisp on old Android GPUs.
    if(pitch>=2)pitch=Math.floor(pitch);
    return {...box,rows,pitch,crowded};
  }
  function laugh(start,now){
    const elapsed=start===null?2400:Math.max(0,now-start);
    return {active:elapsed<2400,phase:Math.floor(elapsed/130)%5,elapsed};
  }
  // Source image is copied byte-for-byte from timerring/codex-pet-naiwa.
  // Layout is not README preview order: row 4 is the five-frame belly laugh.
  function spriteFrame(animation,reducedMotion){
    const index=animation.active?(reducedMotion?2:animation.phase):0;
    return {x:index*192,y:animation.active?4*208:0,width:192,height:208};
  }
  function drawNailong(ctx,sprite,width,height,animation,reducedMotion){
    const active=animation.active,ready=sprite.complete&&sprite.naturalWidth===1536&&sprite.naturalHeight===2288;
    if(ready){
      const frame=spriteFrame(animation,reducedMotion);
      const scale=Math.max(.1,Math.min(width*.76/frame.width,(height-36)*.92/frame.height));
      const w=Math.round(frame.width*scale),h=Math.round(frame.height*scale);
      ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
      ctx.drawImage(sprite,frame.x,frame.y,frame.width,frame.height,Math.round((width-w)/2),Math.max(0,Math.round((height-h-30)/2)),w,h);
    }
    ctx.fillStyle='#ffe48a';ctx.font='12px Pixel, monospace';ctx.textAlign='center';ctx.textBaseline='bottom';
    ctx.fillText(!ready?(sprite.complete?'素材加载失败，请重新加载':'素材加载中…'):active?'哈哈哈哈！':'点一下 · 奶龙大笑',width/2,height-8);ctx.textAlign='start';
    return ready;
  }
  const api={layout,laugh,spriteFrame,drawNailong};root.JianguoDisplay=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:window);
