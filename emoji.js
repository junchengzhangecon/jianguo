(function(root){
  'use strict';
  const data=typeof module!=='undefined'?require('./emoji-data.js'):root.JianguoEmojiData;
  const images=data&&data.images||{},trie=Object.create(null);
  for(const key of Object.keys(images)){
    let node=trie;
    for(const code of key.split('-').filter(c=>c!=='fe0f')){
      const char=String.fromCodePoint(parseInt(code,16));node=node[char]||(node[char]=Object.create(null));
    }
    node.key=key;
  }
  function tokenize(value){
    const chars=Array.from(value),out=[];
    for(let i=0;i<chars.length;){
      let node=trie,j=i,match=null;
      while(j<chars.length){
        if(chars[j]==='\ufe0f'&&j>i){j++;if(node.key)match={key:node.key,end:j};continue;}
        node=node[chars[j]];if(!node)break;j++;
        if(node.key)match={key:node.key,end:j};
      }
      // An explicit text selector means the preceding symbol stays text.
      if(match&&chars[match.end]==='\ufe0e')match=null;
      if(match){out.push({type:'emoji',key:match.key,value:chars.slice(i,match.end).join('')});i=match.end;}
      else out.push({type:'text',value:chars[i++]});
    }
    return out;
  }
  function dataURL(key){return images[key]?'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(images[key]):'';}
  // Sample once on the same 12px native grid as the text font. Cut soft edges
  // and quantize colors so enlarged dots remain opaque, crisp and colorful.
  function pixelCells(rgba,grid){
    const cells=[],channel=v=>Math.round(v/17)*17,hex=v=>channel(v).toString(16).padStart(2,'0');
    for(let y=0;y<grid;y++)for(let x=0;x<grid;x++){
      const i=(y*grid+x)*4;if(rgba[i+3]<128)continue;
      cells.push({x,y,color:'#'+hex(rgba[i])+hex(rgba[i+1])+hex(rgba[i+2])});
    }
    return cells;
  }
  const sources=Object.create(null);
  function loadPixels(key){
    if(sources[key])return sources[key];
    return sources[key]=new Promise((resolve,reject)=>{
      const image=new Image();
      image.onload=()=>{
        try{
          const c=document.createElement('canvas');c.width=c.height=12;const ctx=c.getContext('2d',{willReadFrequently:true});
          ctx.drawImage(image,0,0,12,12);
          const cells=pixelCells(ctx.getImageData(0,0,12,12).data,12);
          ctx.clearRect(0,0,12,12);for(const cell of cells){ctx.fillStyle=cell.color;ctx.fillRect(cell.x,cell.y,1,1);}
          resolve({cells,url:c.toDataURL('image/png')});
        }catch(error){reject(error);}
        image.onload=image.onerror=null;
      };
      image.onerror=()=>{image.onload=image.onerror=null;reject(new Error('Emoji pixels could not load: '+key));};
      const url=dataURL(key);if(!url){reject(new Error('Unknown emoji: '+key));return;}image.src=url;
    });
  }
  function pixelURL(key){return loadPixels(key).then(p=>p.url);}
  function tile(cells,grid,width){
    const c=document.createElement('canvas');c.width=c.height=width;const ctx=c.getContext('2d'),scale=grid/12,step=width/grid;
    for(const cell of cells){
      ctx.fillStyle=cell.color;
      for(let dy=0;dy<scale;dy++)for(let dx=0;dx<scale;dx++){
        const col=cell.x*scale+dx,row=cell.y*scale+dy,x=Math.round(col*step),y=Math.round(row*step);
        const right=Math.min(Math.round((col+1)*step),Math.max(x+1,Math.round((col+.72)*step)));
        const bottom=Math.min(Math.round((row+1)*step),Math.max(y+1,Math.round((row+.72)*step)));
        ctx.fillRect(x,y,right-x,bottom-y);
      }
    }
    return c;
  }
  function createPainter(onReady,onError){
    const cache=Object.create(null),recent=[];
    return function draw(ctx,key,x,y,size,grid=24,dpr=1){
      let entry=cache[key];
      if(!entry){entry=cache[key]={};loadPixels(key).then(p=>{entry.cells=p.cells;if(onReady)onReady();},()=>{if(onError)onError();});}
      if(!entry.cells)return;
      grid=Math.max(12,Math.round(grid/12)*12);const width=Math.max(grid,Math.round(size*dpr));
      // Keep just one tile per used emoji. Scrolling reuses it; resizing replaces
      // it instead of retaining an unbounded history of old phone dimensions.
      if(!entry.tile||entry.grid!==grid||entry.tile.width!==width){if(entry.tile)entry.tile.width=entry.tile.height=0;entry.tile=tile(entry.cells,grid,width);entry.grid=grid;}
      // Bound large GPU-backed tiles even for long messages with many distinct
      // emoji. Retain tiny source pixels, so an evicted tile can return offline.
      const index=recent.indexOf(entry);if(index>=0)recent.splice(index,1);
      else if(recent.length===32){const old=recent.shift();old.tile.width=old.tile.height=0;old.tile=null;}
      recent.push(entry);
      // Fractional centering/scroll offsets would anti-alias the outer edge even
      // with image smoothing off. Match source and destination device pixels.
      ctx.imageSmoothingEnabled=false;ctx.drawImage(entry.tile,Math.round(x*dpr)/dpr,Math.round(y*dpr)/dpr,width/dpr,width/dpr);
    };
  }
  const api={tokenize,dataURL,pixelCells,pixelURL,createPainter};root.JianguoEmoji=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:window);
