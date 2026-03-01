import * as THREE from "https://unpkg.com/three@0.164.1/build/three.module.js";

const canvas = document.querySelector("#globeCanvas");
const status = document.querySelector("#status");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const scene = new THREE.Scene();
scene.background = new THREE.Color("#030714");

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 500);

const globeGroup = new THREE.Group();
scene.add(globeGroup);

const loader = new THREE.TextureLoader();
const textures = {
  low: loader.load("https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg"),
  high: loader.load("https://threejs.org/examples/textures/planets/earth_atmos_4096.jpg"),
  bump: loader.load("https://threejs.org/examples/textures/planets/earth_bump_4096.jpg"),
  spec: loader.load("https://threejs.org/examples/textures/planets/earth_specular_2048.jpg"),
  clouds: loader.load("https://threejs.org/examples/textures/planets/earth_clouds_1024.png")
};

const globeMaterial = new THREE.MeshStandardMaterial({
  map: textures.low,
  bumpMap: textures.bump,
  bumpScale: 0.15,
  metalness: 0.03,
  roughness: 0.82,
  envMapIntensity: 0.35
});

const earth = new THREE.Mesh(new THREE.SphereGeometry(10, 128, 128), globeMaterial);
globeGroup.add(earth);

const clouds = new THREE.Mesh(
  new THREE.SphereGeometry(10.08, 64, 64),
  new THREE.MeshStandardMaterial({ map: textures.clouds, transparent: true, opacity: 0.5, depthWrite: false })
);
globeGroup.add(clouds);

const atmosphere = new THREE.Mesh(
  new THREE.SphereGeometry(10.55, 64, 64),
  new THREE.ShaderMaterial({
    uniforms: { glowColor: { value: new THREE.Color("#69b2ff") } },
    vertexShader: `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vNormal;
      uniform vec3 glowColor;
      void main() {
        float intensity = pow(0.72 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
        gl_FragColor = vec4(glowColor, intensity * 0.72);
      }
    `,
    side: THREE.BackSide,
    transparent: true,
    blending: THREE.AdditiveBlending
  })
);
globeGroup.add(atmosphere);

const stars = new THREE.Mesh(
  new THREE.SphereGeometry(220, 32, 32),
  new THREE.MeshBasicMaterial({
    map: loader.load("https://threejs.org/examples/textures/planets/starfield.jpg"),
    side: THREE.BackSide
  })
);
scene.add(stars);

const sunLight = new THREE.DirectionalLight("#fff5df", 2.4);
const moonLight = new THREE.DirectionalLight("#9dbaff", 0.32);
scene.add(sunLight, moonLight, new THREE.AmbientLight("#3a5f9b", 0.3));

const poiLabels = new THREE.Group();
scene.add(poiLabels);

const labelData = [
  { name: "North America", lat: 45, lon: -105, level: 2.1 },
  { name: "South America", lat: -14, lon: -59, level: 2.2 },
  { name: "Europe", lat: 50, lon: 11, level: 1.8 },
  { name: "Africa", lat: 2, lon: 20, level: 2.1 },
  { name: "Asia", lat: 34, lon: 88, level: 2.1 },
  { name: "Sydney", lat: -33.9, lon: 151.2, level: 0.9 },
  { name: "Tokyo", lat: 35.7, lon: 139.7, level: 0.8 },
  { name: "Cairo", lat: 30.0, lon: 31.2, level: 1.1 }
];

function makeLabel(text) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(6, 18, c.width - 12, 88);
  ctx.strokeStyle = "rgba(130,185,255,0.7)";
  ctx.strokeRect(6, 18, c.width - 12, 88);
  ctx.fillStyle = "#eff6ff";
  ctx.font = "600 48px Inter, sans-serif";
  ctx.fillText(text, 20, 75);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0 });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(5, 1.2, 1);
  return sprite;
}

function latLonToVector(lat, lon, radius = 10.5) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

labelData.forEach((entry) => {
  const label = makeLabel(entry.name);
  label.position.copy(latLonToVector(entry.lat, entry.lon));
  label.userData.level = entry.level;
  poiLabels.add(label);
});

const state = {
  yaw: 0.2,
  pitch: 0.35,
  zoom: 36,
  minZoom: 13,
  maxZoom: 90,
  yawVel: 0,
  pitchVel: 0,
  bearingVel: 0,
  friction: 0.93
};

const pointer = {
  active: false,
  x: 0,
  y: 0,
  mode: "mouse",
  touches: new Map(),
  previousTwoTouch: null
};

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function updateCamera() {
  const spherical = new THREE.Spherical(state.zoom, Math.PI / 2 - state.pitch, state.yaw);
  camera.position.setFromSpherical(spherical);
  camera.lookAt(0, 0, 0);
}

function setStatus(text) {
  status.textContent = text;
}

function zoomBy(delta) {
  const logScale = Math.exp(delta * 0.0022);
  state.zoom = clamp(state.zoom * logScale, state.minZoom, state.maxZoom);
}

canvas.addEventListener("pointerdown", (e) => {
  canvas.setPointerCapture(e.pointerId);
  pointer.mode = e.pointerType;
  pointer.active = true;
  pointer.x = e.clientX;
  pointer.y = e.clientY;
  setStatus(`Input: ${e.pointerType} rotation`);
});

canvas.addEventListener("pointermove", (e) => {
  if (!pointer.active || pointer.mode === "touch") return;
  const dx = e.clientX - pointer.x;
  const dy = e.clientY - pointer.y;
  pointer.x = e.clientX;
  pointer.y = e.clientY;
  state.yawVel = -dx * 0.0022;
  state.pitchVel = -dy * 0.0013;
});

canvas.addEventListener("pointerup", (e) => {
  if (pointer.mode !== "touch") pointer.active = false;
  canvas.releasePointerCapture(e.pointerId);
  setStatus("Input: kinetic inertia");
});

canvas.addEventListener(
  "touchstart",
  (e) => {
    [...e.touches].forEach((t) => pointer.touches.set(t.identifier, { x: t.clientX, y: t.clientY }));
    if (e.touches.length === 1) setStatus("Input: 1-finger rotate");
    if (e.touches.length === 2) setStatus("Input: 2-finger gesture");
  },
  { passive: false }
);

canvas.addEventListener(
  "touchmove",
  (e) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      const t = e.touches[0];
      const prev = pointer.touches.get(t.identifier) || { x: t.clientX, y: t.clientY };
      const dx = t.clientX - prev.x;
      const dy = t.clientY - prev.y;
      state.yawVel = -dx * 0.0024;
      state.pitchVel = -dy * 0.0014;
      pointer.touches.set(t.identifier, { x: t.clientX, y: t.clientY });
      return;
    }

    if (e.touches.length === 2) {
      const [a, b] = [e.touches[0], e.touches[1]];
      const centerX = (a.clientX + b.clientX) * 0.5;
      const centerY = (a.clientY + b.clientY) * 0.5;
      const dx = b.clientX - a.clientX;
      const dy = b.clientY - a.clientY;
      const dist = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);

      if (pointer.previousTwoTouch) {
        zoomBy(pointer.previousTwoTouch.dist - dist);
        const pitchDelta = (centerY - pointer.previousTwoTouch.centerY) * 0.0016;
        state.pitch = clamp(state.pitch - pitchDelta, -0.18, 1.42);
        const dAngle = angle - pointer.previousTwoTouch.angle;
        state.yaw -= dAngle;
      }

      pointer.previousTwoTouch = { dist, angle, centerX, centerY };
      setStatus("Input: pinch + tilt + twist");
    }
  },
  { passive: false }
);

canvas.addEventListener("touchend", () => {
  pointer.touches.clear();
  pointer.previousTwoTouch = null;
});

canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    if (e.shiftKey) {
      state.yaw -= e.deltaY * 0.0035;
      setStatus("Input: trackpad compass rotate");
      return;
    }
    if (e.altKey) {
      state.pitch = clamp(state.pitch - e.deltaY * 0.0024, -0.18, 1.42);
      setStatus("Input: trackpad pitch slide");
      return;
    }
    zoomBy(e.deltaY);
    setStatus("Input: dynamic zoom");
  },
  { passive: false }
);

const raycaster = new THREE.Raycaster();
canvas.addEventListener("click", (e) => {
  const m = new THREE.Vector2((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(m, camera);
  const hits = raycaster.intersectObjects(poiLabels.children);
  if (hits.length > 0) setStatus(`POI: ${hits[0].object.material.map.source.data ? "Selected" : "Detected"}`);
});

function updateLightByUTC(date = new Date()) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const diff = date.getTime() - start;
  const day = diff / 86400000;
  const decl = 23.44 * Math.sin(((2 * Math.PI) / 365) * (day - 81));
  const lon = ((date.getUTCHours() + date.getUTCMinutes() / 60) / 24) * 360 - 180;
  sunLight.position.copy(latLonToVector(decl, -lon, 65));
  moonLight.position.copy(latLonToVector(-decl * 0.8, -(lon + 160), 68));
}

function updateLOD() {
  globeMaterial.map = state.zoom < 22 ? textures.high : textures.low;
  globeMaterial.specularMap = state.zoom < 28 ? textures.spec : null;
  globeMaterial.needsUpdate = true;
}

function updateLabelVisibility() {
  const altitude = (state.zoom - state.minZoom) / (state.maxZoom - state.minZoom);
  poiLabels.children.forEach((sprite) => {
    const threshold = sprite.userData.level;
    const visibleFactor = clamp((threshold - altitude * 3.2) * 1.4, 0, 1);
    sprite.material.opacity = visibleFactor;
    sprite.quaternion.copy(camera.quaternion);
  });
}

function animate() {
  requestAnimationFrame(animate);
  state.yaw += state.yawVel;
  state.pitch = clamp(state.pitch + state.pitchVel, -0.18, 1.42);
  state.yawVel *= state.friction;
  state.pitchVel *= state.friction;
  state.bearingVel *= state.friction;
  clouds.rotation.y += 0.0004;
  updateCamera();
  updateLightByUTC();
  updateLOD();
  updateLabelVisibility();
  renderer.render(scene, camera);
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

updateCamera();
setStatus("Ready: unified input active");
animate();
