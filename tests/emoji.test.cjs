const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require('../emoji.js');
const D=require('../display.js');
test('像素采样裁掉透明边缘，量化颜色并保留彩色与网格坐标',()=>{
  const rgba=new Uint8ClampedArray([255,0,0,255, 0,0,255,127, 34,67,100,128, 0,255,0,255]);
  assert.deepEqual(E.pixelCells(rgba,2),[
    {x:0,y:0,color:'#ff0000'},
    {x:0,y:1,color:'#224466'},
    {x:1,y:1,color:'#00ff00'}
  ]);
});
test('完整离线素材库中的每个序列都可识别为一个表情',()=>{
  const data=require('../emoji-data.js');assert.equal(Object.keys(data.images).length,4009);
  for(const key of Object.keys(data.images)){
    const value=key.split('-').map(c=>String.fromCodePoint(parseInt(c,16))).join(''),tokens=E.tokenize(value);
    assert.equal(tokens.length,1,key);assert.equal(tokens[0].type,'emoji',key);
  }
});
test('离线表情库支持组合、肤色、国旗、选择符、键帽',()=>{
  for(const value of ['🟢','📚','🔴','☕','👋','🌙','⏸️','👩🏽‍💻','👨‍👩‍👧‍👦','🇨🇳','1️⃣','❤️','👍🏽']){
    const tokens=E.tokenize(value);assert.equal(tokens.length,1,value);assert.equal(tokens[0].type,'emoji',value);
    assert.match(E.dataURL(tokens[0].key),/^data:image\/svg\+xml/);
  }
  assert.deepEqual(E.tokenize('你好🙂!').map(t=>t.type),['text','text','emoji','text']);
  assert.ok(E.tokenize('☕︎').every(t=>t.type==='text'));
  assert.equal(E.tokenize('<script>').map(t=>t.value).join(''),'<script>');
});
test('布局按表情簇分割，组合表情不会跨行',()=>{
  const value='👩🏽‍💻👩🏽‍💻';
  const layout=D.layout(value,{width:70,height:300,size:24,units:s=>E.tokenize(s).map(t=>t.value)},(s,size)=>E.tokenize(s).length*size);
  assert.deepEqual(layout.rows.map(r=>r.text),['👩🏽‍💻','👩🏽‍💻']);
});
