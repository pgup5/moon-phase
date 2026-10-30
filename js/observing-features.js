import { locale,tr } from './i18n.js';
import { moonState,moonPosition,sunPosition } from './astro.js';
import { PLACES,SHOWERS,nextShower,referencePeak,meteorNight,localMoon,moonDiskSVG,tideModel,observingChallenge } from './observing.js';
const en=locale==='en-US',t=(zh,english)=>en?english:zh,$=id=>document.getElementById(id);
const fmt=d=>new Date(d).toLocaleString(locale,{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false});
const dayKey=d=>`${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
const safeRead=key=>{try{return localStorage.getItem(key);}catch{return null;}};
const CHALLENGES={
  dark:[['找出天空最暗的時段','Find a moon-free sky'],['今晚改觀察星空：先查看無月光時段，再找一處遠離路燈的位置，記錄能辨認多少顆星。','Try the stars tonight: check the moon-free windows, find a spot away from street lights, and note how many stars you can identify.'],'darknessCard'],
  earthshine:[['找出亮眉月抱著的暗月球','Find the dim disk inside the crescent'],['先看亮眉月，再試著辨認暗側的完整輪廓。曙暮光時較適合嘗試，可先查看地球照候選時段。','Find the bright crescent, then try tracing the full outline of its dim side. Try twilight and check the earthshine candidate windows.'],'earthshineCard'],
  seas:[['找出月面上的深色月海','Find the dark lunar seas'],['用肉眼比較月面深淺，試著在示意圖找出寧靜海與雨海的位置。把你看到的形狀畫下來。','Compare the light and dark areas by eye. Use the map to locate Mare Tranquillitatis and Mare Imbrium, then sketch their shapes.'],'moonExplorer'],
  rays:[['尋找第谷隕石坑的輻射紋','Find Tycho’s rays'],['用雙筒鏡辨認月球南部的亮點與向外延伸的亮紋，再和月面探索圖比對。可以靠穩手肘減少晃動。','With binoculars, look for a bright spot and outward streaks in the Moon’s south, then compare with the explorer map. Rest your elbows to steady the view.'],'moonExplorer'],
  terminator:[['沿著明暗交界尋找地形陰影','Trace shadows along the terminator'],['用雙筒鏡沿著亮面與暗面的交界慢慢看，找出凹凸不平的輪廓；畫下最明顯的一處陰影。','Slowly scan the boundary between light and dark with binoculars. Find its uneven outline and sketch one prominent shadow.'],'moonExplorer'],
  shape:[['畫下月亮的亮面與方向','Sketch the illuminated side'],['用肉眼畫下亮面朝向與月亮在地景上方的位置，約一小時後再比對；也可看看五個地點的同一輪月亮。','Sketch which way the illuminated side points and where the Moon sits above the landscape. Compare about an hour later, or explore the same Moon from five places.'],'worldMoonCard'],
};
export function initObservingFeatures(context){
  $('meteorCard').innerHTML=`<h2>${t('流星雨觀賞指南','Meteor shower guide')}</h2><p class="when">${t('挑選流星雨，看看所選夜晚的輻射點高度與月光條件。','Choose a shower to check radiant altitude and moonlight on the selected night.')}</p><div class="row"><label for="meteorShower">${t('流星雨','Shower')}</label><select id="meteorShower">${SHOWERS.map(s=>`<option value="${s.id}">${en?s.en:s.zh}</option>`).join('')}</select></div><p id="meteorSeason" class="when"></p><button type="button" id="meteorPeak">${t('查看參考高峰日','View reference peak day')}</button><p id="meteorContext" class="when"></p><p id="meteorStatus" class="night-status" role="status"></p><p id="meteorRise" class="when"></p><p id="meteorSummary" class="feature-summary"></p><details id="meteorMore" class="feature-more"><summary>${t('完整時段與高度圖','All windows and altitude chart')}</summary><svg id="meteorChart" class="meteor-chart" viewBox="0 0 420 180" role="img" aria-label="${t('所選夜晚輻射點高度圖','Radiant altitude through the selected night')}"></svg><div id="meteorWindows" class="list"></div><p>${t('用肉眼看一大片天空，找開闊、少光害的位置；不必一直盯著輻射點。避開月亮方向，給眼睛時間適應黑暗。','Watch a broad area of sky by eye from an open location with little light pollution. You do not need to stare at the radiant. Face away from the Moon and allow time for dark adaptation.')}</p></details><p class="src">${t('活動期與高峰日期是年度規劃參考，不是逐年精確極大或爆發預報。輻射點採高峰附近的固定 J2000 座標，未計每日漂移；每 5 分鐘取樣，候選時段要求太陽低於 −18°、輻射點至少 20°。優先無月光時段；未納入天氣，不預測每小時可見顆數。','Activity periods and peak dates are annual planning references, not exact yearly maxima or outburst forecasts. Radiants use fixed near-peak J2000 coordinates without daily drift. Sampled every 5 minutes; candidate windows require Sun below −18° and radiant at least 20°. Moon-free windows are prioritized; weather and visible meteor counts are not predicted.')} <a href="https://www.imo.net/calendar/" target="_blank" rel="noopener">IMO</a></p>`;
  $('worldMoonCard').innerHTML=`<h2>${t('同一輪月亮，不同地方看','One Moon, different places')}</h2><p class="when">${t('同一個瞬間，比較各地的當地時間、月亮位置與亮面朝向。','Compare local times, lunar positions and bright-side orientation at one shared instant.')}</p><p id="worldMoonTime" class="when"></p><label for="worldMoonOffset">${t('比較時間偏移（小時）','Comparison time offset (hours)')}</label><div class="row"><input id="worldMoonOffset" type="range" min="-12" max="12" step="1" value="0"><output id="worldMoonOffsetLabel" for="worldMoonOffset">0</output><button type="button" id="worldMoonReset">${t('回到所選時間','Reset to selected time')}</button></div><p id="worldMoonSummary" class="feature-summary"></p><details id="worldMoonMore" class="feature-more"><summary>${t('展開五個地點的月亮','Compare all five places')}</summary><div id="worldMoonGrid" class="world-moon-grid"></div></details><p class="src">${t('月面為等大小示意，上方是各地天頂，右方是方位角增加的方向；不是望遠鏡視角，也不表示月亮實際大小不同。地平線下的月亮只供比較。接近新月、滿月或天頂時不顯示亮面傾角。北極使用 90°N、0° 經線與 UTC 作比較基準；方位依經線慣例而定。北極可有極晝、極夜及長時間不升不落的月亮。支援 1900–2100 年。','Equal-size lunar diagrams: up is the local zenith, right is increasing azimuth. These are not telescope views or differences in apparent size. A Moon below the horizon is shown for comparison only. Bright-side tilt is omitted near new/full Moon or the zenith. At the North Pole, 90°N, the 0° meridian and UTC define the comparison reference; bearing depends on this convention. Polar day/night and long intervals without moonrise or moonset can occur. Supports 1900–2100.')} <a href="https://github.com/cosinekitty/astronomy" target="_blank" rel="noopener">Astronomy Engine</a></p>`;
  $('tidesCard').innerHTML=`<h2>${t('月亮與潮汐','The Moon and tides')}</h2><p>${t('拖曳月相，觀察太陽與月亮的潮汐作用如何疊加。新月、滿月附近傾向大潮，上下弦附近傾向小潮。','Move the phase slider to see how lunar and solar tidal effects combine. Spring tides tend to occur near new/full Moon, neap tides near the quarters.')}</p><label for="tidePhase">${t('示意月相角度','Illustrative phase angle')}</label><input id="tidePhase" type="range" min="0" max="360" step="1" value="0"><div class="tide-presets row">${[[0,t('新月','New')],[90,t('上弦','First quarter')],[180,t('滿月','Full')],[270,t('下弦','Last quarter')]].map(([v,label])=>`<button type="button" data-tide-phase="${v}">${label}</button>`).join('')}<button type="button" id="tideReset">${t('跟隨所選月相','Use selected Moon phase')}</button></div><svg id="tideDiagram" class="tide-diagram" viewBox="0 0 420 280" role="img" aria-label="${t('日月潮汐作用示意圖','Illustration of lunar and solar tidal effects')}"></svg><p id="tideStatus" class="night-status" role="status"></p><p class="when">${t('藍色：月球作用；金色：太陽作用；白色：合成趨勢。潮汐隆起在地球兩側，並非只有朝向月球的一側。','Blue: lunar effect; gold: solar effect; white: combined tendency. Tidal bulges occur on both sides of Earth, not only toward the Moon.')}</p><p class="src">${t('理想化平衡潮示意，大小不按比例；相對指標以太陽潮汐作用約為月球的 0.46 倍計算，不含距離、傾角、海盆、海岸、潮汐延遲或天氣。不能當作港口潮時、潮高或海邊活動依據。實際大潮、小潮時間可能落後月相。','Idealized equilibrium-tide illustration, not to scale. The relative index uses a solar tidal contribution of about 0.46 of the lunar one, excluding distance, declination, ocean basins, coasts, tidal lags and weather. It does not predict local tide times/heights or coastal conditions. Actual spring/neap tides may lag lunar phases.')} <a href="https://science.nasa.gov/moon/tides/" target="_blank" rel="noopener">NASA</a> · <a href="https://www.noaa.gov/jetstream/ocean/tides" target="_blank" rel="noopener">NOAA</a></p>`;
  $('challengeCard').innerHTML=`<h2 id="challengeTitle">${t('今晚觀察挑戰','Tonight’s observing challenge')}</h2><p id="challengeContext" class="when"></p><div class="row"><label for="challengeEquipment">${t('觀察方式','Equipment')}</label><select id="challengeEquipment"><option value="eye">${t('肉眼','Unaided eye')}</option><option value="binoculars">${t('雙筒鏡','Binoculars')}</option></select></div><h3 id="challengeTask"></h3><p id="challengeInstructions"></p><p id="challengeVisibility" class="night-status"></p><button type="button" id="challengeExplore">${t('查看提示','Explore hints')}</button><label class="challenge-done"><input id="challengeDone" type="checkbox">${t('我完成了這個挑戰（儲存在此裝置）','I completed this challenge (saved on this device)')}</label><p id="challengeSaved" class="when" role="status"></p>`;
  let meteorKey='',worldKey='',challengeKey='',challengeTarget='',manualTide=false,tideKey='';
  let chosenShower=false;
  const selectedShower=()=>SHOWERS.find(s=>s.id===$('meteorShower').value);
  $('meteorShower').value=nextShower(context.date()).id;
  $('meteorShower').onchange=()=>{chosenShower=true;meteorKey='';update();};
  $('meteorPeak').onclick=()=>{context.jump(referencePeak(selectedShower(),context.date()),'meteorCard');};
  $('meteorWindows').onclick=event=>{const b=event.target.closest('[data-meteor-time]');if(b)context.jump(new Date(+b.dataset.meteorTime),'meteorCard');};
  $('worldMoonOffset').oninput=()=>{worldKey='';updateWorld(context.date());};
  $('worldMoonReset').onclick=()=>{$('worldMoonOffset').value=0;worldKey='';updateWorld(context.date());};
  $('tidePhase').oninput=()=>{manualTide=true;updateTides(context.date());};
  $('tidesCard').addEventListener('click',event=>{const b=event.target.closest('[data-tide-phase]');if(b){manualTide=true;$('tidePhase').value=b.dataset.tidePhase;updateTides(context.date());}});
  $('tideReset').onclick=()=>{manualTide=false;updateTides(context.date());};
  $('challengeEquipment').onchange=()=>{challengeKey='';updateChallenge(context.date(),context.location());};
  $('challengeExplore').onclick=()=>context.reveal(challengeTarget);
  $('challengeDone').onchange=()=>{try{if($('challengeDone').checked)localStorage.setItem(challengeKey,'done');else localStorage.removeItem(challengeKey);$('challengeSaved').textContent=$('challengeDone').checked?t('已記錄完成。','Completion recorded.'):'';}catch{$('challengeSaved').textContent=t('目前無法儲存到此裝置。','Unable to save on this device.');}};
  function updateWorld(date){
    const d=new Date(+date+Number($('worldMoonOffset').value)*3600000),key=`${Math.floor(+d/60000)}`;
    if(worldKey===key)return;worldKey=key;
    $('worldMoonOffsetLabel').textContent=`${+$('worldMoonOffset').value>=0?'+':''}${$('worldMoonOffset').value} h`;
    $('worldMoonTime').textContent=`${t('比較瞬間：','Shared instant: ')}${d.toISOString().slice(0,16).replace('T',' ')} UTC`;
    if(d.getUTCFullYear()<1900||d.getUTCFullYear()>2100){$('worldMoonGrid').textContent=t('比較功能支援 1900–2100 年，請切換日期。','Comparison supports 1900–2100; choose another date.');return;}
    const comparisons=PLACES.map(place=>localMoon(d,place));
    const above=comparisons.filter(m=>m.alt>0).length;
    $('worldMoonSummary').textContent=t(`五個地點中有 ${above} 處月亮在地平線上；展開可比較當地時間與亮面朝向。`, `The Moon is above the horizon at ${above} of five places; expand to compare local times and orientation.`);
    $('worldMoonGrid').innerHTML=comparisons.map(m=>{const place=m,name=en?place.en:place.zh,local=d.toLocaleString(locale,{timeZone:place.tz,month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false});return `<article class="world-moon-place${m.alt<=0?' below-horizon':''}"><h3>${name}</h3><p class="when">${local}<br><small>${place.tz}</small></p>${moonDiskSVG(m.illumination,m.angle,t('亮面朝向示意，天頂在上','Bright-side orientation, zenith up'))}<p>${t('高度','Altitude')} ${m.alt.toFixed(1)}°<br>${t('方位','Bearing')} ${m.az.toFixed(0)}°</p><p class="when">${m.alt<=0?t('地平線下','Below horizon'):t('地平線上','Above horizon')} · ${m.sunAlt>0?t('白天','Daylight'):t('太陽已落下','Sun below horizon')}</p><small>${m.angle===null?t('此刻傾角不易辨識','Tilt indistinct now'):t(`亮面朝向 ${m.angle.toFixed(0)}°（由上順時針）`,`Bright-side direction ${m.angle.toFixed(0)}° clockwise from up`)}</small></article>`;}).join('');
  }
  function updateTides(date){
    const elong=manualTide?Number($('tidePhase').value):moonState(date).elong;
    if(!manualTide)$('tidePhase').value=Math.round(elong);
    const model=tideModel(elong),a=elong*Math.PI/180,mx=170+104*Math.cos(a),my=140-104*Math.sin(a);
    $('tideDiagram').innerHTML=`<path d="M170 140H379" stroke="#ffd98a" stroke-dasharray="4 5" opacity=".5"/><circle cx="379" cy="140" r="21" fill="#ffd98a"/><text x="379" y="178" fill="currentColor" text-anchor="middle">${t('太陽','Sun')}</text><circle cx="170" cy="140" r="104" fill="none" stroke="#6d779d" stroke-dasharray="3 7"/><ellipse cx="170" cy="140" rx="57" ry="44" fill="none" stroke="#ffd98a" stroke-width="2"/><ellipse cx="170" cy="140" rx="73" ry="42" fill="none" stroke="#82b6ff" stroke-width="2" transform="rotate(${-elong} 170 140)"/><ellipse cx="170" cy="140" rx="${45+31*model.relative}" ry="${45-9*model.relative}" fill="none" stroke="#fff" stroke-width="2" transform="rotate(${-model.angle} 170 140)"/><circle cx="170" cy="140" r="32" fill="#344f83"/><text x="170" y="145" text-anchor="middle" fill="#fff">${t('地球','Earth')}</text><circle cx="${mx}" cy="${my}" r="11" fill="#e8e0cf"/><text x="${mx}" y="${my-18}" text-anchor="middle" fill="currentColor">${t('月球','Moon')}</text>`;
    const kind=model.kind==='spring'?t('接近大潮配置','Near a spring-tide configuration'):model.kind==='neap'?t('接近小潮配置','Near a neap-tide configuration'):t('大潮與小潮之間','Between spring and neap');
    $('tideStatus').textContent=`${manualTide?t('互動示意','Interactive preview'):t('所選月相','Selected Moon phase')} · ${Math.round(elong)}° · ${kind} · ${t('相對指標','Relative index')} ${model.relative.toFixed(2)}`;
  }
  function updateChallenge(date,loc){
    const ms=moonState(date),kind=observingChallenge(ms.illum,$('challengeEquipment').value),challenge=CHALLENGES[kind],key=`moon.challenge:${dayKey(date)}:${kind}:${$('challengeEquipment').value}`;
    if(challengeKey!==key){challengeKey=key;challengeTarget=challenge[2];$('challengeTask').textContent=challenge[0][en?1:0];$('challengeInstructions').textContent=challenge[1][en?1:0];$('challengeDone').checked=safeRead(key)==='done';$('challengeSaved').textContent=$('challengeDone').checked?t('這個挑戰已完成。','This challenge is complete.'):'';}
    $('challengeTitle').textContent=dayKey(date)===dayKey(new Date())?t('今晚觀察挑戰','Tonight’s observing challenge'):t('所選夜晚觀察挑戰','Selected night’s observing challenge');
    $('challengeContext').textContent=`${fmt(date)} · ${tr(loc.name)}`;
    const alt=moonPosition(date,loc.lat,loc.lon).alt,sun=sunPosition(date,loc.lat,loc.lon).alt;
    $('challengeVisibility').textContent=kind==='dark'?t('接近新月，今晚把目光轉向星空；是否夠暗仍依時間與地點而定。','Near new Moon, turn to the stars; darkness still depends on time and place.')
      :alt<=0?t('月亮目前在地平線下，可先看提示，等待月出或換個時間。','The Moon is below the horizon. Explore the hints first, then wait for moonrise or choose another time.')
      :sun>0?t('目前是白天，月面對比較低；可先畫下位置，或等天色轉暗再試。','It is daylight, so lunar contrast is lower. Sketch its position or try again after dark.')
      :alt<10?t('月亮偏低，先確認地景沒有遮擋，再試著觀察。','The Moon is low; check for foreground obstructions before observing.')
      :t('月亮在地平線上，實際可見程度仍依雲量與大氣狀況。','The Moon is above the horizon; clouds and atmospheric conditions still affect visibility.');
  }
  function updateMeteors(date,loc){
    const key=`${dayKey(date)}:${loc.lat}:${loc.lon}:${$('meteorShower').value}`;
    if(meteorKey===key)return;
    if(!chosenShower)$('meteorShower').value=nextShower(date).id;
    meteorKey=`${dayKey(date)}:${loc.lat}:${loc.lon}:${$('meteorShower').value}`;
    const shower=selectedShower(),night=meteorNight(date,loc.lat,loc.lon,shower);
    const period=shower.period.map(([m,d])=>`${m}/${d}`).join(' — ');
    $('meteorSeason').textContent=t(`年度參考活動期：${period}；高峰約 ${shower.range}。`,`Annual reference activity: ${period}; peak around ${shower.range}.`);
    $('meteorContext').textContent=`${tr(loc.name)} · ${fmt(night.start)} — ${fmt(night.end)}`;
    $('meteorStatus').textContent=(!night.active?t('所選日期不在這場流星雨的參考活動期；下方只顯示幾何條件。','The selected date is outside this shower’s reference activity period; only geometric conditions are shown below.')+' ':'')+(night.best?t('有符合黑夜與輻射點高度條件的候選時段。','Candidate windows meet the darkness and radiant-altitude criteria.'):t('這晚沒有同時符合完整天文夜與輻射點高度至少 20° 的時段。','No window combines astronomical night with radiant altitude of at least 20°.'));
    const rising=night.samples.findIndex((p,i)=>i>0&&night.samples[i-1].radiant<=0&&p.radiant>0);
    const rise=rising>0?(()=>{const a=night.samples[rising-1],b=night.samples[rising];return a.time+(b.time-a.time)*(-a.radiant)/(b.radiant-a.radiant);})():null;
    $('meteorRise').textContent=rise!==null?t(`輻射點約在 ${fmt(rise)} 升起。`,`Radiant rises around ${fmt(rise)}.`):night.samples.every(p=>p.radiant<=0)?t('輻射點在整段時間都位於地平線下。','The radiant stays below the horizon throughout this interval.'):t('這段時間沒有輻射點升起事件；開始時已在地平線上。','No radiant rise occurs in this interval; it is already above the horizon at the start.');
    const points=night.samples.map(s=>`${40+(s.time-night.start)/(night.end-night.start)*365},${135-Math.max(-15,s.radiant)/90*95}`).join(' ');
    const best=night.best;
    $('meteorSummary').textContent=best?t(`參考時段：${fmt(best.start)} — ${fmt(best.end)}，${best.moonfree?'月亮在地平線下':'月亮在地平線上'}。`, `Reference window: ${fmt(best.start)} — ${fmt(best.end)}; Moon ${best.moonfree?'below':'above'} the horizon.`):t('這晚沒有符合條件的觀賞時段。','No qualifying observing window this night.');
    $('meteorChart').innerHTML=`<path d="M40 25V135H405" fill="none" stroke="#8b94b5"/><path d="M40 ${135-20/90*95}H405" stroke="#8b94b5" stroke-dasharray="4 4"/><text x="3" y="${135-20/90*95+4}" fill="currentColor" font-size="11">20°</text><text x="5" y="40" fill="currentColor" font-size="11">90°</text><polyline points="${points}" fill="none" stroke="#ffd98a" stroke-width="2"/><text x="40" y="169" fill="currentColor" font-size="11">${fmt(night.start)}</text><text x="405" y="169" text-anchor="end" fill="currentColor" font-size="11">${fmt(night.end)}</text>`;
    $('meteorWindows').innerHTML=night.windows.length?[...night.windows].sort((a,b)=>Number(b===best)-Number(a===best)||a.start-b.start).map(w=>`<div class="item"><span>${w===best?`<span class="badge">${t('優先參考','First choice')}</span><br>`:''}${fmt(w.start)} — ${fmt(w.end)}<br><small>${w.moonfree?t('月亮在地平線下','Moon below horizon'):t(`月亮在地平線上；參考時刻照明 ${(w.best.illumination*100).toFixed(0)}%`,`Moon above horizon; ${(w.best.illumination*100).toFixed(0)}% illuminated at reference time`)}<br>${t('參考輻射點高度','Reference radiant altitude')} ${w.best.radiant.toFixed(0)}°</small></span><button type="button" data-meteor-time="${w.best.time}">${t('查看此時','View time')}</button></div>`).join(''):'';
  }
  function update(){
    const date=context.date(),loc=context.location(),visible=id=>!context.visible||context.visible(id);
    if(visible('meteorCard'))updateMeteors(date,loc);
    if(visible('worldMoonCard'))updateWorld(date);
    if(visible('challengeCard'))updateChallenge(date,loc);
    const key=Math.floor(+date/60000);
    if(visible('tidesCard')&&tideKey!==key){tideKey=key;updateTides(date);}
  }
  return {update};
}
