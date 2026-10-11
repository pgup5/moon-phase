import * as THREE from "../vendor/three.module.min.js";

let texturesPromise = null;
function loadTextures() {
  if (!texturesPromise) {
    const loader = new THREE.TextureLoader();
    const load = (url) => new Promise((res, rej) => loader.load(url, res, undefined, rej));
    texturesPromise = Promise.all([load("textures/moon_color_2k.jpg"), load("textures/moon_disp_1k.jpg")]).then(([map, bump]) => {
      map.colorSpace = THREE.SRGBColorSpace;
      map.anisotropy = 8;
      return { map, bump };
    });
  }
  return texturesPromise;
}

function buildScene(tex) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  camera.position.set(0, 0, 4.4);
  const pivot = new THREE.Group();
  scene.add(pivot);
  const material = new THREE.MeshStandardMaterial({
    map: tex.map, bumpMap: tex.bump, bumpScale: 2.2, roughness: 1, metalness: 0,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 160, 80), material);
  mesh.rotation.y = -Math.PI / 2; // put selenographic longitude 0 (near side) toward the camera
  const spin = new THREE.Group();
  spin.add(mesh);
  pivot.add(spin);
  const sun = new THREE.DirectionalLight(0xfff6e8, 3.4);
  pivot.add(sun, sun.target);
  const earthshine = new THREE.AmbientLight(0x8fa6ff, 0.04);
  scene.add(earthshine);
  function setPhase(elongDeg, southern) {
    const e = (elongDeg * Math.PI) / 180;
    sun.position.set(Math.sin(e) * 10, 0, -Math.cos(e) * 10);
    pivot.rotation.z = southern ? Math.PI : 0;
    // Earthshine is strongest near new moon, when Earth looks "full" from the Moon.
    earthshine.intensity = 0.03 + 0.14 * ((1 + Math.cos(e)) / 2) ** 2;
  }
  return { scene, camera, spin, setPhase };
}

export function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
  } catch (e) { return false; }
}

export async function createMoon(container) {
  if (!webglAvailable()) return null;
  const tex = await loadTextures();
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);
  const s = buildScene(tex);

  const resize = () => {
    const w = container.clientWidth || 300;
    renderer.setSize(w, w, false);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
  };
  new ResizeObserver(resize).observe(container);
  resize();

  // Drag to spin; springs back so the resting view always matches the real sky.
  let dragging = false, lx = 0, ly = 0, rx = 0, ry = 0, vx = 0, vy = 0;
  const el = renderer.domElement;
  el.style.touchAction = "none";
  el.style.cursor = "grab";
  el.addEventListener("pointerdown", (e) => { dragging = true; lx = e.clientX; ly = e.clientY; el.setPointerCapture(e.pointerId); el.style.cursor = "grabbing"; });
  el.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    vy = (e.clientX - lx) * 0.01; vx = (e.clientY - ly) * 0.01;
    ry += vy; rx = Math.max(-1.2, Math.min(1.2, rx + vx));
    lx = e.clientX; ly = e.clientY;
  });
  const end = () => { dragging = false; el.style.cursor = "grab"; };
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);

  const clock = new THREE.Clock();
  function loop() {
    requestAnimationFrame(loop);
    if (document.hidden) return;
    const t = clock.getElapsedTime();
    if (!dragging) {
      ry = ry * 0.94 + vy; vy *= 0.9;
      rx = rx * 0.94 + vx; vx *= 0.9;
    }
    // Gentle libration-like wobble
    s.spin.rotation.y = ry + Math.sin(t * 0.25) * 0.05;
    s.spin.rotation.x = rx + Math.sin(t * 0.17) * 0.03;
    renderer.render(s.scene, s.camera);
  }
  loop();

  return {
    canvas: el,
    setPhase: (elong, southern) => s.setPhase(elong, southern),
  };
}

// Render a still moon image (for share cards) without touching the on-screen view.
let off = null;
export async function renderMoonImage(elong, southern, px) {
  if (!webglAvailable()) return null;
  const tex = await loadTextures();
  if (!off) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    off = { renderer, s: buildScene(tex) };
  }
  off.renderer.setPixelRatio(1);
  off.renderer.setSize(px, px, false);
  off.s.setPhase(elong, southern);
  off.renderer.render(off.s.scene, off.s.camera);
  return off.renderer.domElement;
}
