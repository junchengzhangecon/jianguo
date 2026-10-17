(function (root) {
  'use strict';
  const defaults = {mode:'text',text:'认真工作\n好好生活',color:'#b8f56b',background:'#10130f',size:24,speed:35,scroll:false,direction:'left',dots:true,minutes:5,work:25,rest:5,name:'Juncheng Zhang',role:'RESEARCHER',organization:'保持好奇 · 持续探索',status:'专注中',note:'请稍后再来',sound:false};
  const num=(v,d,min,max)=>Math.min(max,Math.max(min,Number.isFinite(Number(v))?Number(v):d));
  const text=(v,d,max)=>typeof v==='string'?Array.from(v).slice(0,max).join(''):d;
  function normalize(value){
    const s=value&&typeof value==='object'?value:{};const d=defaults;
    return {...d,mode:['text','clock','timer','pomodoro','status','badge'].includes(s.mode)?s.mode:d.mode,
      text:text(s.text,d.text,600), color:/^#[\da-f]{6}$/i.test(s.color)?s.color:d.color,
      background:/^#[\da-f]{6}$/i.test(s.background)?s.background:d.background,
      size:num(s.size,d.size,12,48),speed:num(s.speed,d.speed,5,100),scroll:typeof s.scroll==='boolean'?s.scroll:d.scroll,
      direction:s.direction==='right'?'right':'left',dots:typeof s.dots==='boolean'?s.dots:d.dots,
      minutes:num(s.minutes,d.minutes,1,180),work:num(s.work,d.work,1,120),rest:num(s.rest,d.rest,1,60),
      name:text(s.name,d.name,30),role:text(s.role,d.role,50),organization:text(s.organization,d.organization,80),
      status:text(s.status,d.status,30),note:text(s.note,d.note,100),sound:typeof s.sound==='boolean'?s.sound:false};
  }
  function encode(s){return encodeURIComponent(JSON.stringify(normalize(s)));}
  function decode(s){try{return normalize(JSON.parse(decodeURIComponent(s)));}catch(_){return null;}}
  function newTimer(duration){return {duration:Math.max(0,Number(duration)||0),left:Math.max(0,Number(duration)||0),end:null,status:'idle'};}
  function remaining(t,now){return t.status==='running'?Math.max(0,t.end-now):Math.max(0,t.left);}
  function start(t,now){return t.status==='done'||t.status==='running'?t:{...t,status:'running',end:now+t.left};}
  function pause(t,now){return t.status==='running'?{...t,left:remaining(t,now),end:null,status:'paused'}:t;}
  function tick(t,now){if(t.status==='running'&&remaining(t,now)===0)return {timer:{...t,left:0,end:null,status:'done'},finished:true};return {timer:t,finished:false};}
  function restoreTimer(t,duration){
    if(!t||!['idle','running','paused','done'].includes(t.status)||!Number.isFinite(t.duration)||t.duration<0||t.duration>10800000||!Number.isFinite(t.left)||t.left<0||t.left>t.duration||t.status==='running'&&!Number.isFinite(t.end))return newTimer(duration);
    return {duration:t.duration,left:t.left,end:t.status==='running'?t.end:null,status:t.status};
  }
  function formatTime(ms){const s=Math.ceil(Math.max(0,Number(ms)||0)/1000);return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');}
  const api={defaults,normalize,encode,decode,newTimer,remaining,start,pause,tick,restoreTimer,formatTime,nextPhase:p=>p==='work'?'rest':'work'};
  root.JianguoCore=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:window);
