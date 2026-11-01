import { locale } from './i18n.js';
import { bearingDelta, rearCameraBearing, moonrisePreview } from './moonrise-countdown.js';

export function initMoonriseCamera(context) {
  const $ = id => document.getElementById(id);
  const t = (zh, en) => locale === 'en-US' ? en : zh;
  $('moonriseCamera').innerHTML = `<h2>${t('月出方向預覽', 'Moonrise direction preview')}</h2>
    <p id="riseCameraContext" class="when"></p><p id="riseCameraTarget" class="feature-summary" role="status"></p>
    <div class="rise-camera-stage"><video id="riseCameraVideo" muted playsinline aria-label="${t('相機即時預覽', 'Live camera preview')}" hidden></video>
      <div class="rise-camera-grid" aria-hidden="true"></div><span class="rise-camera-center" aria-hidden="true">＋</span>
      <span id="riseCameraMarker" class="rise-camera-marker" hidden>☾ ${t('月出', 'Moonrise')}</span>
      <span class="rise-camera-caption">${t('水平方向示意 · 非實際月亮影像', 'Horizontal direction guide · not the actual Moon')}</span></div>
    <p id="riseCameraGuidance" role="status"></p>
    <label for="riseCameraFacing">${t('鏡頭面向方位（0° 北、90° 東）', 'Camera bearing (0° north, 90° east)')}</label>
    <input id="riseCameraFacing" type="range" min="0" max="359" value="90" step="1"><output id="riseCameraBearing" for="riseCameraFacing"></output>
    <div class="row"><button id="riseCameraStart" type="button">${t('開啟後鏡頭', 'Open rear camera')}</button><button id="riseCameraStop" type="button" hidden>${t('關閉相機', 'Close camera')}</button><button id="riseCameraCompass" type="button">${t('使用手機方向感測', 'Use phone orientation')}</button></div>
    <p id="riseCameraStatus" class="when" role="status"></p><p id="riseCompassStatus" class="when" role="status"></p>
    <p class="src">${t('沿用所選日期與位置；可在「今晚」更新定位。請將鏡頭朝向地平線。標記只示意月出水平方向，視角未校準，不代表月亮目前位置；磁北與真北可能有偏差，地形與建築也會遮蔽。相機畫面只在本機預覽。未開相機或感測器不可用時，可手動調整方位。', 'Uses the selected date and location; update location in Tonight. Aim the camera at the horizon. The marker illustrates horizontal moonrise direction with an uncalibrated field of view, not the current Moon position. Magnetic and true north may differ; terrain and buildings can obstruct the view. Camera video stays on this device. Adjust bearing manually without camera or sensors.')}</p>`;
  let target = null, key = '', stream = null, generation = 0, listening = false, sensorTimer, sensorGeneration = 0;
  const video = $('riseCameraVideo');
  const available = () => !document.hidden && context.visible('moonriseCamera');
  function draw() {
    const facing = +$('riseCameraFacing').value;
    $('riseCameraBearing').textContent = `${facing}°`;
    $('riseCameraMarker').hidden = !target?.rise;
    if (!target?.rise) { $('riseCameraGuidance').textContent = ''; return; }
    const delta = bearingDelta(target.azimuth, facing);
    $('riseCameraMarker').style.left = `${Math.max(8, Math.min(92, 50 + delta / 60 * 100))}%`;
    $('riseCameraGuidance').textContent = Math.abs(delta) < 5 ? t('月出方向接近鏡頭中央。', 'Moonrise is near the center bearing.') : `${delta > 0 ? t('向右轉', 'Turn right') : t('向左轉', 'Turn left')} ${Math.abs(delta).toFixed(0)}°`;
  }
  function stopCompass() {
    sensorGeneration++; listening = false; clearTimeout(sensorTimer);
    window.removeEventListener('deviceorientationabsolute', orientation);
    window.removeEventListener('deviceorientation', orientation);
    $('riseCameraCompass').textContent = t('使用手機方向感測', 'Use phone orientation');
  }
  function stop() {
    generation++;
    stream?.getTracks().forEach(track => track.stop()); stream = null;
    video.srcObject = null; video.hidden = true;
    $('riseCameraStart').disabled = false; $('riseCameraStart').hidden = false; $('riseCameraStop').hidden = true;
    stopCompass();
  }
  function orientation(event) {
    const heading = rearCameraBearing(event);
    if (heading === null) return;
    clearTimeout(sensorTimer);
    $('riseCameraFacing').value = Math.round(heading) % 360;
    $('riseCompassStatus').textContent = t('方向感測中（近似值）；可手動調整校正。', 'Orientation active (approximate); adjust manually to calibrate.');
    draw();
  }
  $('riseCameraFacing').oninput = () => { stopCompass(); $('riseCompassStatus').textContent = t('手動方位模式', 'Manual bearing mode'); draw(); };
  $('riseCameraStop').onclick = () => { stop(); $('riseCameraStatus').textContent = t('相機已關閉。', 'Camera closed.'); };
  $('riseCameraStart').onclick = async () => {
    if (!navigator.mediaDevices?.getUserMedia) { $('riseCameraStatus').textContent = t('相機無法使用，請以 HTTPS 開啟，或改用手動預覽。', 'Camera unavailable. Use HTTPS or the manual preview.'); return; }
    const token = ++generation;
    $('riseCameraStart').disabled = true; $('riseCameraStop').hidden = false;
    $('riseCameraStatus').textContent = t('正在等待相機權限…', 'Waiting for camera permission…');
    try {
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: 'environment' } }, audio: false });
      if (token !== generation || !available()) { media.getTracks().forEach(track => track.stop()); return; }
      stream = media; video.srcObject = media; video.hidden = false; await video.play();
      if (token !== generation) return;
      $('riseCameraStart').hidden = true;
      $('riseCameraStatus').textContent = t('後鏡頭預覽中，畫面不會上傳。', 'Rear camera preview is active; video is not uploaded.');
    } catch {
      if (token !== generation) return;
      stop(); $('riseCameraStatus').textContent = t('無法開啟後鏡頭或未取得權限，仍可手動預覽。', 'Rear camera unavailable or permission denied. Manual preview still works.');
    }
  };
  $('riseCameraCompass').onclick = async () => {
    if (listening) { stopCompass(); $('riseCompassStatus').textContent = t('手動方位模式', 'Manual bearing mode'); return; }
    const token = generation, sensorToken = ++sensorGeneration;
    try {
      if (!window.DeviceOrientationEvent) throw Error('unavailable');
      if (typeof DeviceOrientationEvent.requestPermission === 'function' && await DeviceOrientationEvent.requestPermission(true) !== 'granted') throw Error('denied');
      if (token !== generation || sensorToken !== sensorGeneration || !available()) return;
      listening = true;
      window.addEventListener('deviceorientationabsolute', orientation);
      window.addEventListener('deviceorientation', orientation);
      $('riseCameraCompass').textContent = t('停止方向感測', 'Stop orientation');
      $('riseCompassStatus').textContent = t('請將鏡頭朝向地平線，等待絕對方向資料…', 'Aim at the horizon; waiting for absolute orientation…');
      sensorTimer = setTimeout(() => { stopCompass(); $('riseCompassStatus').textContent = t('無法取得可靠方向，請手動調整方位。', 'No reliable heading available. Adjust bearing manually.'); }, 5000);
    } catch { if (sensorToken !== sensorGeneration) return; $('riseCompassStatus').textContent = t('方向感測不可用或未授權，請手動調整方位。', 'Orientation unavailable or denied. Adjust bearing manually.'); }
  };
  function suspend() { if (!available()) { stop(); $('riseCameraStatus').textContent = t('預覽已停止，可重新開啟相機。', 'Preview stopped. You can reopen the camera.'); } }
  document.addEventListener('visibilitychange', suspend); window.addEventListener('moon:viewchange', suspend); window.addEventListener('pagehide', stop);
  return { update(date, location) {
    const next = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}:${location.lat}:${location.lon}`;
    if (next !== key) {
      key = next; target = moonrisePreview(date, location.lat, location.lon);
      $('riseCameraContext').textContent = `${date.toLocaleDateString(locale)} · ${location.name} · ${location.lat.toFixed(3)}, ${location.lon.toFixed(3)}`;
      $('riseCameraTarget').textContent = target.rise ? `${t('月出', 'Moonrise')} ${target.rise.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false })} · ${t('方位', 'bearing')} ${target.azimuth.toFixed(1)}°` : t('所選日期沒有月出時刻，請換一天。', 'No moonrise on the selected date. Try another day.');
    }
    draw();
  } };
}
