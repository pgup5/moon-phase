const {spawn}=require('node:child_process');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const chrome=spawn('google-chrome',['--headless','--no-sandbox','--disable-gpu','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--no-first-run','--no-default-browser-check','--user-data-dir=/tmp/moon-pipe-qa-'+Date.now(),'--remote-debugging-pipe'],{stdio:['ignore','ignore','ignore','pipe','pipe']});
chrome.stdio[3].on('error',()=>{});chrome.stdio[4].on('error',()=>{});
let onEvent=()=>{};
let id=0,buffer='',session; const pending=new Map(),exceptions=[];
chrome.stdio[4].on('data',chunk=>{buffer+=chunk.toString();let n;while((n=buffer.indexOf('\0'))>=0){const msg=JSON.parse(buffer.slice(0,n));buffer=buffer.slice(n+1);if(msg.id){const p=pending.get(msg.id);pending.delete(msg.id);msg.error?p.reject(Error(JSON.stringify(msg.error))):p.resolve(msg.result);}if(msg.method==='Runtime.exceptionThrown')exceptions.push(msg.params.exceptionDetails);onEvent(msg);}});
function send(method,params={},sid=session){return new Promise((resolve,reject)=>{const n=++id;const timer=setTimeout(()=>reject(Error('CDP timeout: '+method)),20000);pending.set(n,{resolve:v=>{clearTimeout(timer);resolve(v)},reject:e=>{clearTimeout(timer);reject(e)}});chrome.stdio[3].write(JSON.stringify({id:n,method,params,...(sid?{sessionId:sid}:{})})+'\0');});}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
async function ready(){for(let i=0;i<100;i++){if(await evaluate(`document.documentElement?.classList.contains('mobile-layout-ready') && !!document.querySelector('#phaseName')?.textContent`))return;await delay(100);}throw Error('App did not initialize');}
async function screenshot(path){const r=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path,Buffer.from(r.data,'base64'));}
async function visible(){return evaluate(`Array.from(document.querySelectorAll('.view-panel')).filter(p=>getComputedStyle(p).display!=='none').map(p=>p.id)`);}

const base=process.env.MOON_QA_URL||'http://127.0.0.1:8765/';
const cacheVersion=fs.readFileSync(require('node:path').join(__dirname,'..','sw.js'),'utf8').match(/const CACHE = "([^"]+)"/)[1];
let launchRequests=0;
async function until(expression,label){for(let i=0;i<150;i++){if(await evaluate(expression))return;await delay(100);}throw Error('Timed out: '+label);}
function jsonResponse(requestId,value){return send('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:'*'}],body:Buffer.from(JSON.stringify(value)).toString('base64')});}
(async()=>{try{
 const target=await send('Target.createTarget',{url:'about:blank'},null);
 const attached=await send('Target.attachToTarget',{targetId:target.targetId,flatten:true},null);session=attached.sessionId;
 await send('Runtime.enable');await send('Page.enable');await send('Network.enable');
 onEvent=msg=>{
  if(msg.method!=='Fetch.requestPaused')return;
  const {requestId,request}=msg.params;
  if(request.url.includes('open-meteo')){
   const first=Math.floor(Date.now()/3600000)*3600-86400;
   jsonResponse(requestId,{hourly:{time:Array.from({length:528},(_,i)=>first+i*3600),cloud_cover:Array(528).fill(15),precipitation_probability:Array(528).fill(0)}}).catch(console.error);
  }else{
   launchRequests++;
   jsonResponse(requestId,{results:[{id:'qa',name:'Falcon 9 | QA payload',net:new Date(Date.now()+3*86400000).toISOString(),net_precision:{abbrev:'MIN'},status:{abbrev:'Go',name:'Go'},launch_service_provider:{abbrev:'SpX',name:'SpaceX'},mission:{name:'QA payload'},pad:{location:{name:'Cape Canaveral',country:{alpha_2_code:'US'}}}}]}).catch(console.error);
  }
 };
 await send('Fetch.enable',{patterns:[{urlPattern:'https://api.open-meteo.com/*'},{urlPattern:'https://ll.thespacedevs.com/*'}]});
 await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
 for(const lang of ['zh-Hant','en']){
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  const launchesBefore=launchRequests;
  await send('Page.navigate',{url:`${base}?lang=${lang}&t=2026-11-12T18:00:00`});await ready();
  assert.equal(await evaluate(`document.querySelector('#poem').nextElementSibling.id`),'tonightAdvice');
  assert.ok((await evaluate(`document.querySelector('#tonightAdvice').textContent`)).length>20);
  assert.equal(await evaluate(`document.querySelector('#globalNowBtn').hidden`),false);
  assert.ok((await evaluate(`document.querySelector('#queryStatusText').textContent`)).includes('2026'));
  assert.equal(launchRequests,launchesBefore,'launches fetched on initial Tonight view');
  assert.equal(await evaluate(`document.querySelector('#meteorChart').childElementCount`),0,'hidden meteor calculations were not deferred');
  assert.equal(await evaluate(`document.querySelector('#eclipseStatus').textContent`),'','hidden eclipse calculations were not deferred');
  await evaluate(`document.querySelector('[data-view="explore"]').click()`);
  await until(`document.querySelectorAll('.world-moon-place').length===5`,'lazy Explore render');
  assert.equal(await evaluate(`document.querySelectorAll('.explore-shortcuts a').length`),7);
  assert.equal(await evaluate(`document.querySelector('#meteorMore').open`),false);
  assert.equal(await evaluate(`document.querySelector('#worldMoonMore').open`),false);
  assert.equal(await evaluate(`document.querySelector('#launchMore').open`),false);
  assert.ok(await evaluate(`document.querySelector('#meteorSummary').textContent.length>10`));
  await until(`document.querySelector('#launchSummary').textContent.includes('QA payload')`,'launch summary');
  for(const id of ['birthdaySection','moonExplorer','neighborsCard','meteorCard','worldMoonCard','tidesCard','launchSection']){
   await evaluate(`document.querySelector('.explore-shortcuts a[href="#${id}"]').click()`);
   assert.equal(await evaluate(`document.activeElement.closest('section').id`),id);
  }
  await evaluate(`document.querySelector('#meteorMore').open=true;document.querySelector('#worldMoonMore').open=true`);
  assert.ok(await evaluate(`document.querySelector('#meteorChart polyline')!==null`));
  await evaluate(`document.querySelector('#cardDate').value='2026-10-30';document.querySelector('#cardBtn').click()`);
  await until(`document.querySelector('#cardImg').src.startsWith('data:image/png')`,'birthday card after deferred 3D import');
  await evaluate(`document.querySelector('[data-view="calendar"]').click()`);
  await until(`document.querySelector('.eclipse-table tbody tr')!==null`,'lazy eclipse');
  assert.equal(await evaluate(`document.querySelector('#eclipseMore').open`),false);
  assert.equal(await evaluate(`document.querySelector('#viewingWeekMore').open`),false);
  assert.ok(await evaluate(`document.querySelector('#viewingWeekSummary').textContent.length>10`));
  await evaluate(`document.querySelector('#eclipseMore').open=true;document.querySelector('#viewingWeekMore').open=true;document.querySelector('[data-week-time]').click()`);
  await until(`document.querySelector('#view-tonight').classList.contains('is-active')`,'week jump');
  assert.ok((await evaluate(`document.querySelector('#queryStatusText').textContent`)).includes(lang==='en'?'Viewing':'正在查看'));
  await evaluate(`document.querySelector('#globalNowBtn').click()`);
  await until(`document.querySelector('#globalNowBtn').hidden`,'return to live');
  await until(`document.querySelector('#tonightAdvice').textContent.includes('${lang==='en'?'forecast':'天氣預報'}')`,'weather-aware advice');
  for(const [width,height] of [[320,568],[360,800],[390,844],[412,915],[430,932],[844,390]]){
   await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});
   for(const key of ['tonight','plan','explore','calendar']){
    await evaluate(`document.querySelector('[data-view="${key}"]').click()`);
    await delay(50);
    assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`),true,`${lang} ${width} ${key} overflow`);
   }
  }
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await evaluate(`document.querySelector('[data-view="tonight"]').click();document.querySelector('#moonStage').scrollIntoView({block:'center'})`);
  await until(`!!document.querySelector('#moonStage canvas')`,'WebGL Moon');
  const rect=await evaluate(`(()=>{const r=document.querySelector('#moonStage').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:rect.x,y:rect.y}]});
  await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:rect.x+30,y:rect.y+15}]});
  await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await delay(100);
  assert.ok(await evaluate(`document.querySelector('#queryStatus').getBoundingClientRect().top>=-1`),'sticky context');
  await evaluate(`document.querySelector('#poem').scrollIntoView({block:'start'})`);
  await screenshot(`/tmp/moon-usability-${lang}.png`);
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await send('Emulation.setCPUThrottlingRate',{rate:4});
  await send('Page.navigate',{url:`${base}?lang=${lang}`});await ready();
  await evaluate(`document.querySelector('[data-view="explore"]').click()`);await until(`document.querySelectorAll('.world-moon-place').length===5`,'4x CPU lazy render');
  await send('Emulation.setCPUThrottlingRate',{rate:1});
  await send('Emulation.setEmulatedMedia',{features:[]});
  await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});await delay(100);
  assert.equal((await visible()).length,4);
  console.log(`PASS ${lang}: date/reset, recommendation placement and weather, 7 shortcuts, summary disclosure, lazy work/requests, card generation, touch drag, 6 viewport sizes, reduced motion, 4x CPU, desktop`);
 }
 await send('Browser.grantPermissions',{origin:base.replace(/\/$/,''),permissions:['geolocation']},null);
 await send('Emulation.setGeolocationOverride',{latitude:35.6762,longitude:139.6503,accuracy:50});
 await evaluate(`document.querySelector('#locBtn').click()`);
 await until(`document.querySelector('#locName').textContent.includes('35.68')`,'geolocation update');
 await evaluate(`navigator.serviceWorker.ready`);
 await until(`caches.has(${JSON.stringify(cacheVersion)})`,'offline cache');
 await until(`caches.match(new URL('js/viewing-advice.js',location.href)).then(Boolean)`,'new offline module');
 await send('Fetch.disable');
 await send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
 await send('Page.reload');await ready();
 await evaluate(`document.querySelector('[data-view="explore"]').click()`);
 await until(`document.querySelectorAll('.world-moon-place').length===5`,'offline Explore');
 assert.ok((await evaluate(`document.querySelector('#tonightAdvice').textContent`)).length>20);
 assert.equal(exceptions.length,0,JSON.stringify(exceptions));
 console.log('PASS: geolocation, offline reload/calculations and no JavaScript exceptions');
}finally{chrome.kill();}})().catch(e=>{console.error(e);process.exitCode=1;});
