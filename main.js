// --- Three.js Solar System ---

// Planet data: [name, color, size, distance from sun, default speed]
const PLANETS = [
  { name: 'Mercury', color: 0xb1b1b1, size: 0.38, distance: 6, speed: 0.04 },
  { name: 'Venus',   color: 0xeccc9a, size: 0.95, distance: 8, speed: 0.015 },
  { name: 'Earth',   color: 0x2a6aff, size: 1,    distance: 10, speed: 0.01 },
  { name: 'Mars',    color: 0xff6f2a, size: 0.53, distance: 12, speed: 0.008 },
  { name: 'Jupiter', color: 0xf4e2b6, size: 2,    distance: 15, speed: 0.004 },
  { name: 'Saturn',  color: 0xf7e7b6, size: 1.7,  distance: 18, speed: 0.003 },
  { name: 'Uranus',  color: 0x7defff, size: 1.4,  distance: 21, speed: 0.002 },
  { name: 'Neptune', color: 0x4666ff, size: 1.3,  distance: 24, speed: 0.0015 },
];

let scene, camera, renderer, sun;
let planetMeshes = [];
let planetAngles = [];
let planetSpeeds = PLANETS.map(p => p.speed);
let isPaused = false;
let stars;
let animating = true;
let defaultCamera = { position: { x: 0, y: 15, z: 38 }, lookAt: { x: 0, y: 0, z: 0 } };
let zooming = false;
let sunGlow;

function init() {
  // Scene
  scene = new THREE.Scene();

  // Camera
  const aspect = window.innerWidth / (window.innerHeight - 120);
  camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
  camera.position.set(defaultCamera.position.x, defaultCamera.position.y, defaultCamera.position.z);
  camera.lookAt(defaultCamera.lookAt.x, defaultCamera.lookAt.y, defaultCamera.lookAt.z);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setClearColor(0x000000); // Pure black background
  renderer.setSize(window.innerWidth, window.innerHeight - 120);
  document.getElementById('canvas-container').appendChild(renderer.domElement);

  // Lighting
  const ambient = new THREE.AmbientLight(0xffffff, 0.2);
  scene.add(ambient);
  const sunLight = new THREE.PointLight(0xffffff, 2, 100);
  sunLight.position.set(0, 0, 0);
  scene.add(sunLight);

  // Sun
  const sunGeo = new THREE.SphereGeometry(2.5, 32, 32);
  const sunMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
  sun = new THREE.Mesh(sunGeo, sunMat);
  scene.add(sun);

  // Sun Glow (soft radial sprite)
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(128, 128, 30, 128, 128, 128);
  gradient.addColorStop(0, 'rgba(255, 230, 100, 0.85)');
  gradient.addColorStop(0.3, 'rgba(255, 200, 40, 0.35)');
  gradient.addColorStop(0.7, 'rgba(255, 200, 40, 0.08)');
  gradient.addColorStop(1, 'rgba(255, 200, 40, 0.01)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(canvas);
  const spriteMat = new THREE.SpriteMaterial({ map: texture, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
  sunGlow = new THREE.Sprite(spriteMat);
  sunGlow.scale.set(8, 8, 1); // Adjust for glow size
  sunGlow.position.copy(sun.position);
  scene.add(sunGlow);

  // Orbits (rings)
  addOrbitRings();

  // Planets
  for (let i = 0; i < PLANETS.length; i++) {
    const p = PLANETS[i];
    const geo = new THREE.SphereGeometry(p.size, 32, 32);
    const mat = new THREE.MeshStandardMaterial({ color: p.color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(p.distance, 0, 0);
    mesh.userData.planetIndex = i;
    scene.add(mesh);
    planetMeshes.push(mesh);
    planetAngles.push(Math.random() * Math.PI * 2); // random start angle
  }

  // Background stars
  addStars();

  // Controls UI
  createSliders();
  setupPauseResume();
  setupThemeToggle();
  setupTooltip();
  setupPlanetClickZoom();

  // Responsive
  window.addEventListener('resize', onWindowResize);
}

function addOrbitRings() {
  for (let i = 0; i < PLANETS.length; i++) {
    const radius = PLANETS[i].distance;
    const segments = 128;
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    for (let j = 0; j <= segments; j++) {
      const theta = (j / segments) * Math.PI * 2;
      positions.push(Math.cos(theta) * radius, 0, Math.sin(theta) * radius);
    }
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const material = new THREE.LineBasicMaterial({ color: 0x444444, opacity: 0.5, transparent: true });
    const line = new THREE.Line(geometry, material);
    scene.add(line);
  }
}

function addStars() {
  const starGeometry = new THREE.BufferGeometry();
  const starCount = 800;
  const positions = [];
  for (let i = 0; i < starCount; i++) {
    const r = 80 + Math.random() * 120;
    const theta = Math.random() * 2 * Math.PI;
    const phi = Math.acos(2 * Math.random() - 1);
    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.sin(phi) * Math.sin(theta);
    const z = r * Math.cos(phi);
    positions.push(x, y, z);
  }
  starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.7 });
  stars = new THREE.Points(starGeometry, starMaterial);
  scene.add(stars);
}

function createSliders() {
  const slidersDiv = document.getElementById('sliders');
  slidersDiv.innerHTML = '';
  PLANETS.forEach((planet, i) => {
    const group = document.createElement('div');
    group.className = 'slider-group';
    const label = document.createElement('label');
    label.textContent = planet.name;
    label.htmlFor = `slider-${i}`;
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = 0.001;
    slider.max = 0.08;
    slider.step = 0.001;
    slider.value = planetSpeeds[i];
    slider.id = `slider-${i}`;
    slider.addEventListener('input', (e) => {
      planetSpeeds[i] = parseFloat(e.target.value);
    });
    group.appendChild(label);
    group.appendChild(slider);
    slidersDiv.appendChild(group);
  });
}

function setupPauseResume() {
  const btn = document.getElementById('pause-btn');
  btn.addEventListener('click', () => {
    isPaused = !isPaused;
    btn.textContent = isPaused ? 'Resume' : 'Pause';
  });
}

function setupThemeToggle() {
  const btn = document.getElementById('theme-toggle');
  btn.addEventListener('click', () => {
    document.body.classList.toggle('light');
    btn.textContent = document.body.classList.contains('light') ? '☀️' : '🌙';
    // Change Three.js background
    renderer.setClearColor(document.body.classList.contains('light') ? 0xf5f5fa : 0x000000);
  });
}

function setupTooltip() {
  const tooltip = document.getElementById('tooltip');
  const canvas = renderer.domElement;
  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    const mouse = {
      x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
      y: -((event.clientY - rect.top) / rect.height) * 2 + 1
    };
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(planetMeshes);
    if (intersects.length > 0) {
      const idx = intersects[0].object.userData.planetIndex;
      tooltip.textContent = PLANETS[idx].name;
      tooltip.style.display = 'block';
      tooltip.style.left = (event.clientX - rect.left + 10) + 'px';
      tooltip.style.top = (event.clientY - rect.top - 10) + 'px';
    } else {
      tooltip.style.display = 'none';
    }
  });
  canvas.addEventListener('mouseleave', () => {
    tooltip.style.display = 'none';
  });
}

function setupPlanetClickZoom() {
  const canvas = renderer.domElement;
  canvas.addEventListener('click', (event) => {
    if (zooming) return;
    const rect = canvas.getBoundingClientRect();
    const mouse = {
      x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
      y: -((event.clientY - rect.top) / rect.height) * 2 + 1
    };
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(planetMeshes);
    if (intersects.length > 0) {
      const mesh = intersects[0].object;
      const target = mesh.position.clone();
      zoomToPlanet(target);
    } else {
      zoomToDefault();
    }
  });
}

function zoomToPlanet(target) {
  zooming = true;
  const start = camera.position.clone();
  const end = new THREE.Vector3(target.x, target.y + 2, target.z + 4);
  const lookAt = new THREE.Vector3(target.x, target.y, target.z);
  let t = 0;
  function animateZoom() {
    t += 0.04;
    camera.position.lerpVectors(start, end, t);
    camera.lookAt(lookAt);
    if (t < 1) {
      requestAnimationFrame(animateZoom);
    } else {
      zooming = false;
    }
  }
  animateZoom();
}

function zoomToDefault() {
  zooming = true;
  const start = camera.position.clone();
  const end = new THREE.Vector3(defaultCamera.position.x, defaultCamera.position.y, defaultCamera.position.z);
  const lookAt = new THREE.Vector3(defaultCamera.lookAt.x, defaultCamera.lookAt.y, defaultCamera.lookAt.z);
  let t = 0;
  function animateZoom() {
    t += 0.04;
    camera.position.lerpVectors(start, end, t);
    camera.lookAt(lookAt);
    if (t < 1) {
      requestAnimationFrame(animateZoom);
    } else {
      zooming = false;
    }
  }
  animateZoom();
}

function onWindowResize() {
  const aspect = window.innerWidth / (window.innerHeight - 120);
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight - 120);
}

function animate() {
  requestAnimationFrame(animate);
  if (!isPaused) {
    // Animate planets
    for (let i = 0; i < PLANETS.length; i++) {
      planetAngles[i] += planetSpeeds[i];
      const d = PLANETS[i].distance;
      planetMeshes[i].position.x = Math.cos(planetAngles[i]) * d;
      planetMeshes[i].position.z = Math.sin(planetAngles[i]) * d;
      planetMeshes[i].rotation.y += 0.02; // self-rotation
    }
    // Animate sun glow pulse
    if (sunGlow) {
      const t = Date.now() * 0.001;
      const scale = 8 + Math.sin(t * 2.2) * 0.45;
      sunGlow.scale.set(scale, scale, 1);
    }
  }
  renderer.render(scene, camera);
}

function setupSidebarToggle() {
  const sidebar = document.getElementById('controls');
  const toggleBtn = document.getElementById('sidebar-toggle');
  const closeBtn = document.querySelector('.close-sidebar');
  toggleBtn.textContent = '☰';
  toggleBtn.setAttribute('aria-label', 'Toggle sidebar');
  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (window.innerWidth <= 700) {
      sidebar.classList.toggle('open');
      if (sidebar.classList.contains('open')) {
        closeBtn.style.display = 'flex';
      } else {
        closeBtn.style.display = 'none';
      }
    } else {
      sidebar.classList.toggle('collapsed');
    }
  });
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    sidebar.classList.remove('open');
    closeBtn.style.display = 'none';
  });
  // Close sidebar on mobile when clicking outside
  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 700 && sidebar.classList.contains('open')) {
      if (!sidebar.contains(e.target) && e.target.id !== 'sidebar-toggle') {
        sidebar.classList.remove('open');
        closeBtn.style.display = 'none';
      }
    }
  });
}

init();
setupSidebarToggle();
animate(); 