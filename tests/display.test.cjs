const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
function display(){assert.ok(fs.existsSync(require('node:path').join(__dirname,'../display.js')),'原生像素排版和奶龙动画模块尚未实现');return require('../display.js');}
const measure=(text,size)=>Array.from(text).reduce((n,c)=>n+size*(c.charCodeAt(0)>127?1:.5),0);
test('photo badge retains native pixel glyphs and separates rows at phone sizes',()=>{
  const d=display();for(const [width,height] of [[904,400],[608,328],[329,170]]){
    const l=d.layout('Juncheng Zhang\nExperimenter\nWorking Hours: 9:00-17:00',{width,height,size:24,mode:'badge',scroll:false},measure);
    assert.ok(l.rows.length>=3);assert.ok(l.rows[0].size>l.rows[1].size);
    for(let i=0;i<l.rows.length;i++){const r=l.rows[i];assert.equal(r.size%12,0);assert.ok(r.spacing>=1);if(i)assert.ok(r.y>=l.rows[i-1].y+l.rows[i-1].size+6);}
    assert.ok(l.width*l.pitch<=width*.9+1);assert.ok(l.height*l.pitch<=height*.85+1);
  }
});
test('static long content gives an explicit fallback instead of subpixel glyphs',()=>{
  const l=display().layout('很多很多内容'.repeat(100),{width:320,height:160,size:24,scroll:false},measure);
  assert.equal(l.crowded,true);assert.ok(l.rows.every(r=>r.size>=12));assert.ok(l.pitch>=1);
});
test('portrait preview tries a smaller native size before hiding a normal clock',()=>{
  const l=display().layout('12:34:56\n2026.10.17  星期六',{width:325,height:183,size:24,mode:'clock',scroll:false},measure);
  assert.equal(l.crowded,false);assert.ok(l.rows.some(r=>r.text==='12:34:56'));
  assert.ok(l.rows.every(r=>r.size===12));
  const text=display().layout('认真工作\n好好生活',{width:325,height:150,size:24,scroll:false},measure);
  assert.equal(text.crowded,false);assert.equal(text.rows[0].text,'认真工作');
});
test('scrolling keeps one row and preserves newlines as spaces',()=>{
  const l=display().layout('Hello\n中文',{width:600,height:300,size:24,scroll:true},measure);
  assert.equal(l.rows.length,1);assert.equal(l.rows[0].text,'Hello   中文');
});
test('silent laugh finishes and can be replayed from a new start time',()=>{
  const d=display();assert.equal(d.laugh(null,1000).active,false);
  assert.equal(d.laugh(1000,1300).active,true);assert.notEqual(d.laugh(1000,1300).phase,d.laugh(1000,1450).phase);
  assert.equal(d.laugh(1000,3400).active,false);assert.equal(d.laugh(4000,4100).active,true);
});
test('nailong mode survives configuration normalization and sharing',()=>{
  const c=require('../core.js');assert.equal(c.decode(c.encode({mode:'nailong'})).mode,'nailong');
});
