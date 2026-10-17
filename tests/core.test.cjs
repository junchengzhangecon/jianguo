const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
function core() {
  const p = path.join(__dirname, '../core.js');
  assert.ok(fs.existsSync(p), '计时与配置核心尚未实现');
  return require(p);
}
test('invalid settings fall back; numbers and modes are bounded', () => {
  const c = core(); const s = c.normalize({mode:'bad', speed:9999, size:-5, color:'javascript:x', minutes:0});
  assert.equal(s.mode, 'text'); assert.equal(s.speed,100); assert.equal(s.size,12);
  assert.equal(s.color,'#b8f56b'); assert.equal(s.minutes,1);
  assert.equal(c.normalize(null).text, '认真工作\n好好生活');
});
test('share links round-trip Chinese, emoji, and literal markup', () => {
  const c=core(); const s=c.normalize({text:'张老师 👋 <script> & #',scroll:false});
  assert.equal(c.decode(c.encode(s)).text,s.text);
  assert.equal(c.decode(c.encode(s)).scroll,false);
  assert.equal(c.decode('broken%%%'),null);
});
test('countdown follows elapsed wall time, not the number of ticks',()=>{
  const c=core();let t=c.newTimer(120000); t=c.start(t,1000);
  assert.equal(c.remaining(t,61000),60000); assert.equal(c.remaining(t,200000),0);
});
test('pause freezes remaining time and resume does not count the paused gap',()=>{
  const c=core();let t=c.start(c.newTimer(120000),1000); t=c.pause(t,31000);
  assert.equal(c.remaining(t,999000),90000);t=c.start(t,1000000);
  assert.equal(c.remaining(t,1030000),60000);
});
test('completion fires once and cannot silently restart a finished timer',()=>{
  const c=core();let t=c.start(c.newTimer(1000),10);let u=c.tick(t,1010);
  assert.equal(u.finished,true); assert.equal(u.timer.status,'done');
  assert.equal(c.tick(u.timer,2010).finished,false);
  assert.equal(c.start(u.timer,3010).status,'done');
});
test('timer state survives reload and corrupt timer state resets safely',()=>{
  const c=core();const t=c.start(c.newTimer(60000),1000);
  assert.equal(c.remaining(c.restoreTimer(JSON.parse(JSON.stringify(t)),60000),31000),30000);
  assert.equal(c.restoreTimer({status:'running',end:'oops'},60000).status,'idle');
});
test('format duration never renders negative or unbounded values',()=>{
  const c=core(); assert.equal(c.formatTime(61000),'01:01');assert.equal(c.formatTime(-1),'00:00');
  assert.equal(c.formatTime(3600000),'60:00');
});
test('pomodoro phases alternate only on an explicit next-phase action',()=>{
  const c=core();assert.equal(c.nextPhase('work'),'rest');assert.equal(c.nextPhase('rest'),'work');
});
