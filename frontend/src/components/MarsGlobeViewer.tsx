import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { TerrainMesh3DResponse, RoutePlanResponse, ScienceTarget, EnvironmentalConditions } from '../types';
import {
  Compass,
  RotateCcw,
  Sliders,
  Play,
  Pause,
  MapPin,
  Eye,
  Layers,
  ChevronRight,
  Maximize2
} from 'lucide-react';

export interface MarsGlobeViewerProps {
  meshData?: TerrainMesh3DResponse;
  routePlan?: RoutePlanResponse;
  startCoords: [number, number];
  targetCoords: [number, number];
  scienceTargets: ScienceTarget[];
  selectedTargetId?: string;
  environment?: EnvironmentalConditions;
  onSelectTarget: (target: ScienceTarget) => void;
}

// Mars Planetary Constants (IAU 2000 Mars Mean Sphere)
const MARS_RADIUS_KM = 3396.19;
const JEZERO_LON = 77.45;
const JEZERO_LAT = 18.44;

// Major Martian Landmarks for Planetary Orientation & Fly-to Navigation
const PLANETARY_LANDMARKS = [
  { name: 'Jezero Crater (EVA Site)', lon: 77.45, lat: 18.44, alt: 3600, type: 'eva', desc: 'Perseverance landing site & paleolake delta' },
  { name: 'Olympus Mons', lon: 226.2, lat: 18.65, alt: 5500, type: 'landmark', desc: 'Largest volcano in Solar System (21.9 km height)' },
  { name: 'Valles Marineris', lon: 295.0, lat: -13.9, alt: 5500, type: 'landmark', desc: 'Grand canyon system (4,000 km length)' },
  { name: 'Gale Crater', lon: 137.4, lat: -5.4, alt: 4500, type: 'landmark', desc: 'Curiosity Rover exploration site' },
  { name: 'Hellas Planitia', lon: 70.0, lat: -42.4, alt: 6000, type: 'landmark', desc: 'Massive impact basin (9 km depth)' },
  { name: 'North Polar Cap (Planum Boreum)', lon: 0.0, lat: 85.0, alt: 5500, type: 'polar', desc: 'Water-ice & CO2 permanent ice cap' },
  { name: 'South Polar Cap (Planum Australe)', lon: 0.0, lat: -85.0, alt: 5500, type: 'polar', desc: 'CO2 dry-ice seasonal ice cap' }
];

/**
 * Convert Planetary Longitude / Latitude to Cartesian 3D Coordinates
 * Aligned with Three.js SphereGeometry equirectangular UV mapping:
 * - Lon: -180° to +180° (or 0° to 360° East)
 * - Lat: -90° (South) to +90° (North)
 */
export function lonLatToCartesian(lon: number, lat: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  return new THREE.Vector3(x, y, z);
}

/**
 * Convert Cartesian 3D Coordinates on the sphere back to Longitude / Latitude
 */
export function cartesianToLonLat(v: THREE.Vector3): { lon: number; lat: number } {
  const normalized = v.clone().normalize();
  const lat = 90 - Math.acos(Math.max(-1, Math.min(1, normalized.y))) * (180 / Math.PI);
  let lon = Math.atan2(normalized.z, -normalized.x) * (180 / Math.PI) - 180;
  while (lon < -180) lon += 360;
  while (lon > 180) lon -= 360;
  return { lon, lat };
}

export const MarsGlobeViewer: React.FC<MarsGlobeViewerProps> = ({
  meshData,
  routePlan,
  startCoords,
  targetCoords,
  scienceTargets,
  selectedTargetId,
  environment,
  onSelectTarget
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  // User Control States
  const [zoomLevel, setZoomLevel] = useState<'global' | 'regional' | 'surface'>('global');
  const [cameraMode, setCameraMode] = useState<'orbit' | 'surface' | 'drone'>('orbit');
  const [vertExaggeration, setVertExaggeration] = useState<number>(1.8);
  const [isPlayingFlyover, setIsPlayingFlyover] = useState<boolean>(false);
  const [showLandmarks, setShowLandmarks] = useState<boolean>(true);
  const [telemetry, setTelemetry] = useState({
    subLon: 77.5,
    subLat: 18.4,
    altitudeKm: 5800,
    solarElevation: 42.0
  });

  // Three.js References
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const globeMeshRef = useRef<THREE.Mesh | null>(null);
  const atmosphereMeshRef = useRef<THREE.Mesh | null>(null);
  const jezeroTerrainMeshRef = useRef<THREE.Mesh | null>(null);
  const markersGroupRef = useRef<THREE.Group | null>(null);
  const landmarksGroupRef = useRef<THREE.Group | null>(null);
  const routeLineRef = useRef<THREE.Line | null>(null);
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);

  // Camera Orbit State
  const sphericalRef = useRef({
    theta: -0.65, // Positioned facing Eastern hemisphere (Jezero crater region)
    phi: 1.15,
    radius: 9200
  });
  const lookAtTargetRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const isDraggingRef = useRef<boolean>(false);
  const dragButtonRef = useRef<number>(0);
  const prevMouseRef = useRef({ x: 0, y: 0 });
  const velocityRef = useRef({ dTheta: 0, dPhi: 0 });
  const lastInteractionTimeRef = useRef<number>(Date.now());

  // Camera Flight Transition State
  const flightAnimRef = useRef<{
    active: boolean;
    startTheta: number;
    startPhi: number;
    startRadius: number;
    startLookAt: THREE.Vector3;
    targetTheta: number;
    targetPhi: number;
    targetRadius: number;
    targetLookAt: THREE.Vector3;
    progress: number;
    durationFrames: number;
  }>({
    active: false,
    startTheta: 0,
    startPhi: 0,
    startRadius: 0,
    startLookAt: new THREE.Vector3(),
    targetTheta: 0,
    targetPhi: 0,
    targetRadius: 0,
    targetLookAt: new THREE.Vector3(),
    progress: 0,
    durationFrames: 60
  });

  const droneAnimProgressRef = useRef<number>(0);

  // -------------------------------------------------------------
  // 1. Procedural High-Fidelity Mars Albedo Map Generator
  // -------------------------------------------------------------
  const createProceduralMarsTexture = useCallback(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Base Martian Iron-Oxide Ochre Gradient
    const baseGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    baseGrad.addColorStop(0.0, '#ECEFF1'); // North Polar Ice Cap (Planum Boreum)
    baseGrad.addColorStop(0.06, '#D89A6A'); // Polar dune collar
    baseGrad.addColorStop(0.2, '#B45E35'); // Vastitas Borealis lowlands
    baseGrad.addColorStop(0.45, '#873E23'); // Equatorial transition
    baseGrad.addColorStop(0.65, '#A04724'); // Southern cratered highlands
    baseGrad.addColorStop(0.92, '#C2744B'); // South polar permafrost
    baseGrad.addColorStop(1.0, '#F5F5F7'); // South Polar Ice Cap (Planum Australe)
    ctx.fillStyle = baseGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Multi-octave surface mottling & roughness
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;

    // Helper pseudo-random noise for cratering and dust streaks
    for (let y = 0; y < canvas.height; y++) {
      const latFraction = Math.abs((y / canvas.height) - 0.5) * 2; // 0 at equator, 1 at poles
      for (let x = 0; x < canvas.width; x++) {
        const idx = (y * canvas.width + x) * 4;

        // Skip polar ice caps
        if (latFraction > 0.88) continue;

        // Multi-frequency noise
        const n1 = Math.sin(x * 0.02) * Math.cos(y * 0.03);
        const n2 = Math.sin(x * 0.08 + n1 * 2) * Math.cos(y * 0.08);
        const n3 = Math.sin(x * 0.25) * Math.sin(y * 0.25) * 0.5;
        const noise = (n1 * 0.5 + n2 * 0.35 + n3 * 0.15) * 28;

        data[idx] = Math.max(0, Math.min(255, data[idx] + noise));
        data[idx + 1] = Math.max(0, Math.min(255, data[idx + 1] + noise * 0.6));
        data[idx + 2] = Math.max(0, Math.min(255, data[idx + 2] + noise * 0.3));
      }
    }
    ctx.putImageData(imgData, 0, 0);

    // Major Planetary Albedo Features (Equirectangular Coordinate Mapping)
    const lonLatToCanvas = (lon: number, lat: number) => {
      let l = lon;
      while (l < -180) l += 360;
      while (l > 180) l -= 360;
      const x = ((l + 180) / 360) * canvas.width;
      const y = ((90 - lat) / 180) * canvas.height;
      return { x, y };
    };

    // 1. Syrtis Major Planum (Dark Basaltic Volcanic Plateau near Jezero)
    const sm = lonLatToCanvas(68, 10);
    const smGrad = ctx.createRadialGradient(sm.x, sm.y, 5, sm.x, sm.y, 110);
    smGrad.addColorStop(0.0, 'rgba(42, 22, 16, 0.85)');
    smGrad.addColorStop(0.6, 'rgba(65, 34, 24, 0.6)');
    smGrad.addColorStop(1.0, 'rgba(120, 50, 30, 0.0)');
    ctx.fillStyle = smGrad;
    ctx.beginPath();
    ctx.arc(sm.x, sm.y, 110, 0, Math.PI * 2);
    ctx.fill();

    // 2. Hellas Planitia (Huge bright impact basin)
    const hel = lonLatToCanvas(70, -42);
    const helGrad = ctx.createRadialGradient(hel.x, hel.y, 10, hel.x, hel.y, 140);
    helGrad.addColorStop(0.0, 'rgba(215, 145, 95, 0.9)');
    helGrad.addColorStop(0.7, 'rgba(180, 105, 65, 0.5)');
    helGrad.addColorStop(1.0, 'rgba(130, 50, 25, 0.0)');
    ctx.fillStyle = helGrad;
    ctx.beginPath();
    ctx.arc(hel.x, hel.y, 140, 0, Math.PI * 2);
    ctx.fill();

    // 3. Valles Marineris (Mega Canyon System)
    ctx.strokeStyle = 'rgba(45, 20, 15, 0.8)';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.beginPath();
    const vmStart = lonLatToCanvas(-90, -10);
    const vmMid = lonLatToCanvas(-65, -13);
    const vmEnd = lonLatToCanvas(-40, -14);
    ctx.moveTo(vmStart.x, vmStart.y);
    ctx.quadraticCurveTo(vmMid.x, vmMid.y, vmEnd.x, vmEnd.y);
    ctx.stroke();

    // 4. Olympus Mons & Tharsis Calderas
    const oly = lonLatToCanvas(-133.8, 18.65);
    const olyGrad = ctx.createRadialGradient(oly.x, oly.y, 4, oly.x, oly.y, 45);
    olyGrad.addColorStop(0.0, 'rgba(35, 18, 14, 0.9)');
    olyGrad.addColorStop(0.5, 'rgba(85, 40, 26, 0.7)');
    olyGrad.addColorStop(1.0, 'rgba(160, 70, 38, 0.0)');
    ctx.fillStyle = olyGrad;
    ctx.beginPath();
    ctx.arc(oly.x, oly.y, 45, 0, Math.PI * 2);
    ctx.fill();

    // 5. Jezero Crater Local Subtle Marker Ring on Global Texture
    const jez = lonLatToCanvas(JEZERO_LON, JEZERO_LAT);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(jez.x, jez.y, 7, 0, Math.PI * 2);
    ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  }, []);

  // -------------------------------------------------------------
  // 2. Initialize Three.js Scene, Camera, Renderer, Starfield
  // -------------------------------------------------------------
  useEffect(() => {
    if (!mountRef.current) return;

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020306);
    sceneRef.current = scene;

    // 2. Perspective Camera with Wide Planetary Frustum
    // Near=1 km, Far=100,000 km to comfortably view globe (R=3396 km) and outer space
    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 100000);
    cameraRef.current = camera;

    // 3. WebGL Renderer with High-Precision Depth & ACES Tone Mapping
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    rendererRef.current = renderer;
    mountRef.current.appendChild(renderer.domElement);

    // 4. Planetary Lighting System
    // Ambient starlight/earthlight fill
    const ambientLight = new THREE.AmbientLight(0x281912, 0.55);
    scene.add(ambientLight);

    // Direct Sunlight (Solar Flux)
    const sunLight = new THREE.DirectionalLight(0xFFF2E0, 2.2);
    sunLight.position.set(7000, 2500, 6000);
    scene.add(sunLight);
    sunLightRef.current = sunLight;

    // Subtle Hemisphere bounce light
    const hemiLight = new THREE.HemisphereLight(0x382218, 0x110B08, 0.4);
    scene.add(hemiLight);

    // 5. Starfield Sky Shell (Deep Space Backdrop)
    const starsCount = 3500;
    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starsCount * 3);
    const starColors = new Float32Array(starsCount * 3);

    for (let i = 0; i < starsCount; i++) {
      // Uniform spherical random distribution on 35,000 km sphere
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 35000 + Math.random() * 5000;

      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.cos(phi);
      starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

      // Star temperature tint (subtle cool blue, warm yellow, or white)
      const starType = Math.random();
      if (starType > 0.8) {
        starColors[i * 3] = 0.85; starColors[i * 3 + 1] = 0.92; starColors[i * 3 + 2] = 1.0;
      } else if (starType > 0.6) {
        starColors[i * 3] = 1.0; starColors[i * 3 + 1] = 0.88; starColors[i * 3 + 2] = 0.75;
      } else {
        starColors[i * 3] = 0.95; starColors[i * 3 + 1] = 0.95; starColors[i * 3 + 2] = 0.98;
      }
    }
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

    const starMaterial = new THREE.PointsMaterial({
      size: 40,
      vertexColors: true,
      transparent: true,
      opacity: 0.85
    });
    const starField = new THREE.Points(starGeometry, starMaterial);
    scene.add(starField);

    // 6. Complete Spherical Mars Planet Geometry
    // Radius = 3396.19 km, 128x64 tessellation for smooth planetary curvature
    const globeGeometry = new THREE.SphereGeometry(MARS_RADIUS_KM, 128, 64);
    const proceduralTex = createProceduralMarsTexture();

    const globeMaterial = new THREE.MeshStandardMaterial({
      map: proceduralTex || undefined,
      color: proceduralTex ? 0xFFFFFF : 0xBF532C,
      roughness: 0.88,
      metalness: 0.08,
      bumpScale: 12
    });

    const globeMesh = new THREE.Mesh(globeGeometry, globeMaterial);
    // Align Mars rotational axis (Mars obliquity is 25.19 degrees)
    globeMesh.rotation.z = THREE.MathUtils.degToRad(25.19);
    scene.add(globeMesh);
    globeMeshRef.current = globeMesh;

    // Load High-Res Global Viking MDIM2.1 Satellite Texture in Background
    const texLoader = new THREE.TextureLoader();
    const vikingTextureUrl = 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/Mars_Viking_MDIM21_mosaic.jpg/2880px-Mars_Viking_MDIM21_mosaic.jpg';
    texLoader.load(
      vikingTextureUrl,
      (satelliteTex) => {
        satelliteTex.wrapS = THREE.RepeatWrapping;
        satelliteTex.wrapT = THREE.ClampToEdgeWrapping;
        globeMaterial.map = satelliteTex;
        globeMaterial.needsUpdate = true;
      },
      undefined,
      () => {
        // Fallback already active with procedural high-fidelity texture
      }
    );

    // 7. Atmospheric Limb Glow (Martian Peach-Ochre Gas Shell)
    const atmosGeometry = new THREE.SphereGeometry(MARS_RADIUS_KM * 1.018, 96, 48);
    const atmosMaterial = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          vec3 viewDir = normalize(-vPosition);
          float fresnel = dot(vNormal, viewDir);
          fresnel = clamp(1.0 - fresnel, 0.0, 1.0);
          float intensity = pow(fresnel, 2.6) * 1.35;
          // Martian atmospheric scattering tint (ochre-peach dust glow)
          vec3 atmosphereColor = vec3(0.92, 0.54, 0.32);
          gl_FragColor = vec4(atmosphereColor, intensity * 0.75);
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false
    });
    const atmosMesh = new THREE.Mesh(atmosGeometry, atmosMaterial);
    atmosMesh.rotation.z = THREE.MathUtils.degToRad(25.19);
    scene.add(atmosMesh);
    atmosphereMeshRef.current = atmosMesh;

    // 8. Container Groups for Markers, Landmarks, and High-Res Terrain
    const markersGroup = new THREE.Group();
    markersGroup.rotation.z = THREE.MathUtils.degToRad(25.19);
    scene.add(markersGroup);
    markersGroupRef.current = markersGroup;

    const landmarksGroup = new THREE.Group();
    landmarksGroup.rotation.z = THREE.MathUtils.degToRad(25.19);
    scene.add(landmarksGroup);
    landmarksGroupRef.current = landmarksGroup;

    // Build Planetary Landmark Callouts
    PLANETARY_LANDMARKS.forEach((lm) => {
      const pos = lonLatToCartesian(lm.lon, lm.lat, MARS_RADIUS_KM + 15);
      const isEva = lm.type === 'eva';

      const beaconGroup = new THREE.Group();
      beaconGroup.position.copy(pos);

      // Align beacon normal outward from planet center
      beaconGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pos.clone().normalize());

      // Glowing Base Ring
      const ringGeom = new THREE.RingGeometry(isEva ? 15 : 8, isEva ? 28 : 14, 32);
      ringGeom.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: isEva ? 0x38BDF8 : 0xF59E0B,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: isEva ? 0.85 : 0.6
      });
      const ringMesh = new THREE.Mesh(ringGeom, ringMat);
      beaconGroup.add(ringMesh);

      // Vertical Marker Pillar
      const pillarGeom = new THREE.CylinderGeometry(1.5, 3, isEva ? 70 : 35, 12);
      pillarGeom.translate(0, (isEva ? 70 : 35) / 2, 0);
      const pillarMat = new THREE.MeshStandardMaterial({
        color: isEva ? 0x38BDF8 : 0xF59E0B,
        emissive: isEva ? 0x38BDF8 : 0xF59E0B,
        emissiveIntensity: 0.6
      });
      const pillarMesh = new THREE.Mesh(pillarGeom, pillarMat);
      beaconGroup.add(pillarMesh);

      landmarksGroup.add(beaconGroup);
    });

    // -------------------------------------------------------------
    // Mouse Drag, Wheel Zoom & Double-Click Navigation
    // -------------------------------------------------------------
    const dom = renderer.domElement;

    const onMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      dragButtonRef.current = e.button;
      prevMouseRef.current = { x: e.clientX, y: e.clientY };
      lastInteractionTimeRef.current = Date.now();
      velocityRef.current = { dTheta: 0, dPhi: 0 };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      lastInteractionTimeRef.current = Date.now();

      const dx = e.clientX - prevMouseRef.current.x;
      const dy = e.clientY - prevMouseRef.current.y;

      if (dragButtonRef.current === 0) {
        // Left Button: Rotate Planet Camera
        const rotSpeed = 0.0035;
        sphericalRef.current.theta -= dx * rotSpeed;
        sphericalRef.current.phi = Math.max(0.04, Math.min(Math.PI - 0.04, sphericalRef.current.phi - dy * rotSpeed));
        velocityRef.current = { dTheta: -dx * rotSpeed, dPhi: -dy * rotSpeed };
      } else if (dragButtonRef.current === 2) {
        // Right Button: Gentle Panning Offset
        const panSpeed = sphericalRef.current.radius * 0.0008;
        const up = camera.up.clone();
        const right = new THREE.Vector3().crossVectors(camera.getWorldDirection(new THREE.Vector3()), up).normalize();
        lookAtTargetRef.current.addScaledVector(right, -dx * panSpeed);
        lookAtTargetRef.current.addScaledVector(up, dy * panSpeed);
      }

      prevMouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isDraggingRef.current = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      lastInteractionTimeRef.current = Date.now();

      // Exponential/Multiplicative Zoom for Smooth Multi-Scale Transition
      // Clamped between 3415 km (surface eye-level, +19 km above terrain) and 25,000 km (outer space)
      const zoomFactor = 1.0 + Math.sign(e.deltaY) * 0.08;
      const newRadius = THREE.MathUtils.clamp(
        sphericalRef.current.radius * zoomFactor,
        3425,
        24000
      );
      sphericalRef.current.radius = newRadius;
    };

    // Double Click: Raycast to Globe Surface & Smoothly Fly Camera to that Coordinate
    const onDoubleClick = (e: MouseEvent) => {
      const rect = dom.getBoundingClientRect();
      const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), camera);

      if (globeMeshRef.current) {
        const intersects = raycaster.intersectObject(globeMeshRef.current);
        if (intersects.length > 0) {
          const pt = intersects[0].point;
          // Invert globe tilt rotation to get true planetary lat/lon
          const untilted = pt.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), -THREE.MathUtils.degToRad(25.19));
          const { lon, lat } = cartesianToLonLat(untilted);
          flyToPlanetaryCoordinate(lon, lat, Math.max(3700, sphericalRef.current.radius * 0.45));
        }
      }
    };

    dom.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    dom.addEventListener('wheel', onWheel, { passive: false });
    dom.addEventListener('dblclick', onDoubleClick);
    dom.addEventListener('contextmenu', (e) => e.preventDefault());

    // -------------------------------------------------------------
    // Animation Loop
    // -------------------------------------------------------------
    let reqId: number;

    const animate = () => {
      reqId = requestAnimationFrame(animate);

      // 1. Camera Flight Transition
      const flight = flightAnimRef.current;
      if (flight.active) {
        flight.progress += 1 / flight.durationFrames;
        const t = THREE.MathUtils.clamp(flight.progress, 0, 1);
        // Smooth Cubic In-Out Easing
        const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

        sphericalRef.current.theta = THREE.MathUtils.lerp(flight.startTheta, flight.targetTheta, ease);
        sphericalRef.current.phi = THREE.MathUtils.lerp(flight.startPhi, flight.targetPhi, ease);
        sphericalRef.current.radius = THREE.MathUtils.lerp(flight.startRadius, flight.targetRadius, ease);
        lookAtTargetRef.current.lerpVectors(flight.startLookAt, flight.targetLookAt, ease);

        if (flight.progress >= 1.0) {
          flight.active = false;
        }
      } else {
        // Inertia damping on mouse release
        if (!isDraggingRef.current) {
          sphericalRef.current.theta += velocityRef.current.dTheta;
          sphericalRef.current.phi = THREE.MathUtils.clamp(
            sphericalRef.current.phi + velocityRef.current.dPhi,
            0.04,
            Math.PI - 0.04
          );
          velocityRef.current.dTheta *= 0.92;
          velocityRef.current.dPhi *= 0.92;

          // Slow Idle Planetary Rotation (only in global view after 3s of idle)
          if (Date.now() - lastInteractionTimeRef.current > 3000 && sphericalRef.current.radius > 7500) {
            sphericalRef.current.theta += 0.0003;
          }
        }
      }

      // 2. Position Camera via Spherical Polar Math
      const { theta, phi, radius } = sphericalRef.current;
      const x = radius * Math.sin(phi) * Math.sin(theta);
      const y = radius * Math.cos(phi);
      const z = radius * Math.sin(phi) * Math.cos(theta);

      camera.position.set(
        lookAtTargetRef.current.x + x,
        lookAtTargetRef.current.y + y,
        lookAtTargetRef.current.z + z
      );
      camera.lookAt(lookAtTargetRef.current);

      // 3. Update Zoom Level & Telemetry
      const altKm = Math.round(radius - MARS_RADIUS_KM);
      let currentZoomLevel: 'global' | 'regional' | 'surface' = 'global';
      if (radius < 4500) {
        currentZoomLevel = 'surface';
      } else if (radius < 7500) {
        currentZoomLevel = 'regional';
      }
      setZoomLevel(currentZoomLevel);

      // Sub-spacecraft lat/lon (where the camera is looking down from)
      const subCoords = cartesianToLonLat(camera.position);
      setTelemetry((prev) => ({
        ...prev,
        subLon: parseFloat(subCoords.lon.toFixed(1)),
        subLat: parseFloat(subCoords.lat.toFixed(1)),
        altitudeKm: altKm
      }));

      // Crossfade High-Res Terrain Patch & Landmark Visibility based on Altitude
      if (jezeroTerrainMeshRef.current) {
        const terrainMat = jezeroTerrainMeshRef.current.material as THREE.MeshStandardMaterial;
        // Fade in when approaching surface (radius < 6500 km)
        const opacity = THREE.MathUtils.clamp((6500 - radius) / 2000, 0, 1);
        terrainMat.opacity = opacity;
        terrainMat.transparent = opacity < 1.0;
        jezeroTerrainMeshRef.current.visible = opacity > 0.01;
      }

      if (landmarksGroupRef.current) {
        // Hide landmark pillars when deep at surface level
        landmarksGroupRef.current.visible = showLandmarks && radius > 4200;
      }

      // 4. Drone Flyover Mode along Calculated Route
      if (cameraMode === 'drone' && routePlan && routePlan.coords_lonlat.length > 2 && isPlayingFlyover) {
        droneAnimProgressRef.current = (droneAnimProgressRef.current + 0.0008) % 1.0;
        const pts = routePlan.coords_lonlat;
        const idx = Math.floor(droneAnimProgressRef.current * (pts.length - 1));
        const [lon1, lat1] = pts[idx];
        const [lon2, lat2] = pts[Math.min(idx + 1, pts.length - 1)];

        const p1 = lonLatToCartesian(lon1, lat1, MARS_RADIUS_KM + 12).applyAxisAngle(new THREE.Vector3(0, 0, 1), THREE.MathUtils.degToRad(25.19));
        const p2 = lonLatToCartesian(lon2, lat2, MARS_RADIUS_KM + 6).applyAxisAngle(new THREE.Vector3(0, 0, 1), THREE.MathUtils.degToRad(25.19));

        camera.position.set(p1.x, p1.y + 15, p1.z + 15);
        camera.lookAt(p2);
      }

      renderer.render(scene, camera);
    };

    animate();

    // Resize Handler
    const handleResize = () => {
      if (!mountRef.current || !renderer || !camera) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(reqId);
      dom.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      dom.removeEventListener('wheel', onWheel);
      dom.removeEventListener('dblclick', onDoubleClick);
      window.removeEventListener('resize', handleResize);
      if (mountRef.current && dom) {
        mountRef.current.removeChild(dom);
      }
      renderer.dispose();
    };
  }, [createProceduralMarsTexture]);

  // -------------------------------------------------------------
  // 3. Smooth Camera Fly-To Function
  // -------------------------------------------------------------
  const flyToPlanetaryCoordinate = useCallback((lon: number, lat: number, targetRadius: number = 3800) => {
    // Convert lon/lat to spherical theta/phi
    let phi = (90 - lat) * (Math.PI / 180);
    let theta = (lon + 180) * (Math.PI / 180) - Math.PI / 2;

    // Normalize target theta to prevent 360-degree spins
    let currentTheta = sphericalRef.current.theta;
    while (theta - currentTheta > Math.PI) theta -= Math.PI * 2;
    while (theta - currentTheta < -Math.PI) theta += Math.PI * 2;

    flightAnimRef.current = {
      active: true,
      startTheta: currentTheta,
      startPhi: sphericalRef.current.phi,
      startRadius: sphericalRef.current.radius,
      startLookAt: lookAtTargetRef.current.clone(),
      targetTheta: theta,
      targetPhi: phi,
      targetRadius: targetRadius,
      targetLookAt: new THREE.Vector3(0, 0, 0),
      progress: 0,
      durationFrames: 70
    };
    lastInteractionTimeRef.current = Date.now();
  }, []);

  // Quick Action: Fly to Jezero Crater Exploration Zone
  const handleFlyToJezero = () => {
    flyToPlanetaryCoordinate(JEZERO_LON, JEZERO_LAT, 3650);
  };

  // Quick Action: Reset to Full Planetary View
  const handleResetToGlobal = () => {
    flightAnimRef.current = {
      active: true,
      startTheta: sphericalRef.current.theta,
      startPhi: sphericalRef.current.phi,
      startRadius: sphericalRef.current.radius,
      startLookAt: lookAtTargetRef.current.clone(),
      targetTheta: -0.65,
      targetPhi: 1.15,
      targetRadius: 9200,
      targetLookAt: new THREE.Vector3(0, 0, 0),
      progress: 0,
      durationFrames: 60
    };
    setCameraMode('orbit');
    setIsPlayingFlyover(false);
  };

  // -------------------------------------------------------------
  // 4. Build High-Resolution 3D Jezero CTX DTM Terrain Patch
  // -------------------------------------------------------------
  useEffect(() => {
    if (!sceneRef.current || !meshData) return;

    // Remove existing patch
    if (jezeroTerrainMeshRef.current) {
      sceneRef.current.remove(jezeroTerrainMeshRef.current);
      jezeroTerrainMeshRef.current.geometry.dispose();
      jezeroTerrainMeshRef.current = null;
    }

    const { grid_width, grid_height, elevations, min_elev_m, max_elev_m } = meshData;

    // The USGS Mars 2020 Jezero CTX tile is ~30.24 km by ~31.92 km
    // In our km world coordinates (R=3396.19 km), the patch width is 30.24 and height is 31.92
    const patchWidthKm = 30.24;
    const patchHeightKm = 31.92;

    const geometry = new THREE.PlaneGeometry(
      patchWidthKm,
      patchHeightKm,
      grid_width - 1,
      grid_height - 1
    );

    const pos = geometry.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const elevRange = Math.max(max_elev_m - min_elev_m, 1.0);

    // Apply Real 3D Elevation Displacements & Mineral Shading
    for (let i = 0; i < pos.count; i++) {
      const e = elevations[i] !== undefined ? elevations[i] : min_elev_m;
      const norm = (e - min_elev_m) / elevRange; // 0.0 to 1.0

      // Metric elevation in km (e.g. -2.7 km to -1.5 km is ~1.2 km of relief)
      // Displace Z outward from the tangent plane
      const reliefKm = (norm * 1.8) * vertExaggeration;
      pos.setZ(i, reliefKm);

      // Realistic Jezero Mineralogy Palette:
      // Low floor: dark basaltic olivine sand (0.52, 0.22, 0.14)
      // Delta scarp: oxidized smectite clay & carbonate deposits (0.76, 0.44, 0.26)
      // Crater rim & Belva ejecta: silicate bedrock (0.86, 0.62, 0.42)
      colors[i * 3] = 0.52 + norm * 0.34;
      colors[i * 3 + 1] = 0.22 + norm * 0.40;
      colors[i * 3 + 2] = 0.14 + norm * 0.28;
    }

    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.85,
      metalness: 0.1,
      side: THREE.DoubleSide
    });

    const terrainMesh = new THREE.Mesh(geometry, material);

    // Position tangent to the sphere surface at Jezero's coordinates
    const jezeroCenterCartesian = lonLatToCartesian(JEZERO_LON, JEZERO_LAT, MARS_RADIUS_KM + 0.5);
    terrainMesh.position.copy(jezeroCenterCartesian);

    // Orient plane normal outward from sphere center
    const normal = jezeroCenterCartesian.clone().normalize();
    terrainMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);

    // Add to Mars tilted coordinate frame
    if (globeMeshRef.current) {
      globeMeshRef.current.add(terrainMesh);
    }
    jezeroTerrainMeshRef.current = terrainMesh;
  }, [meshData, vertExaggeration]);

  // -------------------------------------------------------------
  // 5. Update Surface Markers, Route Ribbon & Science Targets
  // -------------------------------------------------------------
  useEffect(() => {
    const markersGroup = markersGroupRef.current;
    if (!markersGroup) return;

    markersGroup.clear();

    // 1. Draw 3D Route Ribbon along Sphere Surface
    if (routePlan && routePlan.coords_lonlat.length > 1) {
      const linePts: THREE.Vector3[] = [];
      routePlan.coords_lonlat.forEach(([lon, lat]) => {
        // Place line slightly above planetary surface (+3 km) to prevent z-fighting
        const p = lonLatToCartesian(lon, lat, MARS_RADIUS_KM + 3.0);
        linePts.push(p);
      });

      const lineGeom = new THREE.BufferGeometry().setFromPoints(linePts);
      const lineMat = new THREE.LineBasicMaterial({
        color: routePlan.mode === 'safe' ? 0x38BDF8 : 0xF97316,
        linewidth: 4
      });
      const line = new THREE.Line(lineGeom, lineMat);
      markersGroup.add(line);
      routeLineRef.current = line;
    }

    // 2. Staging Marker (Green Pin)
    const startPos = lonLatToCartesian(startCoords[0], startCoords[1], MARS_RADIUS_KM + 2.0);
    const startPin = createPlanetaryPin(0x22C55E, 6.0);
    startPin.position.copy(startPos);
    startPin.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), startPos.clone().normalize());
    markersGroup.add(startPin);

    // 3. Target Marker (Red Pin)
    const targetPos = lonLatToCartesian(targetCoords[0], targetCoords[1], MARS_RADIUS_KM + 2.0);
    const targetPin = createPlanetaryPin(0xEF4444, 7.5);
    targetPin.position.copy(targetPos);
    targetPin.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), targetPos.clone().normalize());
    markersGroup.add(targetPin);

    // 4. Science Target POI Diamonds
    scienceTargets.forEach((t) => {
      const pos = lonLatToCartesian(t.lon, t.lat, MARS_RADIUS_KM + 3.5);
      const isSelected = t.target_id === selectedTargetId;
      const diamond = createScienceDiamond(isSelected ? 0xC084FC : 0x818CF8, isSelected ? 5.5 : 3.5);
      diamond.position.copy(pos);
      markersGroup.add(diamond);
    });
  }, [routePlan, startCoords, targetCoords, scienceTargets, selectedTargetId]);

  // -------------------------------------------------------------
  // 6. Update MEDA Solar Elevation Lighting
  // -------------------------------------------------------------
  useEffect(() => {
    if (!sunLightRef.current || !environment) return;
    const elev = environment.solar_elevation_deg;
    const rad = THREE.MathUtils.degToRad(elev);
    const sunDist = 8000;
    const sunY = Math.sin(rad) * sunDist;
    const sunX = Math.cos(rad) * sunDist;
    sunLightRef.current.position.set(sunX, Math.max(sunY, 800), 5000);
    sunLightRef.current.intensity = elev > 0 ? 2.4 : 0.4;
  }, [environment]);

  return (
    <div className="relative w-full h-full select-none overflow-hidden bg-mars-dark">
      {/* 3D WebGL Canvas */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top-Left: Tactical Globe Navigation Controls */}
      <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
        <div className="bg-mars-panel/90 backdrop-blur border border-mars-border p-2.5 rounded-xl flex items-center gap-3 shadow-2xl text-xs">
          <div className="flex items-center gap-1.5 border-r border-mars-border/60 pr-3">
            <Compass className="w-4 h-4 text-mars-accent animate-spin-slow" />
            <span className="font-bold text-white tracking-wider uppercase text-[11px]">3D Mars Globe</span>
          </div>

          {/* Zoom Level Indicator Badge */}
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-mars-dark border border-mars-border font-mono text-[10px]">
            <span className="text-mars-subtle">SCALE:</span>
            <span className={`font-bold ${
              zoomLevel === 'surface'
                ? 'text-emerald-400'
                : zoomLevel === 'regional'
                ? 'text-sky-400'
                : 'text-amber-400'
            }`}>
              {zoomLevel.toUpperCase()}
            </span>
          </div>

          {/* Fly to Jezero Action */}
          <button
            onClick={handleFlyToJezero}
            className="px-2.5 py-1 bg-mars-red hover:bg-mars-red/90 text-white rounded-lg font-semibold transition flex items-center gap-1 shadow"
            title="Fly directly to Jezero Crater EVA Region"
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Fly to Jezero</span>
          </button>

          {/* Reset to Global View */}
          <button
            onClick={handleResetToGlobal}
            className="p-1.5 rounded-lg border border-mars-border hover:bg-mars-border text-mars-subtle hover:text-white transition"
            title="Reset to Full Spherical Globe View"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Camera Mode Toggles (Orbit vs Drone) */}
        <div className="bg-mars-panel/90 backdrop-blur border border-mars-border p-1.5 rounded-lg flex items-center gap-1.5 w-fit text-xs">
          <button
            onClick={() => { setCameraMode('orbit'); setIsPlayingFlyover(false); }}
            className={`px-2.5 py-1 rounded text-xs transition ${
              cameraMode === 'orbit'
                ? 'bg-mars-accent text-black font-semibold'
                : 'text-mars-subtle hover:text-white'
            }`}
          >
            Planetary Orbit
          </button>

          <button
            onClick={() => { setCameraMode('drone'); setIsPlayingFlyover(true); }}
            className={`px-2.5 py-1 rounded text-xs transition ${
              cameraMode === 'drone'
                ? 'bg-mars-accent text-black font-semibold'
                : 'text-mars-subtle hover:text-white'
            }`}
          >
            Drone Flyover
          </button>

          {cameraMode === 'drone' && (
            <button
              onClick={() => setIsPlayingFlyover(!isPlayingFlyover)}
              className="p-1 rounded bg-mars-dark hover:bg-mars-border text-white"
            >
              {isPlayingFlyover ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>
          )}

          <button
            onClick={() => setShowLandmarks(!showLandmarks)}
            className={`px-2 py-1 rounded text-[11px] border transition ${
              showLandmarks
                ? 'border-mars-accent/40 text-mars-accent bg-mars-accent/10'
                : 'border-mars-border text-mars-subtle'
            }`}
            title="Toggle Planetary Landmarks"
          >
            Landmarks
          </button>
        </div>
      </div>

      {/* Top-Right: Surface Relief Exaggeration Slider (Active when near surface) */}
      {zoomLevel === 'surface' && (
        <div className="absolute top-4 right-4 z-20 bg-mars-panel/90 backdrop-blur border border-mars-border px-3 py-2 rounded-xl flex items-center gap-2.5 shadow-2xl text-xs font-mono">
          <Sliders className="w-3.5 h-3.5 text-mars-subtle" />
          <span className="text-mars-subtle text-[11px]">Relief Exag:</span>
          <span className="text-mars-accent font-bold">{vertExaggeration.toFixed(1)}x</span>
          <input
            type="range"
            min="1.0"
            max="3.5"
            step="0.1"
            value={vertExaggeration}
            onChange={(e) => setVertExaggeration(Number(e.target.value))}
            className="w-20 accent-mars-accent cursor-pointer h-1.5 bg-mars-border rounded-lg"
          />
        </div>
      )}

      {/* Bottom-Left: Real-Time Planetary Sub-Spacecraft Telemetry */}
      <div className="absolute bottom-4 left-4 z-20 bg-mars-panel/90 backdrop-blur border border-mars-border px-3 py-1.5 rounded-lg text-[11px] font-mono text-mars-subtle shadow-md flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-white font-semibold">ORBITAL TELEMETRY</span>
        </div>
        <span>|</span>
        <span>SUB-LON: <strong className="text-slate-200">{telemetry.subLon > 0 ? `${telemetry.subLon}°E` : `${Math.abs(telemetry.subLon)}°W`}</strong></span>
        <span>SUB-LAT: <strong className="text-slate-200">{telemetry.subLat > 0 ? `+${telemetry.subLat}°N` : `${telemetry.subLat}°S`}</strong></span>
        <span>ALTITUDE: <strong className="text-mars-accent">{telemetry.altitudeKm.toLocaleString()} km</strong></span>
      </div>

      {/* Bottom-Right: Reference Ellipsoid & Interaction Tip */}
      <div className="absolute bottom-4 right-4 z-20 bg-mars-panel/90 backdrop-blur border border-mars-border px-3 py-1.5 rounded-lg text-[11px] font-mono text-mars-subtle shadow-md flex items-center gap-2">
        <span>Mars IAU 2000 Mean Sphere (R=3,396.19 km)</span>
        <span className="text-slate-500">•</span>
        <span className="text-slate-400">Left Drag: Orbit | Scroll: Zoom | DblClick: Focus</span>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// Visual Marker Generators
// -------------------------------------------------------------
function createPlanetaryPin(colorHex: number, radiusKm: number) {
  const group = new THREE.Group();

  // Glowing sphere head
  const headGeom = new THREE.SphereGeometry(radiusKm, 16, 16);
  const headMat = new THREE.MeshStandardMaterial({
    color: colorHex,
    emissive: colorHex,
    emissiveIntensity: 0.5,
    roughness: 0.2
  });
  const head = new THREE.Mesh(headGeom, headMat);
  head.position.y = radiusKm * 2.8;
  group.add(head);

  // Tapered needle pointing down at surface
  const needleGeom = new THREE.ConeGeometry(radiusKm * 0.35, radiusKm * 2.8, 12);
  needleGeom.rotateX(Math.PI);
  needleGeom.translate(0, radiusKm * 1.4, 0);
  const needleMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
  const needle = new THREE.Mesh(needleGeom, needleMat);
  group.add(needle);

  return group;
}

function createScienceDiamond(colorHex: number, sizeKm: number) {
  const geom = new THREE.OctahedronGeometry(sizeKm);
  const mat = new THREE.MeshStandardMaterial({
    color: colorHex,
    emissive: colorHex,
    emissiveIntensity: 0.5,
    roughness: 0.3
  });
  return new THREE.Mesh(geom, mat);
}

export default MarsGlobeViewer;
