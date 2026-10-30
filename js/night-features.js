import { locale, tr } from './i18n.js';
import { moonState, moonPosition, sunPosition } from './astro.js';
import { nightConditions, moonNeighbors, skyCategory, earthshinePhase } from './night-sky.js';
const en=locale==='en-US',t=(zh,english)=>en?english:zh,$=id=>document.getElementById(id);
const dateTime=d=>new Date(d).toLocaleString(locale,{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false});
const categories={day:t('白天','Daylight'),civil:t('民用暮光','Civil twilight'),nautical:t('航海暮光','Nautical twilight'),astronomical:t('天文暮光','Astronomical twilight'),moonlit:t('天文夜・有月光','Astronomical night · Moon up'),moonless:t('天文夜・無月光','Astronomical night · Moon down')};
const duration=m=>en?`${Math.floor(m/60)} h ${m%60} min`:`${Math.floor(m/60)} 小時 ${m%60} 分鐘`;
export function initNightFeatures(context){
  $('darknessCard').innerHTML=`<h2>${t('今晚有多暗？','How dark is tonight?')}</h2><p id="darknessContext" class="when"></p><p id="darknessNow" role="status" class="night-status"></p><div id="darknessTimeline" class="darkness-timeline" role="img"></div><div class="darkness-legend">${Object.entries(categories).map(([key,label])=>`<span><i class="sky-${key}"></i>${label}</span>`).join('')}</div><p id="darknessTotal" class="when"></p><h3>${t('無月光的觀星時段','Moon-free stargazing windows')}</h3><div id="darknessWindows" class="list"></div><p class="src">${t('中午至隔日中午，每分鐘取樣。天文夜：太陽中心低於 −18°；無月光：同時月心高度低於 −0.833°。時間約精確至 1 分鐘，依裝置時區顯示。這是幾何條件，未計光害、雲量與地形，不是實測天空亮度。','Local noon to the following noon, sampled every minute. Astronomical night: Sun center below −18°; moon-free: Moon center also below −0.833°. Times are approximate to one minute in your device time zone. These are geometric conditions, not measured sky brightness; light pollution, clouds and terrain are excluded.')} <a href="https://aa.usno.navy.mil/faq/RST_defs" target="_blank" rel="noopener">USNO</a></p>`;
  $('neighborsCard').innerHTML=`<h2>${t('月亮旁邊是誰？','Who is next to the Moon?')}</h2><p id="neighborsContext" class="when"></p><div class="row"><label for="neighborRadius">${t('搜尋角距','Search radius')}</label><select id="neighborRadius"><option value="15">15°</option><option value="30">30°</option></select></div><p id="neighborsStatus" class="when" role="status"></p><div id="neighborsList" class="list"></div><p class="src">${t('依所選時刻、位置計算與月心的視角距離。搜尋水星、金星、火星、木星、土星，以及畢宿五、軒轅十四、角宿一、心宿二、北河三；不是完整星表。角距是天空中的方向差，不是實際空間距離。地平線上也可能因暮光、月光或雲層看不清。支援 1900–2100 年；恆星採 J2000 座標並校正歲差，未計自行。','Apparent angular distances from the Moon’s center for the selected time and location. Searches Mercury, Venus, Mars, Jupiter, Saturn, Aldebaran, Regulus, Spica, Antares and Pollux; this is not a complete star catalog. Separation is a difference in sky direction, not physical distance. Twilight, moonlight and clouds may obscure objects above the horizon. Supports 1900–2100; stars use precessed J2000 coordinates without proper motion.')} <a href="https://github.com/cosinekitty/astronomy" target="_blank" rel="noopener">Astronomy Engine</a> · <a href="https://simbad.cds.unistra.fr/simbad/" target="_blank" rel="noopener">SIMBAD</a></p>`;
  $('earthshineCard').innerHTML=`<h2>${t('地球照提示','Earthshine tips')}</h2><p id="earthshineContext" class="when"></p><p id="earthshineStatus" class="night-status" role="status"></p><p>${t('細眉月旁邊淡淡發亮的暗側，是地球反射的陽光照亮月面。試著找出「亮眉月抱著暗月球」的輪廓。','The faint glow on the dark side beside a crescent is sunlight reflected from Earth onto the Moon. Look for a dim whole disk cradled by the bright crescent.')}</p><div id="earthshineWindows" class="list"></div><p>${t('拍攝時架穩手機或相機，先對焦亮月緣，再逐步增加曝光以呈現暗側；亮眉月可能過曝，可另拍一張較短曝光。避免過度數位放大。','Stabilize your phone or camera, focus on the bright lunar edge, then gradually increase exposure to reveal the dark side. The crescent may overexpose; take a separate shorter exposure for it. Avoid excessive digital zoom.')}</p><p class="src">${t('候選時段以照明 1–35%、月亮高度至少 5°、太陽高度 −18° 至 −4° 篩選，是本站觀察提示，並非可見保證；未納入天氣與遮蔽。','Candidate windows use 1–35% illumination, Moon altitude at least 5°, and Sun altitude −18° to −4°. These are site-selected observing hints, not visibility guarantees; weather and obstructions are excluded.')} <a href="https://science.nasa.gov/moon/viewing-tips/" target="_blank" rel="noopener">NASA</a></p>`;
  let nightKey='',data=null,neighborKey='';
  function windows(host,list,empty){
    $(host).innerHTML=list.length?list.map(w=>`<div class="item"><span>${dateTime(w.start)} — ${dateTime(w.end)}<br><small>${duration(Math.round((w.end-w.start)/60000))}</small></span><button type="button" data-night-time="${Math.round((w.start+w.end)/2)}">${t('查看此時','View time')}</button></div>`).join(''):`<p class="when">${empty}</p>`;
  }
  for(const host of ['darknessWindows','earthshineWindows'])$(host).addEventListener('click',event=>{const button=event.target.closest('[data-night-time]');if(button)context.jump(new Date(+button.dataset.nightTime),host==='earthshineWindows'?'earthshineCard':'darknessCard');});
  $('neighborRadius').addEventListener('change',()=>{neighborKey='';update();});
  function update(){
    const d=context.date(),loc=context.location(),key=`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}:${loc.lat}:${loc.lon}`;
    if(key!==nightKey){
      nightKey=key;data=nightConditions(d,loc.lat,loc.lon);
      $('darknessContext').textContent=`${tr(loc.name)} · ${dateTime(data.start)} — ${dateTime(data.end)}`;
      $('darknessTimeline').innerHTML=data.segments.map(s=>`<span class="sky-${s.category}" style="flex-grow:${s.end-s.start}" title="${categories[s.category]} · ${dateTime(s.start)} — ${dateTime(s.end)}"></span>`).join('');
      $('darknessTotal').textContent=t(`天文夜共 ${duration(data.nightMinutes)}；其中無月光 ${duration(data.moonlessMinutes)}。`,`Astronomical night: ${duration(data.nightMinutes)}; moon-free: ${duration(data.moonlessMinutes)}.`);
      $('darknessTimeline').setAttribute('aria-label',$('darknessTotal').textContent);
      windows('darknessWindows',data.moonless,data.nightMinutes?t('這晚沒有同時符合天文夜與月亮落下的時段。','No interval combines astronomical night with the Moon below the horizon.'):t('這晚太陽未降到 −18° 以下，沒有完整天文夜。','The Sun does not fall below −18° during this interval; there is no full astronomical night.'));
      windows('earthshineWindows',data.earthshine,t('這晚沒有符合篩選條件的地球照候選時段，可換到新月前後幾天。','No earthshine candidate windows meet the criteria this night. Try a date a few days before or after new Moon.'));
    }
    const sun=sunPosition(d,loc.lat,loc.lon).alt,moon=moonPosition(d,loc.lat,loc.lon).alt,ms=moonState(d);
    $('darknessNow').textContent=`${t('所選時刻：','Selected time: ')}${categories[skyCategory(sun,moon)]}`;
    $('earthshineContext').textContent=`${dateTime(d)} · ${tr(loc.name)} · ${t('照明','Illumination')} ${(ms.illum*100).toFixed(1)}%`;
    $('earthshineStatus').textContent=!earthshinePhase(ms.illum)?t('目前月相不是建議的細眉月，試著切換日期。','The selected phase is outside the suggested crescent range; try another date.')
      :moon<5?t('月相適合，但月亮太低或在地平線下；可參考下方候選時段。','A suitable crescent, but the Moon is too low or below the horizon; see the candidate windows.')
      :sun>-4?t('月相適合，但天空仍亮；可參考下方曙暮光時段。','A suitable crescent, but the sky is still bright; see the twilight windows below.')
      :sun<-18?t('月相適合，可嘗試辨認暗側；下方另列曙暮光候選時段。','A suitable crescent: try looking for its dim side. Twilight candidate windows are also listed below.')
      :t('目前符合本站地球照觀察條件，可試著尋找淡淡的暗側月面。','The selected time meets the site’s earthshine criteria; try finding the faint dark lunar surface.');
    const nk=`${Math.floor(+d/60000)}:${loc.lat}:${loc.lon}:${$('neighborRadius').value}`;
    if(nk===neighborKey)return;neighborKey=nk;
    $('neighborsContext').textContent=`${dateTime(d)} · ${tr(loc.name)}`;
    const nearby=moonNeighbors(d,loc.lat,loc.lon,+$('neighborRadius').value);
    if(!nearby.supported){$('neighborsStatus').textContent=t('鄰近天體辨認支援 1900–2100 年，請切換日期。','Nearby-object identification supports 1900–2100; choose another date.');$('neighborsList').replaceChildren();return;}
    $('neighborsStatus').textContent=(nearby.moonAlt<=0?t('月亮在地平線下。','The Moon is below the horizon.'):t('月亮在地平線上。','The Moon is above the horizon.'))+' '+(nearby.sunAlt>-6?t('天空仍亮，這些天體未必能以肉眼看見。','The sky is bright; these objects may not be visible to the naked eye.'):t('以下是幾何位置，實際可見仍依天氣與月光而定。','These are geometric positions; visibility still depends on weather and moonlight.'));
    $('neighborsList').innerHTML=nearby.objects.length?nearby.objects.map(o=>`<div class="item"><span><b>${en?o.en:o.zh}</b> <small>${o.kind==='planet'?t('行星','Planet'):t('恆星','Star')}</small><br><small>${t('高度','Altitude')} ${o.alt.toFixed(1)}° · ${t('方位','Bearing')} ${o.az.toFixed(0)}°${o.alt<=0?' · '+t('地平線下','Below horizon'):''}</small></span><span>${o.separation.toFixed(1)}°<br><small>${t('距月心','from Moon')}</small></span></div>`).join(''):`<p class="when">${t('搜尋範圍內沒有上述主要天體，可擴大到 30° 或切換時間。','None of the listed objects is within the radius. Try 30° or another time.')}</p>`;
  }
  return {update};
}
