import {locale,tr} from './i18n.js';
import {nextVisibleLunarEclipse,eclipsePosition,eclipsePhase} from './lunar-eclipse.js';
const en=locale==='en-US',t=(zh,english)=>en?english:zh,$=id=>document.getElementById(id);
const names={penumbral:t('半影月食','Penumbral eclipse'),partial:t('月偏食','Partial lunar eclipse'),total:t('月全食','Total lunar eclipse'),outside:t('月食之外','Outside the eclipse')};
const contacts={P1:t('半影食始','Penumbral begins'),U1:t('初虧・偏食開始','Partial begins'),U2:t('食既・全食開始','Totality begins'),MAX:t('全球食甚','Global maximum'),U3:t('生光・全食結束','Totality ends'),U4:t('復圓・偏食結束','Partial ends'),P4:t('半影食終','Penumbral ends')};
const fmt=time=>new Date(time).toLocaleString(locale,{year:'numeric',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false});
export function initEclipseFeature(context){
  $('lunarEclipseCard').innerHTML=`<h2>${t('下一次看得到的月食','Next locally visible lunar eclipse')}</h2><p id="eclipseContext" class="when"></p><label class="challenge-done"><input id="eclipseUmbralOnly" type="checkbox">${t('只找本地可見偏食或全食的場次','Only events with locally visible partial or total phases')}</label><p id="eclipseStatus" class="night-status" role="status"></p><div id="eclipseDetails"></div><p class="src">${t('從所選時間起搜尋未來 10 年內，包含進行中月食的剩餘階段；支援 1900–2100 年。當地可見以月心幾何高度大於 0° 篩選，升落邊界逐分鐘搜尋後細化，不含折射、地形、雲量與實際地平線遮蔽。時間約精確至分鐘，依裝置時區顯示；全球食甚可能在本地月落後。半影月食的亮度變化通常不明顯。','Searches up to 10 years after the selected time, including the remaining part of an ongoing eclipse; supports 1900–2100. Local geometric visibility requires Moon-center altitude above 0°, with minute-sampled and refined horizon crossings. Refraction, terrain, clouds and actual horizon obstructions are excluded. Times are approximate to a minute in your device time zone; global maximum may occur after local moonset. Penumbral dimming is often subtle.')} <a href="https://github.com/cosinekitty/astronomy" target="_blank" rel="noopener">Astronomy Engine</a> · <a href="https://science.nasa.gov/moon/eclipses/" target="_blank" rel="noopener">NASA</a></p>`;
  let key='',result=null,origin=null;
  $('eclipseUmbralOnly').onchange=()=>{key='';update();};
  $('eclipseDetails').addEventListener('click',event=>{const button=event.target.closest('[data-eclipse-time]');if(button)context.jump(new Date(+button.dataset.eclipseTime));});
  $('eclipseDetails').addEventListener('input',event=>{if(event.target.id==='eclipsePreview')preview();});
  function preview(){
    if(!result?.event)return;
    const time=result.contacts[0].time+Number($('eclipsePreview').value)*60000,p=eclipsePosition(time,origin.lat,origin.lon);
    $('eclipsePreviewPosition').textContent=`${fmt(time)} · ${names[eclipsePhase(result.event,time)]} · ${t('月亮高度','Moon altitude')} ${p.alt.toFixed(1)}° · ${t('方位','Bearing')} ${p.az.toFixed(0)}° · ${p.alt>0?t('地平線上','Above horizon'):t('地平線下','Below horizon')}`;
    $('eclipsePreviewJump').dataset.eclipseTime=String(time);
  }
  function update(){
    const date=context.date(),loc=context.location(),nextKey=`${Math.floor(+date/60000)}:${loc.lat}:${loc.lon}:${$('eclipseUmbralOnly').checked}`;
    if(nextKey===key)return;key=nextKey;origin={...loc};
    $('eclipseContext').textContent=`${t('起算：','Search from: ')}${fmt(date)} · ${tr(loc.name)} · ${Intl.DateTimeFormat().resolvedOptions().timeZone}`;
    const expanded=$('eclipseMore')?.open || false;
    $('eclipseDetails').replaceChildren();
    try{result=nextVisibleLunarEclipse(date,loc.lat,loc.lon,$('eclipseUmbralOnly').checked);}catch{$('eclipseStatus').textContent=t('暫時無法計算，請更換日期或位置後再試。','Unable to calculate. Try another date or location.');return;}
    if(!result.supported){$('eclipseStatus').textContent=t('請選擇 1900–2100 年內的日期。','Choose a date within 1900–2100.');return;}
    if(!result.event){$('eclipseStatus').textContent=t('搜尋範圍內沒有符合條件的本地可見月食。','No locally visible eclipse meets the criteria within the search range.');return;}
    $('eclipseStatus').textContent=`${names[result.event.kind]} · ${fmt(result.event.peak.date)}`;
    const visibility=result.localKind===result.event.kind?t(`本地可見${names[result.localKind]}階段。`,`The ${names[result.localKind].toLowerCase()} phase is locally above the horizon.`):t(`全球為${names[result.event.kind]}，本地只可見${names[result.localKind]}階段。`,`Globally a ${names[result.event.kind].toLowerCase()}; locally only the ${names[result.localKind].toLowerCase()} phase is above the horizon.`);
    $('eclipseDetails').innerHTML=`<p>${visibility} ${+result.event.peak.date<+date?t('食甚早於起算時間；下方列出剩餘可見時段。','Global maximum is before the search start; remaining visible windows are shown below.'):result.peakVisible?t('食甚時月亮在地平線上。','The Moon is above the horizon at global maximum.'):t('全球食甚在本地地平線下，請參考當地可見時段。','Global maximum is below the local horizon; use the local viewing windows.')}</p><h3>${t('當地可見時段','Local viewing windows')}</h3><div class="list">${result.windows.map(w=>`<div class="item"><span>${fmt(w.start)} — ${fmt(w.end)}<br><small>${t('約','About ')}${Math.round((w.end-w.start)/60000)} ${t('分鐘','minutes')}</small></span></div>`).join('')}</div><p><button type="button" data-eclipse-time="${result.suggestedTime}">${t('查看可見時刻的月亮','View the Moon at a visible time')}</button></p><details id="eclipseMore" class="feature-more" ${expanded?'open':''}><summary>${t('各階段時間與互動預覽','Contact times and interactive preview')}</summary><div class="eclipse-table-scroll"><table class="eclipse-table"><caption>${t('月食各階段與當地高度','Eclipse contacts and local Moon altitude')}</caption><thead><tr><th>${t('階段','Stage')}</th><th>${t('時間','Time')}</th><th>${t('月亮高度','Altitude')}</th></tr></thead><tbody>${result.contacts.map(c=>`<tr><th scope="row">${contacts[c.id]}<small>${c.id==='MAX'?'MAX':c.id}</small></th><td>${fmt(c.time)}${c.time<+date?`<small>${t('早於起算時間','Before search start')}</small>`:''}</td><td>${c.alt.toFixed(1)}°<small>${c.alt>0?t('地平線上','Above horizon'):t('地平線下','Below horizon')}</small></td></tr>`).join('')}</tbody></table></div><label for="eclipsePreview">${t('拖曳預覽月食各時刻','Slide through the eclipse')}</label><input id="eclipsePreview" type="range" min="0" max="${(result.contacts.at(-1).time-result.contacts[0].time)/60000}" step="0.1" value="${(result.suggestedTime-result.contacts[0].time)/60000}"><p id="eclipsePreviewPosition" class="when" role="status"></p><button type="button" id="eclipsePreviewJump">${t('查看預覽時刻','View preview time')}</button></details>`;
    preview();
  }
  return {update};
}
