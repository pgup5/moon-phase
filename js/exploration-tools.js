import { locale } from './i18n.js';
import { landmarkGeometry, planAlignment } from './landscape.js';
import { LUNAR_FEATURES, lunarPoint, featureLighting } from './moon-explorer.js';
import { moonState } from './astro.js';
const en=locale==='en-US', t=(zh,english)=>en?english:zh;
const $=id=>document.getElementById(id);
const fmt=d=>new Date(d).toLocaleString(locale,{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false});
const numberInput=(id,label,value,min,max,step='any')=>`<label>${label}<input id="${id}" type="number" value="${value}" min="${min}" max="${max}" step="${step}" required></label>`;
export function initExplorationTools(context){
  const loc=context.location();
  $('landscapePlanner').innerHTML=`<h2>${t('地景對月規劃','Landscape Moon planner')}</h2>
    <p class="when">${t('選擇拍攝點與地標，尋找所選夜晚月亮最接近地標頂端的時間。','Choose a camera position and landmark to find the closest lunar alignment during the selected night.')}</p>
    <form id="alignmentForm">
      <fieldset><legend>${t('拍攝點','Camera position')}</legend><div class="planner-inputs">
        ${numberInput('cameraLat',t('緯度','Latitude'),loc.lat,-90,90)}${numberInput('cameraLon',t('經度','Longitude'),loc.lon,-180,180)}
        <button type="button" id="plannerLocation">${t('套用目前查詢位置','Use current viewing location')}</button></div></fieldset>
      <fieldset><legend>${t('地標頂端（初始座標與高度為示例）','Landmark top (initial coordinates and height are examples)')}</legend><div class="planner-inputs">
        ${numberInput('landmarkLat',t('緯度','Latitude'),25.033968,-90,90)}${numberInput('landmarkLon',t('經度','Longitude'),121.564468,-180,180)}
        ${numberInput('landmarkHeight',t('頂端相對鏡頭高度（公尺）','Top height relative to camera (m)'),100,-10000,10000)}
        <label>${t('容許中心角距','Alignment tolerance')}<select id="alignmentTolerance"><option value="0.25">0.25°</option><option value="0.5">0.5°</option><option value="1" selected>1°</option><option value="2">2°</option></select></label>
      </div></fieldset>
      <details id="plannerMapDetails"><summary>${t('在地圖上選點（需要網路）','Choose points on a map (internet required)')}</summary>
        <div class="row map-controls"><label>${t('點選地圖設定','Map click sets')}<select id="mapPick"><option value="camera">${t('拍攝點','Camera position')}</option><option value="landmark">${t('地標','Landmark')}</option></select></label>
          <button type="button" data-pan="west" aria-label="${t('向西','Pan west')}">←</button><button type="button" data-pan="north" aria-label="${t('向北','Pan north')}">↑</button><button type="button" data-pan="south" aria-label="${t('向南','Pan south')}">↓</button><button type="button" data-pan="east" aria-label="${t('向東','Pan east')}">→</button>
          <button type="button" id="mapZoomOut" aria-label="${t('縮小地圖','Zoom out')}">−</button><button type="button" id="mapZoomIn" aria-label="${t('放大地圖','Zoom in')}">＋</button><button type="button" id="mapCenter">${t('回到拍攝點','Center on camera')}</button></div>
        <div id="plannerMap" class="planner-map" aria-label="${t('點選設定位置；也可在上方輸入座標','Click to set a position, or enter coordinates above')}"><div id="plannerTiles"></div><svg id="plannerOverlay" aria-hidden="true"></svg><span class="map-credit">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a></span></div>
        <p class="src">${t('金色 C：拍攝點；藍色 L：地標。地圖未載入時仍可輸入座標計算。','Gold C: camera; blue L: landmark. Coordinates still work if map tiles do not load.')}</p></details>
      <button class="primary" type="submit">${t('計算對月時間','Find alignment times')}</button>
    </form>
    <p id="alignmentSummary" class="when" role="status" aria-live="polite"></p><div id="alignmentResults" class="list"></div>
    <p class="src">${t('計算範圍為所選日期中午至隔日中午，依裝置時區顯示。高度為地標頂端減去鏡頭高度，不是海拔。採球面地理方位與平面高度估算，未納入地球曲率、折射、地形、天氣與地標寬度；適合初步近距離取景，非精密掩月預報。角距以月心計算，月面直徑約 0.5°。','Search spans local noon to the following noon in your device time zone. Enter landmark-top height minus camera height, not elevation above sea level. Uses spherical bearings and a flat height estimate; excludes Earth curvature, refraction, terrain, weather and landmark width. For preliminary nearby framing, not precise occultation predictions. Separation uses the Moon’s center; the lunar disk is about 0.5° across.')}</p>`;
  $('moonExplorer').innerHTML=`<h2>${t('月面探索','Explore the lunar surface')}</h2><p class="when">${t('點選月面標記或下方名稱，探索月海、隕石坑與首次登月位置。','Select a map marker or a name to explore lunar seas, craters and the first crewed landing site.')}</p>
    <div class="explorer-layout"><div><svg id="lunarMap" viewBox="0 0 400 400" role="group" aria-label="${t('月球正面互動示意圖','Interactive near-side lunar diagram')}"></svg>
    <div id="lunarFeatureButtons" class="filters"></div></div><div id="lunarFeatureDetail" class="lunar-detail" aria-live="polite"></div></div>
    <p class="src">${t('固定月球正面示意圖，標記不代表地形大小；依半球設定旋轉，非望遠鏡實際視角。受光估算依所選月相，忽略天平動與太陽緯度，不代表當地可見。地形與任務資料：','Fixed near-side diagram; marker sizes do not represent feature sizes. Rotates with the hemisphere setting, not your telescope’s actual orientation. Approximate lighting follows the selected phase, ignoring libration and solar latitude; it does not indicate local visibility. Sources: ')}<a href="https://science.nasa.gov/wp-content/uploads/2024/01/moon-features.pdf" target="_blank" rel="noopener">NASA</a> · <a href="https://planetarynames.wr.usgs.gov/" target="_blank" rel="noopener">USGS / IAU</a></p>`;
  let selected='tranquility',lastKey='',lastExplorerKey='',mapLoaded=false;
  let center={lat:loc.lat,lon:loc.lon},zoom=14;
  const read=id=>$(id).value.trim()===''?NaN:Number($(id).value);
  const world=(lat,lon)=>{const size=256*2**zoom,clamped=Math.max(-85.05112878,Math.min(85.05112878,lat)),s=Math.sin(clamped*Math.PI/180);return {x:(lon+180)/360*size,y:(0.5-Math.log((1+s)/(1-s))/(4*Math.PI))*size};};
  const unproject=(x,y)=>{const size=256*2**zoom;return {lon:((x/size*360+180)%360+360)%360-180,lat:Math.atan(Math.sinh(Math.PI*(1-2*Math.max(0,Math.min(size,y))/size)))*180/Math.PI};};
  function drawMap(){
    if(!mapLoaded)return;
    const map=$('plannerMap'),width=map.clientWidth,height=340,c=world(center.lat,center.lon),left=c.x-width/2,top=c.y-height/2,n=2**zoom;
    let html='';
    for(let x=Math.floor(left/256);x<=Math.floor((left+width)/256);x++)for(let y=Math.floor(top/256);y<=Math.floor((top+height)/256);y++){
      if(y<0||y>=n)continue;
      html+=`<img alt="" draggable="false" src="https://tile.openstreetmap.org/${zoom}/${((x%n)+n)%n}/${y}.png" style="left:${x*256-left}px;top:${y*256-top}px">`;
    }
    $('plannerTiles').innerHTML=html;
    const points=['camera','landmark'].map(prefix=>{const lat=read(prefix+'Lat'),lon=read(prefix+'Lon');if(!Number.isFinite(lat)||!Number.isFinite(lon))return null;const p=world(lat,lon),size=256*n;let dx=p.x-c.x;dx=((dx+size/2)%size+size)%size-size/2;return {x:width/2+dx,y:p.y-top};});
    const [a,b]=points;
    $('plannerOverlay').setAttribute('viewBox',`0 0 ${width} ${height}`);
    $('plannerOverlay').innerHTML=(a&&b?`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#ffd98a" stroke-width="2"/>`:'')+points.map((p,i)=>p?`<circle cx="${p.x}" cy="${p.y}" r="14" fill="${i?'#8eafff':'#ffd98a'}"/><text x="${p.x}" y="${p.y+5}" text-anchor="middle" fill="#111">${i?'L':'C'}</text>`:'').join('');
  }
  $('plannerMapDetails').addEventListener('toggle',()=>{if($('plannerMapDetails').open){mapLoaded=true;drawMap();}});
  $('plannerMap').addEventListener('click',event=>{
    if(event.target.closest('a'))return;
    const box=$('plannerMap').getBoundingClientRect(),c=world(center.lat,center.lon),p=unproject(c.x+event.clientX-box.left-box.width/2,c.y+event.clientY-box.top-170),prefix=$('mapPick').value;
    $(prefix+'Lat').value=p.lat.toFixed(6);$(prefix+'Lon').value=p.lon.toFixed(6);lastKey='';update();drawMap();
  });
  document.querySelectorAll('[data-pan]').forEach(button=>button.onclick=()=>{const c=world(center.lat,center.lon),d=button.dataset.pan;center=unproject(c.x+(d==='east'?180:d==='west'?-180:0),c.y+(d==='south'?140:d==='north'?-140:0));drawMap();});
  $('mapZoomIn').onclick=()=>{zoom=Math.min(18,zoom+1);drawMap();};
  $('mapZoomOut').onclick=()=>{zoom=Math.max(2,zoom-1);drawMap();};
  $('mapCenter').onclick=()=>{if($('alignmentForm').reportValidity()){center={lat:read('cameraLat'),lon:read('cameraLon')};drawMap();}};
  if(globalThis.ResizeObserver)new ResizeObserver(()=>{if($('plannerMapDetails').open)drawMap();}).observe($('plannerMap'));
  $('plannerLocation').onclick=()=>{const p=context.location();$('cameraLat').value=p.lat;$('cameraLon').value=p.lon;center={...p};lastKey='';update();drawMap();};
  $('alignmentForm').addEventListener('submit',e=>{e.preventDefault();lastKey='';update();drawMap();});
  $('alignmentForm').addEventListener('change',()=>{lastKey='';update();drawMap();});
  $('alignmentResults').addEventListener('click',e=>{const button=e.target.closest('[data-alignment-time]');if(button){
    // An alignment belongs to its camera coordinates, not the previous viewing location.
    context.jump(new Date(+button.dataset.alignmentTime),{lat:read('cameraLat'),lon:read('cameraLon')});
  }});
  const select=id=>{selected=id;lastExplorerKey='';updateExplorer();};
  $('lunarFeatureButtons').innerHTML=LUNAR_FEATURES.map(f=>`<button type="button" data-feature="${f.id}">${en?f.en:f.zh}</button>`).join('');
  for(const host of [$('lunarMap'),$('lunarFeatureButtons')]){
    host.addEventListener('click',e=>{const item=e.target.closest('[data-feature]');if(item)select(item.dataset.feature);});
  }
  $('lunarMap').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){const item=e.target.closest('[data-feature]');if(item){e.preventDefault();select(item.dataset.feature);}}});
  function updateExplorer(){
    const date=context.date(),southern=context.southern(),ms=moonState(date),key=`${selected}:${southern}:${ms.elong.toFixed(1)}`;
    if(key===lastExplorerKey)return;lastExplorerKey=key;
    const p=f=>lunarPoint(f.lat,f.lon,southern);
    const maria=LUNAR_FEATURES.filter(f=>f.type==='mare').map(f=>`<ellipse cx="${p(f).x}" cy="${p(f).y}" rx="${f.id==='imbrium'?52:39}" ry="${f.id==='imbrium'?40:30}" fill="#636878" opacity=".6"/>`).join('');
    $('lunarMap').innerHTML=`<defs><radialGradient id="explorerMoon"><stop stop-color="#e7e1cf"/><stop offset="1" stop-color="#aaa99f"/></radialGradient></defs><circle cx="200" cy="200" r="166" fill="url(#explorerMoon)"/><path d="M34 200H366M200 34V366" stroke="#333" opacity=".15"/>${maria}<text x="200" y="20" text-anchor="middle" fill="currentColor">${southern?'S':'N'}</text><text x="380" y="205" fill="currentColor">${southern?'W':'E'}</text>`+
      LUNAR_FEATURES.map((f,i)=>`<g data-feature="${f.id}" role="button" tabindex="0" aria-label="${en?f.en:f.zh}" aria-pressed="${f.id===selected}"><circle cx="${p(f).x}" cy="${p(f).y}" r="14" fill="${f.id===selected?'#ffd98a':'#18213c'}" stroke="#fff" stroke-width="2"/><text x="${p(f).x}" y="${p(f).y+5}" text-anchor="middle" fill="${f.id===selected?'#111':'#fff'}" font-size="13">${i+1}</text></g>`).join('');
    for(const button of $('lunarFeatureButtons').querySelectorAll('button'))button.setAttribute('aria-pressed',String(button.dataset.feature===selected));
    const f=LUNAR_FEATURES.find(f=>f.id===selected),lit=featureLighting(f,ms.elong);
    $('lunarFeatureDetail').innerHTML=`<span class="chip">${f.type==='mare'?t('月海','Lunar sea'):f.type==='crater'?t('隕石坑','Crater'):t('登月位置','Landing site')}</span><h3>${en?f.en:f.zh}</h3><p class="when">${Math.abs(f.lat).toFixed(2)}°${f.lat>=0?'N':'S'} · ${Math.abs(f.lon).toFixed(2)}°${f.lon>=0?'E':'W'}</p><p>${f.story[en?1:0]}</p><p>${f.tip[en?1:0]}</p><p class="when">${t('所選月相：','Selected phase: ')}${lit?t('此區域約在受光面。','this region is approximately sunlit.'):t('此區域約在背光面，可切換日期探索。','this region is approximately unlit; try another date.')}</p><a href="${f.url}" target="_blank" rel="noopener">${t('查看資料來源 ↗','Read source ↗')}</a>`;
  }
  function update(){
    updateExplorer();
    const date=context.date(),key=`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}:`+['cameraLat','cameraLon','landmarkLat','landmarkLon','landmarkHeight','alignmentTolerance'].map(id=>$(id).value).join(':');
    if(key===lastKey)return;lastKey=key;
    $('alignmentResults').replaceChildren();
    if(!$('alignmentForm').checkValidity()){$('alignmentSummary').textContent=t('請填入有效座標與高度。','Enter valid coordinates and height.');return;}
    try{
      const g=landmarkGeometry(read('cameraLat'),read('cameraLon'),read('landmarkLat'),read('landmarkLon'),read('landmarkHeight'));
      const plan=planAlignment(date,read('cameraLat'),read('cameraLon'),g),tolerance=read('alignmentTolerance');
      $('alignmentSummary').textContent=`${fmt(plan.start)} — ${fmt(plan.end)} · ${t('距離','Distance')} ${(g.distance/1000).toFixed(2)} km · ${t('地標方位','Landmark bearing')} ${g.az.toFixed(1)}° · ${t('仰角','Elevation')} ${g.alt.toFixed(1)}°`;
      if(!plan.candidates.length){$('alignmentResults').textContent=t('這段時間月亮都在地平線下，請切換日期或拍攝點。','The Moon stays below the horizon in this interval. Try another date or camera position.');return;}
      $('alignmentResults').innerHTML=plan.candidates.map(p=>`<div class="item"><div><b>${p.error<=tolerance?t('在設定角距內','Within tolerance'):t('未對齊，最接近位置','No alignment; closest approach')}</b><p class="when">${fmt(p.t)} · ${p.sunAlt>0?t('白天','Daylight'):p.sunAlt>-6?t('暮光','Twilight'):t('夜間','Night')}</p><small>${t('月亮方位','Moon bearing')} ${p.az.toFixed(1)}° · ${t('高度','Altitude')} ${p.alt.toFixed(1)}° · ${t('與地標角距','Separation')} ${p.error.toFixed(2)}° · ${t('照明','Illumination')} ${(moonState(new Date(p.t)).illum*100).toFixed(1)}%</small></div><button type="button" data-alignment-time="${p.t}">${t('查看此刻與拍攝點','View time and camera location')}</button></div>`).join('');
    }catch{$('alignmentSummary').textContent=t('拍攝點與地標需至少相距 1 公尺，並請檢查座標。','Camera and landmark must be at least 1 metre apart. Check coordinates.');}
  }
  return {update};
}
