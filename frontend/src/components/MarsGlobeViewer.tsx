import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
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
  Globe2,
  Mountain,
  Footprints,
  Video,
  Layers,
  ChevronRight,
  Sun
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

// Major Martian Geological Landmarks for Orientation & Navigation
const PLANETARY_LANDMARKS = [
  { name: 'Jezero Crater (EVA Target)', lon: 77.45, lat: 18.44, alt: 3500, type: 'eva', desc: 'Ancient lake delta & Perseverance rover site' },
  { name: 'Olympus Mons', lon: -133.8, lat: 18.65, alt: 5200, type: 'volcano', desc: 'Solar System’s tallest shield volcano (21.9 km height)' },
  { name: 'Valles Marineris', lon: -65.0, lat: -13.9, alt: 5400, type: 'canyon', desc: 'Vast canyon system (4,000 km long, 7 km deep)' },
  { name: 'Gale Crater (Curiosity)', lon: 137.4, lat: -5.4, alt: 4200, type: 'crater', desc: 'Mount Sharp sedimentary strata' },
  { name: 'Hellas Planitia', lon: 70.0, lat: -42.4, alt: 5800, type: 'basin', desc: 'Giant 2,300 km impact basin (9 km deep)' },
  { name: 'North Polar Cap (Planum Boreum)', lon: 0.0, lat: 85.0, alt: 5000, type: 'polar', desc: 'Water-ice and seasonal CO2 ice cap' },
  { name: 'South Polar Cap (Planum Australe)', lon: 0.0, lat: -85.0, alt: 5000, type: 'polar', desc: 'Permanent CO2 dry ice deposit' },
  { name: 'Elysium Mons', lon: 147.2, lat: 25.0, alt: 5000, type: 'volcano', desc: 'Major northern volcanic province' }
];

/**
 * Coordinate conversions: Martian Longitude/Latitude <-> Cartesian 3D (IAU 2000)
 */
export function lonLatToCartesian(lon: number, lat: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  return new THREE.Vector3(x, y, z);
}

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

  // High-Level View Mode: 'globe' (Planetary 3D Sphere) vs 'surface' (High-Res 3D Jezero Terrain)
  const [viewLevel, setViewLevel] = useState<'globe' | 'surface'>('globe');

  // Surface Camera Sub-Modes
  const [surfaceCameraMode, setSurfaceCameraMode] = useState<'orbit' | 'drone' | 'astronaut'>('orbit');
  const [vertExaggeration, setVertExaggeration] = useState<number>(2.0);
  const [isPlayingFlyover, setIsPlayingFlyover] = useState<boolean>(false);
  const [showLandmarks, setShowLandmarks] = useState<boolean>(true);
  const [showContourLines, setShowContourLines] = useState<boolean>(true);

  // Live Planetary Telemetry
  const [telemetry, setTelemetry] = useState({
    subLon: 77.5,
    subLat: 18.4,
    altitudeKm: 5800,
    cameraFov: 45
  });

  // Three.js References
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  // Globe Objects Group (Planetary view)
  const globeGroupRef = useRef<THREE.Group | null>(null);
  const globeMeshRef = useRef<THREE.Mesh | null>(null);
  const atmosphereMeshRef = useRef<THREE.Mesh | null>(null);
  const landmarksGroupRef = useRef<THREE.Group | null>(null);

  // Surface Terrain Objects Group (High-Res Jezero view)
  const surfaceGroupRef = useRef<THREE.Group | null>(null);
  const surfaceTerrainMeshRef = useRef<THREE.Mesh | null>(null);
  const surfaceRouteLineRef = useRef<THREE.Line | null>(null);
  const surfaceMarkersGroupRef = useRef<THREE.Group | null>(null);

  // Globe Camera Orbit Math
  const sphericalRef = useRef({
    theta: -0.65, // Centered on Eastern hemisphere towards Jezero Crater
    phi: 1.15,
    radius: 9200
  });
  const lookAtTargetRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));

  // Surface Camera Orbit Math
  const surfaceSphericalRef = useRef({
    theta: Math.PI / 4,
    phi: Math.PI / 3.2,
    radius: 360
  });
  const surfaceLookAtRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));

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
    onComplete?: () => void;
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

  // -------------------------------------------------------------------------
  // 1. Procedural 4096x2048 Ultra-Detailed Mars Albedo & Topographic Bump Map
  // -------------------------------------------------------------------------
  const marsTextures = useMemo(() => {
    const width = 4096;
    const height = 2048;

    // A. Surface Color / Albedo Canvas
    const colorCanvas = document.createElement('canvas');
    colorCanvas.width = width;
    colorCanvas.height = height;
    const ctx = colorCanvas.getContext('2d');

    // B. Topographic Relief / Bump Map Canvas
    const bumpCanvas = document.createElement('canvas');
    bumpCanvas.width = width;
    bumpCanvas.height = height;
    const bumpCtx = bumpCanvas.getContext('2d');

    if (!ctx || !bumpCtx) return { color: null, bump: null };

    // 1. Base MOLA Elevation Gradient (True Hypsometric Tinting)
    const baseGrad = ctx.createLinearGradient(0, 0, 0, height);
    baseGrad.addColorStop(0.0, '#F5F7FA'); // North Pole Ice Cap (Planum Boreum)
    baseGrad.addColorStop(0.04, '#E2E8F0'); // Polar dunes & frost collar
    baseGrad.addColorStop(0.12, '#964826'); // Vastitas Borealis Lowlands
    baseGrad.addColorStop(0.35, '#BA592E'); // Northern plains / Chryse Planitia
    baseGrad.addColorStop(0.50, '#B35328'); // Equatorial cratered plateaus
    baseGrad.addColorStop(0.72, '#8E3F1F'); // Southern cratered highlands
    baseGrad.addColorStop(0.92, '#C7754B'); // South polar permafrost
    baseGrad.addColorStop(1.0, '#FFFFFF'); // South Polar Ice Cap (Planum Australe)
    ctx.fillStyle = baseGrad;
    ctx.fillRect(0, 0, width, height);

    // Bump Map Neutral Base (Mid-gray = 0 datum elevation)
    const bumpBase = bumpCtx.createLinearGradient(0, 0, 0, height);
    bumpBase.addColorStop(0.0, '#888888');
    bumpBase.addColorStop(0.12, '#484848'); // Low northern plains (-4 km)
    bumpBase.addColorStop(0.50, '#808080'); // Datum (0 km)
    bumpBase.addColorStop(0.72, '#B4B4B4'); // Elevated southern highlands (+3 km)
    bumpBase.addColorStop(1.0, '#888888');
    bumpCtx.fillStyle = bumpBase;
    bumpCtx.fillRect(0, 0, width, height);

    // 2. High-Frequency Regolith Noise & Dune Fields
    const imgData = ctx.getImageData(0, 0, width, height);
    const bumpData = bumpCtx.getImageData(0, 0, width, height);
    const cData = imgData.data;
    const bData = bumpData.data;

    for (let y = 0; y < height; y += 2) {
      const latFraction = Math.abs((y / height) - 0.5) * 2;
      for (let x = 0; x < width; x += 2) {
        if (latFraction > 0.90) continue; // Keep polar caps clean ice

        // Multi-frequency fractal noise
        const n1 = Math.sin(x * 0.015) * Math.cos(y * 0.02);
        const n2 = Math.sin(x * 0.06 + n1 * 1.5) * Math.cos(y * 0.06);
        const n3 = Math.sin(x * 0.18) * Math.sin(y * 0.18) * 0.4;
        const noiseVal = (n1 * 0.5 + n2 * 0.35 + n3 * 0.15) * 32;

        const idx = (y * width + x) * 4;
        cData[idx] = Math.max(0, Math.min(255, cData[idx] + noiseVal));
        cData[idx + 1] = Math.max(0, Math.min(255, cData[idx + 1] + noiseVal * 0.55));
        cData[idx + 2] = Math.max(0, Math.min(255, cData[idx + 2] + noiseVal * 0.28));

        // Relief bump variance
        const bVal = Math.max(0, Math.min(255, bData[idx] + noiseVal * 0.8));
        bData[idx] = bVal;
        bData[idx + 1] = bVal;
        bData[idx + 2] = bVal;
      }
    }
    ctx.putImageData(imgData, 0, 0);
    bumpCtx.putImageData(bumpData, 0, 0);

    // Coordinate conversion helper for planetary features
    const coordToPixel = (lon: number, lat: number) => {
      let l = lon;
      while (l < -180) l += 360;
      while (l > 180) l -= 360;
      const x = ((l + 180) / 360) * width;
      const y = ((90 - lat) / 180) * height;
      return { x, y };
    };

    // 3. Draw Major Martian Geological Features

    // A. Syrtis Major Planum (Basaltic volcanic shield next to Jezero)
    const sm = coordToPixel(68, 10);
    const smGrad = ctx.createRadialGradient(sm.x, sm.y, 10, sm.x, sm.y, 220);
    smGrad.addColorStop(0.0, 'rgba(38, 20, 14, 0.92)');
    smGrad.addColorStop(0.6, 'rgba(58, 28, 20, 0.7)');
    smGrad.addColorStop(1.0, 'rgba(120, 50, 30, 0.0)');
    ctx.fillStyle = smGrad;
    ctx.beginPath();
    ctx.arc(sm.x, sm.y, 220, 0, Math.PI * 2);
    ctx.fill();

    const smBump = bumpCtx.createRadialGradient(sm.x, sm.y, 10, sm.x, sm.y, 220);
    smBump.addColorStop(0.0, 'rgb(180, 180, 180)');
    smBump.addColorStop(1.0, 'rgb(128, 128, 128)');
    bumpCtx.fillStyle = smBump;
    bumpCtx.beginPath();
    bumpCtx.arc(sm.x, sm.y, 220, 0, Math.PI * 2);
    bumpCtx.fill();

    // B. Jezero Crater Highlight & Delta Feature (77.45°E, 18.44°N)
    const jez = coordToPixel(JEZERO_LON, JEZERO_LAT);
    // Crater floor
    ctx.fillStyle = 'rgba(42, 22, 16, 0.85)';
    ctx.beginPath();
    ctx.arc(jez.x, jez.y, 18, 0, Math.PI * 2);
    ctx.fill();
    // Crater rim
    ctx.strokeStyle = 'rgba(235, 145, 95, 0.9)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(jez.x, jez.y, 18, 0, Math.PI * 2);
    ctx.stroke();
    // Delta fan deposit
    ctx.fillStyle = 'rgba(215, 130, 75, 0.95)';
    ctx.beginPath();
    ctx.arc(jez.x - 6, jez.y + 2, 7, 0, Math.PI * 2);
    ctx.fill();

    // Jezero Crater in bump map (depression + raised rim)
    bumpCtx.strokeStyle = 'rgb(240, 240, 240)'; // Raised rim
    bumpCtx.lineWidth = 5;
    bumpCtx.beginPath();
    bumpCtx.arc(jez.x, jez.y, 18, 0, Math.PI * 2);
    bumpCtx.stroke();
    bumpCtx.fillStyle = 'rgb(45, 45, 45)'; // Crater floor depression
    bumpCtx.beginPath();
    bumpCtx.arc(jez.x, jez.y, 15, 0, Math.PI * 2);
    bumpCtx.fill();

    // C. Olympus Mons (21.9 km peak - tallest volcano in the Solar System)
    const oly = coordToPixel(-133.8, 18.65);
    const olyGrad = ctx.createRadialGradient(oly.x, oly.y, 6, oly.x, oly.y, 90);
    olyGrad.addColorStop(0.0, 'rgba(45, 24, 18, 0.95)'); // Caldera
    olyGrad.addColorStop(0.3, 'rgba(145, 75, 45, 0.9)'); // Slopes
    olyGrad.addColorStop(0.8, 'rgba(85, 38, 22, 0.7)'); // Outer scarp
    olyGrad.addColorStop(1.0, 'rgba(180, 80, 40, 0.0)');
    ctx.fillStyle = olyGrad;
    ctx.beginPath();
    ctx.arc(oly.x, oly.y, 90, 0, Math.PI * 2);
    ctx.fill();

    // Olympus Mons Relief Peak (+22 km white summit in bump map)
    const olyBump = bumpCtx.createRadialGradient(oly.x, oly.y, 4, oly.x, oly.y, 90);
    olyBump.addColorStop(0.0, 'rgb(255, 255, 255)'); // Peak
    olyBump.addColorStop(0.8, 'rgb(210, 210, 210)'); // Flank
    olyBump.addColorStop(0.85, 'rgb(140, 140, 140)'); // Basal scarp drop
    olyBump.addColorStop(1.0, 'rgb(90, 90, 90)');
    bumpCtx.fillStyle = olyBump;
    bumpCtx.beginPath();
    bumpCtx.arc(oly.x, oly.y, 90, 0, Math.PI * 2);
    bumpCtx.fill();

    // D. Tharsis Montes Chain (Ascraeus, Pavonis, Arsia)
    [
      { lon: -104.4, lat: 11.9, r: 60 },
      { lon: -112.9, lat: 0.8, r: 55 },
      { lon: -120.5, lat: -8.4, r: 58 }
    ].forEach((tm) => {
      const p = coordToPixel(tm.lon, tm.lat);
      const grad = ctx.createRadialGradient(p.x, p.y, 4, p.x, p.y, tm.r);
      grad.addColorStop(0.0, 'rgba(48, 25, 18, 0.9)');
      grad.addColorStop(0.7, 'rgba(110, 52, 32, 0.7)');
      grad.addColorStop(1.0, 'rgba(160, 70, 40, 0.0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, tm.r, 0, Math.PI * 2);
      ctx.fill();

      const bGrad = bumpCtx.createRadialGradient(p.x, p.y, 4, p.x, p.y, tm.r);
      bGrad.addColorStop(0.0, 'rgb(240, 240, 240)');
      bGrad.addColorStop(1.0, 'rgb(110, 110, 110)');
      bumpCtx.fillStyle = bGrad;
      bumpCtx.beginPath();
      bumpCtx.arc(p.x, p.y, tm.r, 0, Math.PI * 2);
      bumpCtx.fill();
    });

    // E. Valles Marineris (4,000 km Mega-Canyon)
    const vmStart = coordToPixel(-95, -7);
    const vmMid1 = coordToPixel(-75, -12);
    const vmMid2 = coordToPixel(-55, -14);
    const vmEnd = coordToPixel(-35, -15);

    // Color chasm
    ctx.strokeStyle = 'rgba(32, 14, 10, 0.95)';
    ctx.lineWidth = 26;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(vmStart.x, vmStart.y);
    ctx.bezierCurveTo(vmMid1.x, vmMid1.y, vmMid2.x, vmMid2.y, vmEnd.x, vmEnd.y);
    ctx.stroke();

    // Canyon depth in bump map (deep carved black chasm)
    bumpCtx.strokeStyle = 'rgb(15, 15, 15)';
    bumpCtx.lineWidth = 28;
    bumpCtx.lineCap = 'round';
    bumpCtx.beginPath();
    bumpCtx.moveTo(vmStart.x, vmStart.y);
    bumpCtx.bezierCurveTo(vmMid1.x, vmMid1.y, vmMid2.x, vmMid2.y, vmEnd.x, vmEnd.y);
    bumpCtx.stroke();

    // F. Hellas Planitia (Massive 9 km deep impact basin)
    const hel = coordToPixel(70, -42);
    const helGrad = ctx.createRadialGradient(hel.x, hel.y, 20, hel.x, hel.y, 280);
    helGrad.addColorStop(0.0, 'rgba(215, 145, 95, 0.95)');
    helGrad.addColorStop(0.6, 'rgba(180, 105, 65, 0.6)');
    helGrad.addColorStop(1.0, 'rgba(130, 50, 25, 0.0)');
    ctx.fillStyle = helGrad;
    ctx.beginPath();
    ctx.arc(hel.x, hel.y, 280, 0, Math.PI * 2);
    ctx.fill();

    const helBump = bumpCtx.createRadialGradient(hel.x, hel.y, 20, hel.x, hel.y, 280);
    helBump.addColorStop(0.0, 'rgb(20, 20, 20)'); // -9 km floor
    helBump.addColorStop(0.8, 'rgb(60, 60, 60)');
    helBump.addColorStop(0.95, 'rgb(210, 210, 210)'); // Raised mountain rim
    helBump.addColorStop(1.0, 'rgb(130, 130, 130)');
    bumpCtx.fillStyle = helBump;
    bumpCtx.beginPath();
    bumpCtx.arc(hel.x, hel.y, 280, 0, Math.PI * 2);
    bumpCtx.fill();

    // G. 250+ Procedural Impact Craters across the Southern Highlands
    const pseudoRandom = (seed: number) => {
      const x = Math.sin(seed++) * 10000;
      return x - Math.floor(x);
    };

    let seed = 42;
    for (let i = 0; i < 280; i++) {
      const cLon = pseudoRandom(seed++) * 360 - 180;
      // Clustered heavily in southern highlands (-10° to -75°)
      const cLat = pseudoRandom(seed++) * -65 - 10;
      const cRadius = 6 + pseudoRandom(seed++) * 22;

      const pt = coordToPixel(cLon, cLat);

      // Visual crater rim
      ctx.strokeStyle = 'rgba(210, 135, 95, 0.7)';
      ctx.lineWidth = Math.max(1.5, cRadius * 0.18);
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, cRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Shadowed interior
      ctx.fillStyle = 'rgba(38, 18, 12, 0.45)';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, cRadius * 0.75, 0, Math.PI * 2);
      ctx.fill();

      // Relief bump (high rim + low interior)
      bumpCtx.strokeStyle = 'rgb(220, 220, 220)';
      bumpCtx.lineWidth = Math.max(2, cRadius * 0.2);
      bumpCtx.beginPath();
      bumpCtx.arc(pt.x, pt.y, cRadius, 0, Math.PI * 2);
      bumpCtx.stroke();

      bumpCtx.fillStyle = 'rgb(40, 40, 40)';
      bumpCtx.beginPath();
      bumpCtx.arc(pt.x, pt.y, cRadius * 0.7, 0, Math.PI * 2);
      bumpCtx.fill();
    }

    const colorTexture = new THREE.CanvasTexture(colorCanvas);
    colorTexture.wrapS = THREE.RepeatWrapping;
    colorTexture.wrapT = THREE.ClampToEdgeWrapping;

    const bumpTexture = new THREE.CanvasTexture(bumpCanvas);
    bumpTexture.wrapS = THREE.RepeatWrapping;
    bumpTexture.wrapT = THREE.ClampToEdgeWrapping;

    return { color: colorTexture, bump: bumpTexture };
  }, []);

  // -------------------------------------------------------------------------
  // 2. Initialize Three.js Scene, Camera, High-Daylight Lighting & Starfield
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!mountRef.current) return;

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05070B);
    sceneRef.current = scene;

    // 2. Perspective Camera with Wide Dynamic Frustum
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 120000);
    cameraRef.current = camera;

    // 3. WebGL Renderer with High-Precision ACES Filmic Tone Mapping
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    rendererRef.current = renderer;
    mountRef.current.appendChild(renderer.domElement);

    // -----------------------------------------------------------------------
    // NO-NIGHTTIME LIGHTING SYSTEM:
    // Bright, crisp, crystal-clear 100% daytime illumination across the entire planet.
    // -----------------------------------------------------------------------
    // High-intensity ambient light prevents any dark shadows
    const ambientLight = new THREE.AmbientLight(0xFFFFFF, 1.15);
    scene.add(ambientLight);

    // Camera Key Light: Follows the viewer so whatever surface you look at is always fully sunlit
    const cameraKeyLight = new THREE.DirectionalLight(0xFFF7EB, 1.6);
    cameraKeyLight.position.set(0, 0, 10);
    camera.add(cameraKeyLight);
    scene.add(camera);

    // Secondary opposing soft sun ensures crisp limb depth without dark shadows
    const secondarySun = new THREE.DirectionalLight(0xFFE4D0, 0.9);
    secondarySun.position.set(-5000, 4000, -5000).normalize();
    scene.add(secondarySun);

    // Tertiary fill light for bottom pole illumination
    const bottomFillLight = new THREE.DirectionalLight(0xFFDCC8, 0.6);
    bottomFillLight.position.set(0, -6000, 0);
    scene.add(bottomFillLight);

    // 4. Starfield Deep Space Sphere (35,000 km shell)
    const starsCount = 4000;
    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starsCount * 3);
    const starColors = new Float32Array(starsCount * 3);

    for (let i = 0; i < starsCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 40000 + Math.random() * 8000;

      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.cos(phi);
      starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

      const colorVariance = Math.random();
      if (colorVariance > 0.8) {
        starColors[i * 3] = 0.85; starColors[i * 3 + 1] = 0.92; starColors[i * 3 + 2] = 1.0;
      } else if (colorVariance > 0.5) {
        starColors[i * 3] = 1.0; starColors[i * 3 + 1] = 0.88; starColors[i * 3 + 2] = 0.78;
      } else {
        starColors[i * 3] = 0.95; starColors[i * 3 + 1] = 0.95; starColors[i * 3 + 2] = 0.98;
      }
    }
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

    const starMaterial = new THREE.PointsMaterial({
      size: 45,
      vertexColors: true,
      transparent: true,
      opacity: 0.9
    });
    const starField = new THREE.Points(starGeometry, starMaterial);
    scene.add(starField);

    // -----------------------------------------------------------------------
    // GLOBE GROUP: Spherical Mars Planet with 3D Topographic Relief
    // -----------------------------------------------------------------------
    const globeGroup = new THREE.Group();
    globeGroup.rotation.z = THREE.MathUtils.degToRad(25.19); // Mars 25.19° obliquity
    scene.add(globeGroup);
    globeGroupRef.current = globeGroup;

    // Detailed 128x64 Sphere with MOLA Bump Mapping
    const globeGeometry = new THREE.SphereGeometry(MARS_RADIUS_KM, 128, 64);
    const globeMaterial = new THREE.MeshStandardMaterial({
      map: marsTextures.color || undefined,
      bumpMap: marsTextures.bump || undefined,
      bumpScale: 38.0, // High-contrast physical 3D mountain and crater relief
      roughness: 0.82,
      metalness: 0.04
    });

    const globeMesh = new THREE.Mesh(globeGeometry, globeMaterial);
    globeGroup.add(globeMesh);
    globeMeshRef.current = globeMesh;

    // Atmospheric Limb Shell (Soft peach Martian glow around daylight silhouette)
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
          float fresnel = clamp(1.0 - dot(vNormal, viewDir), 0.0, 1.0);
          float intensity = pow(fresnel, 2.2) * 1.2;
          vec3 atmosphereColor = vec3(0.94, 0.58, 0.36);
          gl_FragColor = vec4(atmosphereColor, intensity * 0.7);
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false
    });
    const atmosMesh = new THREE.Mesh(atmosGeometry, atmosMaterial);
    globeGroup.add(atmosMesh);
    atmosphereMeshRef.current = atmosMesh;

    // Landmark Beacons Group on Globe
    const landmarksGroup = new THREE.Group();
    globeGroup.add(landmarksGroup);
    landmarksGroupRef.current = landmarksGroup;

    // Populate Major Geological Landmarks
    PLANETARY_LANDMARKS.forEach((lm) => {
      const pos = lonLatToCartesian(lm.lon, lm.lat, MARS_RADIUS_KM + 6);
      const isEva = lm.type === 'eva';
      const marker = createGlobeLandmarkMarker(isEva ? 0xEF4444 : 0x38BDF8, isEva ? 16 : 9, isEva);
      marker.position.copy(pos);
      marker.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pos.clone().normalize());
      landmarksGroup.add(marker);
    });

    // -----------------------------------------------------------------------
    // SURFACE GROUP: Dedicated High-Resolution 3D Jezero CTX DTM Terrain Model
    // -----------------------------------------------------------------------
    const surfaceGroup = new THREE.Group();
    surfaceGroup.visible = false; // Toggled when in surface mode
    scene.add(surfaceGroup);
    surfaceGroupRef.current = surfaceGroup;

    const surfaceMarkersGroup = new THREE.Group();
    surfaceGroup.add(surfaceMarkersGroup);
    surfaceMarkersGroupRef.current = surfaceMarkersGroup;

    // Mouse Interaction Handlers
    const dom = renderer.domElement;

    const onMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      dragButtonRef.current = e.button;
      prevMouseRef.current = { x: e.clientX, y: e.clientY };
      lastInteractionTimeRef.current = Date.now();
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      lastInteractionTimeRef.current = Date.now();

      const dx = e.clientX - prevMouseRef.current.x;
      const dy = e.clientY - prevMouseRef.current.y;

      if (viewLevel === 'globe') {
        // Left drag: Rotate globe around azimuth and polar angle
        if (dragButtonRef.current === 0) {
          const rotSpeed = 0.0055;
          sphericalRef.current.theta -= dx * rotSpeed;
          sphericalRef.current.phi = THREE.MathUtils.clamp(
            sphericalRef.current.phi - dy * rotSpeed,
            0.05,
            Math.PI - 0.05
          );
          velocityRef.current = { dTheta: -dx * rotSpeed * 0.4, dPhi: -dy * rotSpeed * 0.4 };
        } else if (dragButtonRef.current === 2) {
          // Right drag: Pan lookAt target
          const panSpeed = (sphericalRef.current.radius / 1500);
          const right = new THREE.Vector3().crossVectors(camera.up, camera.getWorldDirection(new THREE.Vector3())).normalize();
          const up = camera.up.clone().normalize();
          lookAtTargetRef.current.addScaledVector(right, dx * panSpeed);
          lookAtTargetRef.current.addScaledVector(up, dy * panSpeed);
        }
      } else {
        // Surface 3D Terrain Camera Interaction
        if (surfaceCameraMode === 'orbit') {
          if (dragButtonRef.current === 0) {
            surfaceSphericalRef.current.theta -= dx * 0.006;
            surfaceSphericalRef.current.phi = THREE.MathUtils.clamp(
              surfaceSphericalRef.current.phi - dy * 0.006,
              0.1,
              Math.PI / 2.05
            );
          } else if (dragButtonRef.current === 2) {
            const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
            const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
            surfaceLookAtRef.current.addScaledVector(right, -dx * 0.25);
            surfaceLookAtRef.current.addScaledVector(up, dy * 0.25);
          }
        }
      }

      prevMouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isDraggingRef.current = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      lastInteractionTimeRef.current = Date.now();

      if (viewLevel === 'globe') {
        const zoomFactor = 1.0 + Math.sign(e.deltaY) * 0.09;
        const newRadius = THREE.MathUtils.clamp(
          sphericalRef.current.radius * zoomFactor,
          3480,
          25000
        );

        // Auto-switch to surface mode if zoomed close to Jezero Crater
        if (newRadius <= 3520) {
          switchToSurfaceView();
          return;
        }

        sphericalRef.current.radius = newRadius;
      } else {
        // Surface zoom
        surfaceSphericalRef.current.radius = THREE.MathUtils.clamp(
          surfaceSphericalRef.current.radius + e.deltaY * 0.35,
          30,
          800
        );
      }
    };

    const onDoubleClick = (e: MouseEvent) => {
      if (viewLevel !== 'globe') return;

      const rect = dom.getBoundingClientRect();
      const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), camera);

      if (globeMeshRef.current) {
        const intersects = raycaster.intersectObject(globeMeshRef.current);
        if (intersects.length > 0) {
          const pt = intersects[0].point;
          const untilted = pt.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), -THREE.MathUtils.degToRad(25.19));
          const { lon, lat } = cartesianToLonLat(untilted);

          // If clicked near Jezero Crater, fly directly into surface terrain view
          const dLon = Math.abs(lon - JEZERO_LON);
          const dLat = Math.abs(lat - JEZERO_LAT);
          if (dLon < 8 && dLat < 8) {
            handleFlyToJezero();
          } else {
            flyToPlanetaryCoordinate(lon, lat, Math.max(3800, sphericalRef.current.radius * 0.5));
          }
        }
      }
    };

    dom.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    dom.addEventListener('wheel', onWheel, { passive: false });
    dom.addEventListener('dblclick', onDoubleClick);
    dom.addEventListener('contextmenu', (e) => e.preventDefault());

    // -----------------------------------------------------------------------
    // Animation Loop
    // -----------------------------------------------------------------------
    let reqId: number;

    const animate = () => {
      reqId = requestAnimationFrame(animate);

      if (viewLevel === 'globe') {
        // Active Globe Mode
        const flight = flightAnimRef.current;
        if (flight.active) {
          flight.progress += 1 / flight.durationFrames;
          const t = THREE.MathUtils.clamp(flight.progress, 0, 1);
          const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

          sphericalRef.current.theta = THREE.MathUtils.lerp(flight.startTheta, flight.targetTheta, ease);
          sphericalRef.current.phi = THREE.MathUtils.lerp(flight.startPhi, flight.targetPhi, ease);
          sphericalRef.current.radius = THREE.MathUtils.lerp(flight.startRadius, flight.targetRadius, ease);
          lookAtTargetRef.current.lerpVectors(flight.startLookAt, flight.targetLookAt, ease);

          if (flight.progress >= 1.0) {
            flight.active = false;
            if (flight.onComplete) flight.onComplete();
          }
        } else {
          // Inertia damping
          if (!isDraggingRef.current) {
            sphericalRef.current.theta += velocityRef.current.dTheta;
            sphericalRef.current.phi = THREE.MathUtils.clamp(
              sphericalRef.current.phi + velocityRef.current.dPhi,
              0.04,
              Math.PI - 0.04
            );
            velocityRef.current.dTheta *= 0.92;
            velocityRef.current.dPhi *= 0.92;

            // Idle rotation (only when far out in orbit after 3 seconds of inactivity)
            if (Date.now() - lastInteractionTimeRef.current > 3000 && sphericalRef.current.radius > 7500) {
              sphericalRef.current.theta += 0.00035;
            }
          }
        }

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

        // Update live telemetry
        const subCoords = cartesianToLonLat(camera.position);
        setTelemetry({
          subLon: parseFloat(subCoords.lon.toFixed(1)),
          subLat: parseFloat(subCoords.lat.toFixed(1)),
          altitudeKm: Math.round(radius - MARS_RADIUS_KM),
          cameraFov: camera.fov
        });
      } else {
        // Active High-Resolution Surface 3D Mode
        if (surfaceCameraMode === 'orbit') {
          const { theta, phi, radius } = surfaceSphericalRef.current;
          const x = radius * Math.sin(phi) * Math.sin(theta);
          const y = radius * Math.cos(phi);
          const z = radius * Math.sin(phi) * Math.cos(theta);

          camera.position.set(
            surfaceLookAtRef.current.x + x,
            surfaceLookAtRef.current.y + y,
            surfaceLookAtRef.current.z + z
          );
          camera.lookAt(surfaceLookAtRef.current);
        } else if (surfaceCameraMode === 'drone' && routePlan && routePlan.coords_lonlat.length > 2) {
          // Drone flyover animation along route
          if (isPlayingFlyover) {
            droneAnimProgressRef.current = (droneAnimProgressRef.current + 0.001) % 1.0;
          }
          const pts = routePlan.coords_lonlat;
          const idx = Math.floor(droneAnimProgressRef.current * (pts.length - 1));
          const pt = pts[idx];
          const nextPt = pts[Math.min(idx + 1, pts.length - 1)];

          if (meshData) {
            const p1 = lonLatToTerrainWorld(pt[0], pt[1], meshData, vertExaggeration);
            const p2 = lonLatToTerrainWorld(nextPt[0], nextPt[1], meshData, vertExaggeration);
            camera.position.set(p1.x, p1.y + 24, p1.z + 28);
            camera.lookAt(p2.x, p2.y + 6, p2.z);
          }
        }
      }

      renderer.render(scene, camera);
    };

    animate();

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
  }, [marsTextures, viewLevel, surfaceCameraMode, isPlayingFlyover, vertExaggeration, meshData, routePlan]);

  // -------------------------------------------------------------------------
  // 3. Build Detailed High-Resolution Jezero CTX 3D Terrain Mesh
  // -------------------------------------------------------------------------
  useEffect(() => {
    const surfaceGroup = surfaceGroupRef.current;
    if (!surfaceGroup || !meshData) return;

    if (surfaceTerrainMeshRef.current) {
      surfaceGroup.remove(surfaceTerrainMeshRef.current);
      surfaceTerrainMeshRef.current.geometry.dispose();
      surfaceTerrainMeshRef.current = null;
    }

    const { grid_width, grid_height, elevations, min_elev_m, max_elev_m } = meshData;
    const worldW = 320;
    const worldH = 300;

    const geometry = new THREE.PlaneGeometry(worldW, worldH, grid_width - 1, grid_height - 1);
    geometry.rotateX(-Math.PI / 2);

    const pos = geometry.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const elevRange = Math.max(max_elev_m - min_elev_m, 1.0);

    for (let i = 0; i < pos.count; i++) {
      const e = elevations[i] !== undefined ? elevations[i] : min_elev_m;
      const norm = (e - min_elev_m) / elevRange; // 0.0 to 1.0

      // Metric elevation displacement with vertical exaggeration
      const yRelief = norm * 55 * vertExaggeration;
      pos.setY(i, yRelief);

      // Jezero Mineralogical Hypsometric Shader:
      // Low floor (-2700m to -2500m): dark olivine basalt (0.48, 0.22, 0.14)
      // Delta fan (-2500m to -2250m): oxidized phyllosilicate smectite clay (0.76, 0.44, 0.24)
      // Carbonate margin (-2250m to -1800m): high-albedo buff sediment (0.84, 0.58, 0.38)
      // Crater rim scarps (-1800m to -1500m): pale silicate bedrock (0.92, 0.70, 0.48)
      let r = 0.48 + norm * 0.44;
      let g = 0.22 + norm * 0.48;
      let b = 0.14 + norm * 0.34;

      // Optional elevation contour lines every 50m
      if (showContourLines) {
        const contourBand = Math.sin(norm * 40 * Math.PI);
        if (contourBand > 0.88) {
          r *= 1.25;
          g *= 1.25;
          b *= 1.25;
        }
      }

      colors[i * 3] = Math.min(1.0, r);
      colors[i * 3 + 1] = Math.min(1.0, g);
      colors[i * 3 + 2] = Math.min(1.0, b);
    }

    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.82,
      metalness: 0.08,
      flatShading: false
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    surfaceGroup.add(mesh);
    surfaceTerrainMeshRef.current = mesh;

    // Draw Route Ribbon & Surface Markers
    updateSurfaceDrapedEntities();
  }, [meshData, vertExaggeration, showContourLines]);

  // Update Surface Route Ribbon & Pins
  const updateSurfaceDrapedEntities = useCallback(() => {
    const surfaceMarkers = surfaceMarkersGroupRef.current;
    const surfaceGroup = surfaceGroupRef.current;
    if (!surfaceMarkers || !surfaceGroup || !meshData) return;

    surfaceMarkers.clear();

    if (surfaceRouteLineRef.current) {
      surfaceGroup.remove(surfaceRouteLineRef.current);
      surfaceRouteLineRef.current.geometry.dispose();
      surfaceRouteLineRef.current = null;
    }

    // 1. Draped Route Ribbon
    if (routePlan && routePlan.coords_lonlat.length > 1) {
      const linePts: THREE.Vector3[] = [];
      routePlan.coords_lonlat.forEach(([lon, lat]) => {
        const p = lonLatToTerrainWorld(lon, lat, meshData, vertExaggeration);
        linePts.push(new THREE.Vector3(p.x, p.y + 1.2, p.z));
      });

      const lineGeom = new THREE.BufferGeometry().setFromPoints(linePts);
      const lineMat = new THREE.LineBasicMaterial({
        color: routePlan.mode === 'safe' ? 0x38BDF8 : 0xF97316,
        linewidth: 4
      });
      const line = new THREE.Line(lineGeom, lineMat);
      surfaceGroup.add(line);
      surfaceRouteLineRef.current = line;
    }

    // 2. Start Base Pin (Green)
    const startP = lonLatToTerrainWorld(startCoords[0], startCoords[1], meshData, vertExaggeration);
    const startPin = createTerrainPinMesh(0x22C55E, 2.5);
    startPin.position.set(startP.x, startP.y, startP.z);
    surfaceMarkers.add(startPin);

    // 3. Goal Target Pin (Red)
    const targetP = lonLatToTerrainWorld(targetCoords[0], targetCoords[1], meshData, vertExaggeration);
    const targetPin = createTerrainPinMesh(0xEF4444, 3.2);
    targetPin.position.set(targetP.x, targetP.y, targetP.z);
    surfaceMarkers.add(targetPin);

    // 4. Science POIs (Diamonds)
    scienceTargets.forEach((t) => {
      const p = lonLatToTerrainWorld(t.lon, t.lat, meshData, vertExaggeration);
      const isSel = t.target_id === selectedTargetId;
      const diamond = createTerrainDiamondMesh(isSel ? 0xC084FC : 0x818CF8, isSel ? 3.2 : 2.0);
      diamond.position.set(p.x, p.y + 3.0, p.z);
      surfaceMarkers.add(diamond);
    });
  }, [meshData, routePlan, startCoords, targetCoords, scienceTargets, selectedTargetId, vertExaggeration]);

  useEffect(() => {
    updateSurfaceDrapedEntities();
  }, [updateSurfaceDrapedEntities]);

  // -------------------------------------------------------------------------
  // 4. View Mode Transition Handlers
  // -------------------------------------------------------------------------
  const switchToSurfaceView = () => {
    if (globeGroupRef.current) globeGroupRef.current.visible = false;
    if (surfaceGroupRef.current) surfaceGroupRef.current.visible = true;
    setViewLevel('surface');
    setSurfaceCameraMode('orbit');

    // Position camera over Jezero delta in surface coordinates
    if (cameraRef.current) {
      cameraRef.current.position.set(0, 160, 240);
      cameraRef.current.lookAt(0, 0, 0);
    }
  };

  const switchToGlobeView = () => {
    if (surfaceGroupRef.current) surfaceGroupRef.current.visible = false;
    if (globeGroupRef.current) globeGroupRef.current.visible = true;
    setViewLevel('globe');
  };

  // Fly to Jezero Crater from Space
  const handleFlyToJezero = () => {
    switchToGlobeView();
    flyToPlanetaryCoordinate(JEZERO_LON, JEZERO_LAT, 3550, () => {
      // Smoothly cross over to high-resolution surface terrain model on arrival
      switchToSurfaceView();
    });
  };

  const flyToPlanetaryCoordinate = (
    lon: number,
    lat: number,
    targetRadius: number = 3800,
    onComplete?: () => void
  ) => {
    let phi = (90 - lat) * (Math.PI / 180);
    let theta = (lon + 180) * (Math.PI / 180) - Math.PI / 2;

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
      durationFrames: 65,
      onComplete
    };
    lastInteractionTimeRef.current = Date.now();
  };

  const handleResetToOuterSpace = () => {
    switchToGlobeView();
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
      durationFrames: 50
    };
  };

  return (
    <div className="relative w-full h-full select-none overflow-hidden bg-mars-dark">
      {/* Three.js Canvas Container */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top Header: Seamless Mode Switcher (Globe vs Surface Terrain) */}
      <div className="absolute top-4 left-4 z-20 flex flex-col gap-2.5">
        <div className="bg-mars-panel/90 backdrop-blur border border-mars-border p-2 rounded-xl flex items-center gap-3 shadow-2xl text-xs">
          {/* Primary View Switcher */}
          <div className="flex items-center bg-mars-dark/80 border border-mars-border p-0.5 rounded-lg text-xs font-medium">
            <button
              onClick={switchToGlobeView}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition ${
                viewLevel === 'globe'
                  ? 'bg-mars-accent text-black font-bold shadow'
                  : 'text-mars-subtle hover:text-white'
              }`}
            >
              <Globe2 className="w-3.5 h-3.5" />
              3D Mars Globe
            </button>
            <button
              onClick={switchToSurfaceView}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition ${
                viewLevel === 'surface'
                  ? 'bg-mars-accent text-black font-bold shadow'
                  : 'text-mars-subtle hover:text-white'
              }`}
            >
              <Mountain className="w-3.5 h-3.5" />
              Jezero 3D Terrain
            </button>
          </div>

          {/* Quick Action: Fly to Jezero */}
          {viewLevel === 'globe' ? (
            <button
              onClick={handleFlyToJezero}
              className="px-2.5 py-1.5 bg-mars-red hover:bg-mars-red/90 text-white rounded-lg font-semibold transition flex items-center gap-1.5 shadow"
              title="Automated descent flight into Jezero Crater EVA region"
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Descent to Jezero</span>
            </button>
          ) : (
            <button
              onClick={handleResetToOuterSpace}
              className="px-2.5 py-1.5 bg-mars-dark hover:bg-mars-border text-mars-subtle hover:text-white rounded-lg font-medium border border-mars-border transition flex items-center gap-1.5"
              title="Return to Global Orbital View"
            >
              <Globe2 className="w-3.5 h-3.5 text-mars-accent" />
              <span>Orbit View</span>
            </button>
          )}

          <button
            onClick={viewLevel === 'globe' ? handleResetToOuterSpace : () => {
              surfaceSphericalRef.current = { theta: Math.PI / 4, phi: Math.PI / 3.2, radius: 360 };
              surfaceLookAtRef.current.set(0, 0, 0);
              setSurfaceCameraMode('orbit');
            }}
            className="p-1.5 rounded-lg border border-mars-border hover:bg-mars-border text-mars-subtle hover:text-white transition"
            title="Reset Camera Orientation"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Secondary Sub-Controls depending on Active Mode */}
        {viewLevel === 'surface' ? (
          <div className="bg-mars-panel/90 backdrop-blur border border-mars-border p-1.5 rounded-lg flex items-center gap-2 w-fit text-xs">
            <span className="text-mars-subtle text-[11px] font-mono px-1">CAM:</span>
            <button
              onClick={() => { setSurfaceCameraMode('orbit'); setIsPlayingFlyover(false); }}
              className={`px-2.5 py-1 rounded text-xs transition ${
                surfaceCameraMode === 'orbit'
                  ? 'bg-mars-accent text-black font-semibold'
                  : 'text-mars-subtle hover:text-white'
              }`}
            >
              Orbit Inspection
            </button>

            <button
              onClick={() => { setSurfaceCameraMode('drone'); setIsPlayingFlyover(true); }}
              className={`px-2.5 py-1 rounded text-xs transition flex items-center gap-1 ${
                surfaceCameraMode === 'drone'
                  ? 'bg-mars-accent text-black font-semibold'
                  : 'text-mars-subtle hover:text-white'
              }`}
            >
              <Video className="w-3 h-3" />
              Drone Flyover
            </button>

            {surfaceCameraMode === 'drone' && (
              <button
                onClick={() => setIsPlayingFlyover(!isPlayingFlyover)}
                className="p-1 rounded bg-mars-dark hover:bg-mars-border text-white"
              >
                {isPlayingFlyover ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </button>
            )}

            <button
              onClick={() => setShowContourLines(!showContourLines)}
              className={`px-2 py-1 rounded text-[11px] border transition ${
                showContourLines
                  ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10'
                  : 'border-mars-border text-mars-subtle'
              }`}
              title="Toggle 50m Elevation Contour Lines"
            >
              Contours
            </button>
          </div>
        ) : (
          <div className="bg-mars-panel/90 backdrop-blur border border-mars-border p-1.5 rounded-lg flex items-center gap-2 w-fit text-xs">
            <span className="text-mars-subtle text-[11px] font-mono px-1">FLY TO:</span>
            {PLANETARY_LANDMARKS.slice(0, 4).map((lm) => (
              <button
                key={lm.name}
                onClick={() => {
                  if (lm.type === 'eva') {
                    handleFlyToJezero();
                  } else {
                    flyToPlanetaryCoordinate(lm.lon, lm.lat, lm.alt);
                  }
                }}
                className="px-2 py-0.5 rounded text-[11px] bg-mars-dark/60 border border-mars-border text-mars-subtle hover:text-white hover:border-mars-accent transition"
              >
                {lm.name.split(' ')[0]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Top-Right: 3D Topographic Relief Exaggeration Slider */}
      <div className="absolute top-4 right-4 z-20 bg-mars-panel/90 backdrop-blur border border-mars-border px-3 py-2 rounded-xl flex items-center gap-2.5 shadow-2xl text-xs font-mono">
        <Sliders className="w-3.5 h-3.5 text-mars-subtle" />
        <span className="text-mars-subtle text-[11px]">3D Relief Exag:</span>
        <span className="text-mars-accent font-bold">{vertExaggeration.toFixed(1)}x</span>
        <input
          type="range"
          min="1.0"
          max="4.0"
          step="0.2"
          value={vertExaggeration}
          onChange={(e) => setVertExaggeration(Number(e.target.value))}
          className="w-24 accent-mars-accent cursor-pointer h-1.5 bg-mars-border rounded-lg"
        />
      </div>

      {/* Bottom-Left: Live Orbital / Surface Telemetry */}
      <div className="absolute bottom-4 left-4 z-20 bg-mars-panel/90 backdrop-blur border border-mars-border px-3 py-1.5 rounded-lg text-[11px] font-mono text-mars-subtle shadow-md flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Sun className="w-3.5 h-3.5 text-amber-400 animate-spin-slow" />
          <span className="text-white font-semibold">100% DAYLIGHT SUN</span>
        </div>
        <span>|</span>
        {viewLevel === 'globe' ? (
          <>
            <span>SUB-LON: <strong className="text-slate-200">{telemetry.subLon > 0 ? `${telemetry.subLon}°E` : `${Math.abs(telemetry.subLon)}°W`}</strong></span>
            <span>SUB-LAT: <strong className="text-slate-200">{telemetry.subLat > 0 ? `+${telemetry.subLat}°N` : `${telemetry.subLat}°S`}</strong></span>
            <span>ALTITUDE: <strong className="text-mars-accent">{telemetry.altitudeKm.toLocaleString()} km</strong></span>
          </>
        ) : (
          <>
            <span>SECTOR: <strong className="text-emerald-400">Jezero Western Delta</strong></span>
            <span>ELEVATION: <strong className="text-slate-200">-2,710m to -1,515m</strong></span>
            <span>DTM POSTING: <strong className="text-mars-accent">20m CTX (2.41M pts)</strong></span>
          </>
        )}
      </div>

      {/* Bottom-Right: Interaction Guide */}
      <div className="absolute bottom-4 right-4 z-20 bg-mars-panel/90 backdrop-blur border border-mars-border px-3 py-1.5 rounded-lg text-[11px] font-mono text-mars-subtle shadow-md flex items-center gap-2">
        <span>{viewLevel === 'globe' ? 'IAU 2000 Mars Mean Sphere (R=3396.19 km)' : 'USGS SIM 3464 Geologic Model'}</span>
        <span className="text-slate-500">•</span>
        <span className="text-slate-400">Left-Drag: 360° Rotate | Scroll: Zoom | Right-Drag: Pan</span>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Helper: Map Lon/Lat to Flat 3D Surface Mesh World Coordinates
// ---------------------------------------------------------------------------
function lonLatToTerrainWorld(lon: number, lat: number, mesh: TerrainMesh3DResponse, vertExag: number) {
  const [minLon, minLat, maxLon, maxLat] = mesh.bounds_lonlat;
  const worldW = 320;
  const worldH = 300;

  const u = (lon - minLon) / (maxLon - minLon);
  const v = (lat - minLat) / (maxLat - minLat);

  const x = (u - 0.5) * worldW;
  const z = (0.5 - v) * worldH;

  const gx = Math.min(mesh.grid_width - 1, Math.max(0, Math.floor(u * mesh.grid_width)));
  const gy = Math.min(mesh.grid_height - 1, Math.max(0, Math.floor((1.0 - v) * mesh.grid_height)));
  const idx = gy * mesh.grid_width + gx;
  const elev = mesh.elevations[idx] || mesh.min_elev_m;

  const elevNorm = (elev - mesh.min_elev_m) / Math.max(mesh.max_elev_m - mesh.min_elev_m, 1.0);
  const y = elevNorm * 55 * vertExag;

  return { x, y, z };
}

// ---------------------------------------------------------------------------
// 3D Visual Mesh Generators
// ---------------------------------------------------------------------------
function createGlobeLandmarkMarker(colorHex: number, radiusKm: number, isPulsing: boolean) {
  const group = new THREE.Group();

  // Vertical light pillar
  const pillarGeom = new THREE.CylinderGeometry(radiusKm * 0.15, radiusKm * 0.4, radiusKm * 3.5, 12);
  pillarGeom.translate(0, radiusKm * 1.75, 0);
  const pillarMat = new THREE.MeshBasicMaterial({
    color: colorHex,
    transparent: true,
    opacity: 0.85
  });
  const pillar = new THREE.Mesh(pillarGeom, pillarMat);
  group.add(pillar);

  // Floating summit beacon
  const summitGeom = new THREE.SphereGeometry(radiusKm * 0.8, 16, 16);
  const summitMat = new THREE.MeshBasicMaterial({ color: colorHex });
  const summit = new THREE.Mesh(summitGeom, summitMat);
  summit.position.y = radiusKm * 3.6;
  group.add(summit);

  // Outer orbital ring
  const ringGeom = new THREE.RingGeometry(radiusKm * 1.2, radiusKm * 1.5, 24);
  ringGeom.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: colorHex,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.7
  });
  const ring = new THREE.Mesh(ringGeom, ringMat);
  ring.position.y = 1.0;
  group.add(ring);

  return group;
}

function createTerrainPinMesh(colorHex: number, radius: number) {
  const group = new THREE.Group();
  const sphereGeom = new THREE.SphereGeometry(radius, 16, 16);
  const mat = new THREE.MeshStandardMaterial({
    color: colorHex,
    emissive: colorHex,
    emissiveIntensity: 0.4
  });
  const sphere = new THREE.Mesh(sphereGeom, mat);
  sphere.position.y = radius * 2.8;
  group.add(sphere);

  const stickGeom = new THREE.CylinderGeometry(0.35, 0.35, radius * 2.8);
  const stickMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
  const stick = new THREE.Mesh(stickGeom, stickMat);
  stick.position.y = radius * 1.4;
  group.add(stick);

  return group;
}

function createTerrainDiamondMesh(colorHex: number, size: number) {
  const geom = new THREE.OctahedronGeometry(size);
  const mat = new THREE.MeshStandardMaterial({
    color: colorHex,
    emissive: colorHex,
    emissiveIntensity: 0.5,
    roughness: 0.25
  });
  return new THREE.Mesh(geom, mat);
}

export default MarsGlobeViewer;
