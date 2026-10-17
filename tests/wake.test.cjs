const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
function controller(env){assert.ok(fs.existsSync(require('node:path').join(__dirname,'../wake.js')),'防息屏控制器尚未实现');return require('../wake.js').createController(env);}
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
function lock(){const events={};return {released:false,addEventListener:(k,f)=>events[k]=f,async release(){this.released=true;if(events.release)events.release();}};}
function video(){const events={};return {paused:true,muted:true,plays:0,removed:false,addEventListener:(k,f)=>events[k]=f,emit:k=>{if(events[k])events[k]();},async play(){this.plays++;this.paused=false;},pause(){this.paused=true;if(events.pause)events.pause();},remove(){this.removed=true;}};}
test('auto native requests are deduplicated and closing releases the active lock',async()=>{
  const gate=deferred(),l=lock();let calls=0;const c=controller({requestNative:()=>{calls++;return gate.promise;}});
  const a=c.setMode('auto'),b=c.resume({gesture:true});assert.equal(calls,1);gate.resolve(l);await Promise.all([a,b]);assert.equal(c.getStatus().method,'native');
  await c.setMode('off');assert.equal(l.released,true);assert.equal(c.getStatus().method,'off');
});
test('a native request resolving after off is released instead of leaking',async()=>{
  const gate=deferred(),l=lock(),c=controller({requestNative:()=>gate.promise});const pending=c.setMode('auto');await c.setMode('off');gate.resolve(l);await pending;
  assert.equal(l.released,true);assert.equal(c.getStatus().method,'off');
});
test('compat starts video immediately inside the click, and does not claim a native lock',async()=>{
  const v=video(),c=controller({makeVideo:()=>v});const done=c.setMode('compat',{gesture:true});assert.equal(v.plays,1);await done;assert.equal(c.getStatus().method,'video');
  await c.setMode('off');assert.equal(v.paused,true);assert.equal(v.removed,true);
});
test('legacy auto mode waits for a tap instead of pretending to stay awake',async()=>{
  const v=video(),c=controller({makeVideo:()=>v});await c.setMode('auto');assert.equal(v.plays,0);assert.equal(c.getStatus().method,'needs-gesture');
  await c.resume({gesture:true});assert.equal(v.plays,1);assert.equal(c.getStatus().method,'video');
});
test('a rejected video play is an error, never a successful keep-awake status',async()=>{
  const v=video();v.play=()=>Promise.reject(new Error('NotAllowedError'));const c=controller({makeVideo:()=>v});await c.setMode('compat',{gesture:true});
  assert.equal(c.getStatus().method,'failed');assert.equal(c.getStatus().videoActive,false);
});
test('compat keeps native success even if the optional video fails',async()=>{
  const v=video();v.play=()=>Promise.reject(new Error('blocked'));const l=lock(),c=controller({requestNative:async()=>l,makeVideo:()=>v});await c.setMode('compat',{gesture:true});assert.equal(c.getStatus().method,'native');
  await c.setMode('off');
});
test('background suspends both resources; foreground restores only when visible',async()=>{
  let visible=true;const ls=[],vs=[];const c=controller({isVisible:()=>visible,requestNative:async()=>{const l=lock();ls.push(l);return l;},makeVideo:()=>{const v=video();vs.push(v);return v;}});
  await c.setMode('compat',{gesture:true});assert.equal(c.getStatus().method,'dual');visible=false;c.suspend();assert.equal(ls[0].released,true);assert.equal(vs[0].paused,true);assert.equal(c.getStatus().method,'paused');
  await c.resume();assert.equal(ls.length,1);visible=true;await c.resume();assert.equal(ls.length,2);assert.equal(c.getStatus().method,'dual');await c.setMode('off');
});
test('unexpected native releases retry at most twice, without duplicate locks',async()=>{
  let queued=[],calls=0;const ls=[];const c=controller({requestNative:async()=>{calls++;const l=lock();ls.push(l);return l;},schedule:f=>{queued.push(f);return f;},cancel:id=>{queued=queued.filter(f=>f!==id);}});
  await c.setMode('auto');for(let i=0;i<3;i++){await ls.at(-1).release();if(queued.length)await queued.shift()();}
  assert.equal(calls,3);assert.equal(queued.length,0);assert.equal(c.getStatus().nativeActive,false);await c.setMode('off');
});
test('native refusal reports failure without an automatic retry loop',async()=>{
  let calls=0;const c=controller({requestNative:async()=>{calls++;throw new Error('power saver');}});await c.setMode('auto');assert.equal(calls,1);assert.equal(c.getStatus().method,'failed');await c.setMode('off');
});
test('a late old video play cannot stop or activate a newer session',async()=>{
  const gate=deferred(),old=video(),current=video();old.play=()=>{old.paused=false;return gate.promise;};let n=0;const c=controller({makeVideo:()=>n++?current:old});const pending=c.setMode('compat',{gesture:true});await c.setMode('off');await c.setMode('compat',{gesture:true});gate.resolve();await pending;
  assert.equal(old.paused,true);assert.equal(current.paused,false);assert.equal(c.getStatus().method,'video');await c.setMode('off');
});
test('cancelled retry callbacks cannot request locks in a newer generation',async()=>{
  const queued=[],cancelled=new Set(),locks=[];let calls=0;
  const c=controller({requestNative:async()=>{calls++;const l=lock();locks.push(l);return l;},schedule:f=>{queued.push(f);return f;},cancel:f=>cancelled.add(f)});
  await c.setMode('auto');await locks.at(-1).release();const stale=queued.at(-1);await c.resume();await locks.at(-1).release();await c.setMode('off');await c.setMode('auto');await locks.at(-1).release();
  const before=calls;await stale();assert.equal(calls,before,'旧重试不得在新会话产生额外申请');assert.ok(cancelled.has(stale));await c.setMode('off');
});
test('media error settles a never-resolving play and retry creates a fresh video',async()=>{
  const gate=deferred(),broken=video(),fresh=video();broken.play=()=>gate.promise;let made=0;
  const c=controller({makeVideo:()=>made++?fresh:broken});const pending=c.setMode('compat',{gesture:true});broken.emit('error');
  const done=await Promise.race([pending.then(()=>'settled'),new Promise(r=>setTimeout(()=>r('timeout'),30))]);assert.equal(done,'settled','媒体失败不应永久 pending');assert.equal(c.getStatus().method,'failed');
  await c.resume({gesture:true});assert.equal(made,2);assert.equal(c.getStatus().method,'video');await c.setMode('off');
});
