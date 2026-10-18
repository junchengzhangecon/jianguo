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
  function createPainter(onReady,onError){
    const cache=Object.create(null);
    return function draw(ctx,key,x,y,size){
      let image=cache[key];
      if(!image){image=new Image();cache[key]=image;image.onload=onReady;image.onerror=()=>{if(onError)onError();};image.src=dataURL(key);}
      if(image.complete&&image.naturalWidth){ctx.imageSmoothingEnabled=true;ctx.drawImage(image,x,y,size,size);}
    };
  }
  const api={tokenize,dataURL,createPainter};root.JianguoEmoji=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:window);
