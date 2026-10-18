const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../core.js');
test('营业模式七个预设，旧设置保留，独立滚动可分享',()=>{
  assert.equal(C.businessPresets.length,7);
  const old=C.normalize({scroll:false,text:'旧文字'});
  assert.equal(old.businessScroll,true);assert.equal(old.text,'旧文字');
  const s=C.normalize({mode:'business',businessState:'paused',businessLang:'both',businessNote:'稍后回来',businessEmoji:true,businessScroll:false,scroll:true});
  assert.equal(s.mode,'business');assert.match(C.businessText(s),/⏸️ 暂停服务 · Out of Service/);
  assert.match(C.businessText(s),/稍后回来/);assert.deepEqual(C.decode(C.encode(s)),s);
  assert.equal(C.normalize({businessState:'bad',businessLang:'bad'}).businessState,'open');
  assert.equal(C.normalize({businessState:'bad',businessLang:'bad'}).businessLang,'both');
  assert.equal(C.businessText(C.normalize({businessState:'break',businessLang:'en',businessEmoji:false})),'On Break');
  assert.equal(C.businessText(C.normalize({businessState:'open',businessLang:'zh',businessEmoji:false})),'欢迎交流');
});
