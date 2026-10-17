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
    return {active:elapsed<2400,phase:Math.floor(elapsed/130)%4,elapsed};
  }
  // Original hand-drawn pixel interpretation, not a clip from the official show.
  function drawNailong(ctx,width,height,animation,reducedMotion){
    const sprite=document.createElement('canvas');sprite.width=112;sprite.height=108;
    const p=sprite.getContext('2d'),active=animation.active;
    const bounce=active&&!reducedMotion?[0,-2,1,-1][animation.phase]:0;
    const yellow='#ffd43c',shade='#eda92d',cream='#fff0a0',ink='#563b28';
    const rect=(x,y,w,h,color)=>{p.fillStyle=color;p.fillRect(x,y+bounce,w,h);};
    function oval(cx,cy,rx,ry,color){for(let y=-ry;y<=ry;y++){const x=Math.floor(rx*Math.sqrt(Math.max(0,1-y*y/(ry*ry))));rect(cx-x,cy+y,x*2+1,1,color);}}
    function blob(cx,cy,rx,ry,color){oval(cx,cy,rx+2,ry+2,ink);oval(cx,cy,rx,ry,color);}
    // Tail, orange back plates, feet and a round cream belly.
    rect(79,69,16,9,ink);rect(82,67,9,9,yellow);rect(91,64,7,9,yellow);
    rect(79,42,9,8,'#f18a30');rect(83,55,9,8,'#f18a30');rect(83,68,8,7,'#f18a30');
    blob(44,91,13,5,shade);blob(72,91,13,5,shade);
    blob(57,69,25,24,yellow);oval(57,75,17,17,cream);
    blob(30,65+(active?-4:2),7,12,yellow);blob(84,65+(active?-4:2),7,12,yellow);
    // Oversized head, soft snout and tiny orange crest.
    blob(55,37,33,25,yellow);rect(51,9,7,5,'#f18a30');rect(60,10,6,5,'#f18a30');
    oval(44,45,23,14,yellow);rect(27,44,2,2,shade);rect(34,42,2,2,shade);
    if(active){
      // Closed happy eyes, open laughing mouth, teeth and tongue.
      rect(36,30,4,2,ink);rect(33,32,3,3,ink);rect(40,32,3,3,ink);
      rect(66,30,4,2,ink);rect(63,32,3,3,ink);rect(70,32,3,3,ink);
      oval(52,48,17,!reducedMotion&&animation.phase%2?12:14,ink);
      rect(39,38,26,4,'#fff7df');oval(53,56,10,4,'#f17d83');
      rect(23,39,7,3,'#f2a039');rect(77,39,7,3,'#f2a039');
      if(!reducedMotion){rect(10,24,3,8,cream);rect(7,27,9,2,cream);rect(96,34,3,7,cream);rect(93,37,9,2,cream);}
    }else{
      oval(38,30,3,5,ink);oval(67,30,3,5,ink);rect(38,27,2,2,'#fff');rect(67,27,2,2,'#fff');
      rect(41,48,21,2,ink);rect(39,46,2,2,ink);rect(62,46,2,2,ink);
    }
    const scale=Math.max(1,Math.floor(Math.min(width*.7/112,(height-36)*.9/108)));
    ctx.imageSmoothingEnabled=false;
    ctx.drawImage(sprite,Math.round((width-112*scale)/2),Math.max(0,Math.round((height-108*scale-30)/2)),112*scale,108*scale);
    ctx.fillStyle='#ffe48a';ctx.font='12px Pixel, monospace';ctx.textAlign='center';ctx.textBaseline='bottom';
    ctx.fillText(active?'哈哈哈哈！':'点一下 · 奶龙大笑',width/2,height-8);ctx.textAlign='start';
  }
  const api={layout,laugh,drawNailong};root.JianguoDisplay=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:window);
