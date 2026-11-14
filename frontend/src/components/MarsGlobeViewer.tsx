import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
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
  Video,
  Maximize2,
  Sun,
  Layers,
  ChevronRight
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

// Mars Planetary Dimensions (Normalized scale: Radius = 10 units = 3,396.19 km)
const MARS_RADIUS = 10.0;
const MARS_OBLIQUITY_DEG = 25.19; // Mars axial tilt

// Real-world coordinates of Jezero Crater EVA site
const JEZERO_LON = 77.45;
const JEZERO_LAT = 18.44;

// Major Martian Landmarks with Documented Planetary Coordinates
const PLANETARY_LANDMARKS = [
  { name: 'Jezero Crater (EVA Site)', lon: 77.45, lat: 18.44, type: 'eva', desc: 'Perseverance landing site & paleolake delta' },
  { name: 'Olympus Mons', lon: -133.8, lat: 18.65, type: 'volcano', desc: 'Solar System tallest volcano (21.9 km height)' },
  { name: 'Valles Marineris', lon: -65.0, lat: -13.9, type: 'canyon', desc: 'Grand canyon system (4,000 km length, 7 km depth)' },
  { name: 'Gale Crater (Curiosity)', lon: 137.4, lat: -5.4, type: 'crater', desc: 'Mount Sharp sedimentary strata' },
  { name: 'Hellas Planitia', lon: 70.0, lat: -42.4, type: 'basin', desc: 'Giant 2,300 km impact basin (9 km depth)' },
  { name: 'North Polar Cap (Planum Boreum)', lon: 0.0, lat: 85.0, type: 'polar', desc: 'Water-ice & seasonal CO2 ice cap' },
  { name: 'South Polar Cap (Planum Australe)', lon: 0.0, lat: -85.0, type: 'polar', desc: 'Permanent CO2 dry ice deposit' }
];

/**
 * Coordinate Transformation:
 * Converts Martian Longitude (-180° to +180°) and Latitude (-90° to +90°)
 * to 3D Cartesian coordinates matching Three.js equirectangular UV mapping on SphereGeometry.
 */
export function latLonToCartesian(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  return new THREE.Vector3(x, y, z);
}

export function cartesianToLatLon(v: THREE.Vector3): { lat: number; lon: number } {
  const norm = v.clone().normalize();
  const lat = 90 - Math.acos(Math.max(-1, Math.min(1, norm.y))) * (180 / Math.PI);
  let lon = Math.atan2(norm.z, -norm.x) * (180 / Math.PI) - 180;
  while (lon < -180) lon += 360;
  while (lon > 180) lon -= 360;
  return { lat, lon };
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

  // View Level: 'globe' (Planetary 3D Sphere) vs 'surface' (High-Resolution Jezero 3D DEM Terrain)
  const [viewLevel, setViewLevel] = useState<'globe' | 'surface'>('globe');

  // Surface Camera Mode
  const [surfaceCameraMode, setSurfaceCameraMode] = useState<'orbit' | 'drone'>('orbit');
  const [vertExaggeration, setVertExaggeration] = useState<number>(2.0);
  const [isPlayingFlyover, setIsPlayingFlyover] = useState<boolean>(false);
  const [solarLighting, setSolarLighting] = useState<boolean>(true); // Solar terminator vs daylight
  const [showContourLines, setShowContourLines] = useState<boolean>(true);
  const [showLandmarks, setShowLandmarks] = useState<boolean>(true);

  // Live Telemetry
  const [telemetry, setTelemetry] = useState({
    subLon: 77.5,
    subLat: 18.4,
    altitudeKm: 5800,
    distanceUnits: 26.0
  });

  // Three.js Core References
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  // Scene Hierarchy Groups
  const globeGroupRef = useRef<THREE.Group | null>(null);
  const globeMeshRef = useRef<THREE.Mesh | null>(null);
  const atmosphereMeshRef = useRef<THREE.Mesh | null>(null);
  const globeMarkersGroupRef = useRef<THREE.Group | null>(null);

  const surfaceGroupRef = useRef<THREE.Group | null>(null);
  const surfaceMeshRef = useRef<THREE.Mesh | null>(null);
  const surfaceMarkersGroupRef = useRef<THREE.Group | null>(null);

  // Lighting References
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const cameraFillLightRef = useRef<THREE.DirectionalLight | null>(null);

  // Camera Flight Transition Animation
  const flightAnimRef = useRef<{
    active: boolean;
    startPos: THREE.Vector3;
    targetPos: THREE.Vector3;
    startTarget: THREE.Vector3;
    endTarget: THREE.Vector3;
    progress: number;
    duration: number;
    onComplete?: () => void;
  }>({
    active: false,
    startPos: new THREE.Vector3(),
    targetPos: new THREE.Vector3(),
    startTarget: new THREE.Vector3(),
    endTarget: new THREE.Vector3(),
    progress: 0,
    duration: 60
  });

  const droneProgressRef = useRef<number>(0);

  // -------------------------------------------------------------------------
  // 1. Initialize Three.js Scene, Camera, WebGL Renderer, OrbitControls
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!mountRef.current) return;

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x030508);
    sceneRef.current = scene;

    // 2. Camera: Positioned in space looking at the Mars sphere
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);
    camera.position.set(0, 5, 26);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // 3. WebGL Renderer with High-Precision ACES Filmic Tone Mapping
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    rendererRef.current = renderer;
    mountRef.current.appendChild(renderer.domElement);

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 10.6; // Just above sphere surface (R = 10.0)
    controls.maxDistance = 55.0; // Deep space orbit
    controls.enablePan = true;
    controls.rotateSpeed = 0.8;
    controls.zoomSpeed = 1.2;
    controlsRef.current = controls;

    // 5. Lighting System
    // A. Main Directional Sun Light (Warm solar illumination)
    const sunLight = new THREE.DirectionalLight(0xFFFBF2, 1.8);
    sunLight.position.set(22, 10, 16);
    scene.add(sunLight);
    sunLightRef.current = sunLight;

    // B. Ambient Fill Light (Soft shadow-side visibility)
    const ambientLight = new THREE.AmbientLight(0x443328, 0.45);
    scene.add(ambientLight);
    ambientLightRef.current = ambientLight;

    // C. Camera-Mounted Fill Light (Toggled for full daytime everywhere)
    const cameraFillLight = new THREE.DirectionalLight(0xFFF5E8, 0.0); // Off by default in solar mode
    cameraFillLight.position.set(0, 0, 10);
    camera.add(cameraFillLight);
    scene.add(camera);
    cameraFillLightRef.current = cameraFillLight;

    // 6. Deep Space Starfield Sphere (Radius 800)
    const starsCount = 3000;
    const starGeom = new THREE.BufferGeometry();
    const starPos = new Float32Array(starsCount * 3);
    const starColors = new Float32Array(starsCount * 3);

    for (let i = 0; i < starsCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 700 + Math.random() * 200;

      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = r * Math.cos(phi);
      starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

      const tint = Math.random();
      if (tint > 0.85) {
        starColors[i * 3] = 0.85; starColors[i * 3 + 1] = 0.92; starColors[i * 3 + 2] = 1.0;
      } else if (tint > 0.6) {
        starColors[i * 3] = 1.0; starColors[i * 3 + 1] = 0.88; starColors[i * 3 + 2] = 0.75;
      } else {
        starColors[i * 3] = 0.95; starColors[i * 3 + 1] = 0.95; starColors[i * 3 + 2] = 0.98;
      }
    }
    starGeom.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    starGeom.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
    const starMat = new THREE.PointsMaterial({ size: 1.8, vertexColors: true, transparent: true, opacity: 0.85 });
    const starField = new THREE.Points(starGeom, starMat);
    scene.add(starField);

    // -----------------------------------------------------------------------
    // 7. Complete Spherical 3D Mars Planet
    // -----------------------------------------------------------------------
    const globeGroup = new THREE.Group();
    globeGroup.rotation.z = THREE.MathUtils.degToRad(MARS_OBLIQUITY_DEG); // 25.19° obliquity
    scene.add(globeGroup);
    globeGroupRef.current = globeGroup;

    // Load authentic NASA 2K Equirectangular Mars Texture & Bump Map
    const texLoader = new THREE.TextureLoader();
    const marsColorMap = texLoader.load('/textures/mars_2k.jpg', () => {
      if (rendererRef.current) rendererRef.current.render(scene, camera);
    });
    marsColorMap.colorSpace = THREE.SRGBColorSpace;

    const marsBumpMap = texLoader.load('/textures/mars_2k_bump.jpg', () => {
      if (rendererRef.current) rendererRef.current.render(scene, camera);
    });

    // 128 horizontal x 96 vertical segments for smooth planetary curvature
    const globeGeom = new THREE.SphereGeometry(MARS_RADIUS, 128, 96);
    const globeMat = new THREE.MeshStandardMaterial({
      map: marsColorMap,
      bumpMap: marsBumpMap,
      bumpScale: 0.16, // Visible topographic relief on Olympus Mons, Valles Marineris, craters
      roughness: 0.82,
      metalness: 0.04
    });

    const globeMesh = new THREE.Mesh(globeGeom, globeMat);
    globeGroup.add(globeMesh);
    globeMeshRef.current = globeMesh;

    // Atmospheric Limb Glow Shell (Peach-ochre Martian scattering)
    const atmosGeom = new THREE.SphereGeometry(MARS_RADIUS * 1.015, 64, 64);
    const atmosMat = new THREE.ShaderMaterial({
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
          float intensity = pow(fresnel, 2.4) * 1.3;
          vec3 atmosColor = vec3(0.92, 0.56, 0.35); // Ochre peach atmospheric haze
          gl_FragColor = vec4(atmosColor, intensity * 0.75);
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false
    });
    const atmosMesh = new THREE.Mesh(atmosGeom, atmosMat);
    globeGroup.add(atmosMesh);
    atmosphereMeshRef.current = atmosMesh;

    // Landmark Beacons Group on Globe
    const globeMarkersGroup = new THREE.Group();
    globeGroup.add(globeMarkersGroup);
    globeMarkersGroupRef.current = globeMarkersGroup;

    // Populate Major Geological Landmarks
    PLANETARY_LANDMARKS.forEach((lm) => {
      const pos = latLonToCartesian(lm.lat, lm.lon, MARS_RADIUS + 0.08);
      const isEva = lm.type === 'eva';
      const marker = createGlobeLandmarkPin(isEva ? 0xEF4444 : 0x38BDF8, isEva ? 0.35 : 0.22, isEva);
      marker.position.copy(pos);
      marker.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pos.clone().normalize());
      globeMarkersGroup.add(marker);
    });

    // -----------------------------------------------------------------------
    // 8. Regional High-Resolution 3D Jezero CTX DTM Terrain Group
    // -----------------------------------------------------------------------
    const surfaceGroup = new THREE.Group();
    surfaceGroup.visible = false;
    scene.add(surfaceGroup);
    surfaceGroupRef.current = surfaceGroup;

    const surfaceMarkersGroup = new THREE.Group();
    surfaceGroup.add(surfaceMarkersGroup);
    surfaceMarkersGroupRef.current = surfaceMarkersGroup;

    // Double-Click Raycaster: Focus or descend into region
    const dom = renderer.domElement;
    const onDoubleClick = (e: MouseEvent) => {
      if (viewLevel !== 'globe' || !globeMeshRef.current) return;

      const rect = dom.getBoundingClientRect();
      const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), camera);

      const intersects = raycaster.intersectObject(globeMeshRef.current);
      if (intersects.length > 0) {
        const hitPt = intersects[0].point;
        // Invert axial tilt to get planetary coords
        const untilted = hitPt.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), -THREE.MathUtils.degToRad(MARS_OBLIQUITY_DEG));
        const { lat, lon } = cartesianToLatLon(untilted);

        // If clicked close to Jezero Crater, fly directly into high-res terrain view
        const dLon = Math.abs(lon - JEZERO_LON);
        const dLat = Math.abs(lat - JEZERO_LAT);
        if (dLon < 10 && dLat < 10) {
          handleFlyToJezero();
        } else {
          // Smoothly fly camera to face the clicked location
          flyCameraToPlanetaryTarget(lat, lon, 18.0);
        }
      }
    };
    dom.addEventListener('dblclick', onDoubleClick);

    // -----------------------------------------------------------------------
    // 9. Animation & Render Loop
    // -----------------------------------------------------------------------
    let reqId: number;

    const animate = () => {
      reqId = requestAnimationFrame(animate);

      // Handle Smooth Camera Flight Animations
      const flight = flightAnimRef.current;
      if (flight.active) {
        flight.progress += 1 / flight.duration;
        const t = THREE.MathUtils.clamp(flight.progress, 0, 1);
        const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

        camera.position.lerpVectors(flight.startPos, flight.targetPos, ease);
        controls.target.lerpVectors(flight.startTarget, flight.endTarget, ease);
        controls.update();

        if (flight.progress >= 1.0) {
          flight.active = false;
          if (flight.onComplete) flight.onComplete();
        }
      } else {
        controls.update();
      }

      // Update Live Telemetry
      if (viewLevel === 'globe') {
        const dist = camera.position.length();
        const altKm = Math.round((dist / MARS_RADIUS) * 3396.19 - 3396.19);
        const untilted = camera.position.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), -THREE.MathUtils.degToRad(MARS_OBLIQUITY_DEG));
        const { lat, lon } = cartesianToLatLon(untilted);

        setTelemetry({
          subLon: parseFloat(lon.toFixed(1)),
          subLat: parseFloat(lat.toFixed(1)),
          altitudeKm: Math.max(0, altKm),
          distanceUnits: parseFloat(dist.toFixed(1))
        });
      }

      // Drone Flyover Mode in Surface View
      if (viewLevel === 'surface' && surfaceCameraMode === 'drone' && routePlan && routePlan.coords_lonlat.length > 2 && isPlayingFlyover) {
        droneProgressRef.current = (droneProgressRef.current + 0.001) % 1.0;
        const pts = routePlan.coords_lonlat;
        const idx = Math.floor(droneProgressRef.current * (pts.length - 1));
        const [lon1, lat1] = pts[idx];
        const [lon2, lat2] = pts[Math.min(idx + 1, pts.length - 1)];

        if (meshData) {
          const p1 = lonLatToTerrainWorld(lon1, lat1, meshData, vertExaggeration);
          const p2 = lonLatToTerrainWorld(lon2, lat2, meshData, vertExaggeration);
          camera.position.set(p1.x, p1.y + 12, p1.z + 16);
          controls.target.set(p2.x, p2.y + 4, p2.z);
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
      dom.removeEventListener('dblclick', onDoubleClick);
      window.removeEventListener('resize', handleResize);
      if (mountRef.current && dom) {
        mountRef.current.removeChild(dom);
      }
      controls.dispose();
      renderer.dispose();
    };
  }, []);

  // -------------------------------------------------------------------------
  // 2. Build High-Resolution 3D Jezero CTX DTM Terrain Mesh
  // -------------------------------------------------------------------------
  useEffect(() => {
    const surfaceGroup = surfaceGroupRef.current;
    if (!surfaceGroup || !meshData) return;

    if (surfaceMeshRef.current) {
      surfaceGroup.remove(surfaceMeshRef.current);
      surfaceMeshRef.current.geometry.dispose();
      surfaceMeshRef.current = null;
    }

    const { grid_width, grid_height, elevations, min_elev_m, max_elev_m } = meshData;
    const worldW = 32;
    const worldH = 30;

    const geometry = new THREE.PlaneGeometry(worldW, worldH, grid_width - 1, grid_height - 1);
    geometry.rotateX(-Math.PI / 2);

    const pos = geometry.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const elevRange = Math.max(max_elev_m - min_elev_m, 1.0);

    for (let i = 0; i < pos.count; i++) {
      const e = elevations[i] !== undefined ? elevations[i] : min_elev_m;
      const norm = (e - min_elev_m) / elevRange; // 0.0 to 1.0

      // Metric elevation displacement with vertical relief exaggeration
      const yRelief = norm * 4.5 * vertExaggeration;
      pos.setY(i, yRelief);

      // Jezero Mineralogical Hypsometric Colormap:
      // -2710m to -2500m: Olivine-bearing basaltic crater floor (dark charcoal brown)
      // -2500m to -2250m: Smectite clay delta front (rich oxidized rust)
      // -2250m to -1800m: Carbonate margin & alluvial fans (pale tan sediment)
      // -1800m to -1515m: Jezero crater rim & ejecta scarps (silicate bedrock)
      let r = 0.48 + norm * 0.42;
      let g = 0.22 + norm * 0.45;
      let b = 0.14 + norm * 0.32;

      // 50m Contour Relief Striping
      if (showContourLines) {
        const contour = Math.sin(norm * 45 * Math.PI);
        if (contour > 0.88) {
          r *= 1.25; g *= 1.25; b *= 1.25;
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
      metalness: 0.06,
      flatShading: false
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    surfaceGroup.add(mesh);
    surfaceMeshRef.current = mesh;

    updateSurfaceMarkers();
  }, [meshData, vertExaggeration, showContourLines]);

  // Update Route Line & Pins in Surface View
  const updateSurfaceMarkers = useCallback(() => {
    const surfaceMarkers = surfaceMarkersGroupRef.current;
    const surfaceGroup = surfaceGroupRef.current;
    if (!surfaceMarkers || !surfaceGroup || !meshData) return;

    surfaceMarkers.clear();

    // 1. Draped Route Ribbon
    if (routePlan && routePlan.coords_lonlat.length > 1) {
      const linePts: THREE.Vector3[] = [];
      routePlan.coords_lonlat.forEach(([lon, lat]) => {
        const p = lonLatToTerrainWorld(lon, lat, meshData, vertExaggeration);
        linePts.push(new THREE.Vector3(p.x, p.y + 0.15, p.z));
      });

      const lineGeom = new THREE.BufferGeometry().setFromPoints(linePts);
      const lineMat = new THREE.LineBasicMaterial({
        color: routePlan.mode === 'safe' ? 0x38BDF8 : 0xF97316,
        linewidth: 4
      });
      const line = new THREE.Line(lineGeom, lineMat);
      surfaceMarkers.add(line);
    }

    // 2. Start Base Pin (Green)
    const startP = lonLatToTerrainWorld(startCoords[0], startCoords[1], meshData, vertExaggeration);
    const startPin = createTerrainPinMesh(0x22C55E, 0.35);
    startPin.position.set(startP.x, startP.y, startP.z);
    surfaceMarkers.add(startPin);

    // 3. Goal Target Pin (Red)
    const targetP = lonLatToTerrainWorld(targetCoords[0], targetCoords[1], meshData, vertExaggeration);
    const targetPin = createTerrainPinMesh(0xEF4444, 0.42);
    targetPin.position.set(targetP.x, targetP.y, targetP.z);
    surfaceMarkers.add(targetPin);

    // 4. Science POIs (Diamonds)
    scienceTargets.forEach((t) => {
      const p = lonLatToTerrainWorld(t.lon, t.lat, meshData, vertExaggeration);
      const isSel = t.target_id === selectedTargetId;
      const diamond = createTerrainDiamondMesh(isSel ? 0xC084FC : 0x818CF8, isSel ? 0.45 : 0.28);
      diamond.position.set(p.x, p.y + 0.35, p.z);
      surfaceMarkers.add(diamond);
    });
  }, [meshData, routePlan, startCoords, targetCoords, scienceTargets, selectedTargetId, vertExaggeration]);

  useEffect(() => {
    updateSurfaceMarkers();
  }, [updateSurfaceMarkers]);

  // -------------------------------------------------------------------------
  // 3. Lighting Mode Controller (Solar Shading vs Full Illumination)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!sunLightRef.current || !ambientLightRef.current || !cameraFillLightRef.current) return;

    if (solarLighting) {
      // Authentic Solar Shading: High-contrast terminator, dramatic crater shadows
      sunLightRef.current.intensity = 1.85;
      ambientLightRef.current.intensity = 0.45;
      cameraFillLightRef.current.intensity = 0.0;
    } else {
      // Full Daylight Everywhere: Camera headlight illuminates every angle evenly
      sunLightRef.current.intensity = 1.0;
      ambientLightRef.current.intensity = 0.95;
      cameraFillLightRef.current.intensity = 1.35;
    }
  }, [solarLighting]);

  // -------------------------------------------------------------------------
  // 4. View Mode Transitions
  // -------------------------------------------------------------------------
  const switchToSurfaceView = () => {
    if (globeGroupRef.current) globeGroupRef.current.visible = false;
    if (surfaceGroupRef.current) surfaceGroupRef.current.visible = true;
    setViewLevel('surface');
    setSurfaceCameraMode('orbit');

    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(0, 18, 26);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.minDistance = 3.0;
      controlsRef.current.maxDistance = 60.0;
      controlsRef.current.update();
    }
  };

  const switchToGlobeView = () => {
    if (surfaceGroupRef.current) surfaceGroupRef.current.visible = false;
    if (globeGroupRef.current) globeGroupRef.current.visible = true;
    setViewLevel('globe');

    if (cameraRef.current && controlsRef.current) {
      controlsRef.current.minDistance = 10.6;
      controlsRef.current.maxDistance = 55.0;
      controlsRef.current.update();
    }
  };

  const handleFlyToJezero = () => {
    switchToGlobeView();
    // Position camera facing Jezero Crater (77.45°E, 18.44°N)
    flyCameraToPlanetaryTarget(JEZERO_LAT, JEZERO_LON, 14.0, () => {
      // Transition smoothly into high-resolution 3D surface model
      switchToSurfaceView();
    });
  };

  const flyCameraToPlanetaryTarget = (
    lat: number,
    lon: number,
    targetDistance: number = 22.0,
    onComplete?: () => void
  ) => {
    if (!cameraRef.current || !controlsRef.current) return;

    // Convert target lat/lon to Cartesian position on Mars sphere
    const surfacePt = latLonToCartesian(lat, lon, MARS_RADIUS);
    // Apply axial tilt to align with rotated globe
    surfacePt.applyAxisAngle(new THREE.Vector3(0, 0, 1), THREE.MathUtils.degToRad(MARS_OBLIQUITY_DEG));

    // Place camera along the surface normal vector at targetDistance
    const normal = surfacePt.clone().normalize();
    const cameraTargetPos = normal.clone().multiplyScalar(targetDistance);

    flightAnimRef.current = {
      active: true,
      startPos: cameraRef.current.position.clone(),
      targetPos: cameraTargetPos,
      startTarget: controlsRef.current.target.clone(),
      endTarget: new THREE.Vector3(0, 0, 0),
      progress: 0,
      duration: 55,
      onComplete
    };
  };

  const handleResetToOuterSpace = () => {
    switchToGlobeView();
    if (!cameraRef.current || !controlsRef.current) return;

    flightAnimRef.current = {
      active: true,
      startPos: cameraRef.current.position.clone(),
      targetPos: new THREE.Vector3(0, 5, 26),
      startTarget: controlsRef.current.target.clone(),
      endTarget: new THREE.Vector3(0, 0, 0),
      progress: 0,
      duration: 50
    };
  };

  return (
    <div className="relative w-full h-full select-none overflow-hidden bg-mars-dark">
      {/* Three.js Canvas Container */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top Header: Primary View Switcher & Action Toolbar */}
      <div className="absolute top-4 left-4 z-20 flex flex-col gap-2.5">
        <div className="bg-mars-panel/90 backdrop-blur border border-mars-border p-2 rounded-xl flex items-center gap-3 shadow-2xl text-xs">
          {/* View Scale Switcher */}
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

          {/* Fly to Jezero Descent Action */}
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
              title="Return to Global Planetary View"
            >
              <Globe2 className="w-3.5 h-3.5 text-mars-accent" />
              <span>Orbit View</span>
            </button>
          )}

          {/* Reset Camera View */}
          <button
            onClick={viewLevel === 'globe' ? handleResetToOuterSpace : () => {
              if (cameraRef.current && controlsRef.current) {
                cameraRef.current.position.set(0, 18, 26);
                controlsRef.current.target.set(0, 0, 0);
                controlsRef.current.update();
              }
            }}
            className="p-1.5 rounded-lg border border-mars-border hover:bg-mars-border text-mars-subtle hover:text-white transition"
            title="Reset Camera Orientation"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Solar Shading Toggle */}
          <button
            onClick={() => setSolarLighting(!solarLighting)}
            className={`p-1.5 rounded-lg border transition flex items-center gap-1 text-[11px] ${
              solarLighting
                ? 'border-amber-500/40 text-amber-400 bg-amber-500/10'
                : 'border-mars-accent/40 text-mars-accent bg-mars-accent/10'
            }`}
            title={solarLighting ? 'Solar Shading: On (Click for Full Daylight)' : 'Full Daylight: On (Click for Solar Shading)'}
          >
            <Sun className="w-3.5 h-3.5" />
            <span>{solarLighting ? 'Solar' : 'Daylight'}</span>
          </button>
        </div>

        {/* Secondary Sub-Controls */}
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
          <div className="bg-mars-panel/90 backdrop-blur border border-mars-border p-1.5 rounded-lg flex items-center gap-1.5 w-fit text-xs">
            <span className="text-mars-subtle text-[11px] font-mono px-1">FLY TO:</span>
            {PLANETARY_LANDMARKS.slice(0, 5).map((lm) => (
              <button
                key={lm.name}
                onClick={() => {
                  if (lm.type === 'eva') {
                    handleFlyToJezero();
                  } else {
                    flyCameraToPlanetaryTarget(lm.lat, lm.lon, 18.0);
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
      {viewLevel === 'surface' && (
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
      )}

      {/* Bottom-Left: Live Orbital Telemetry */}
      <div className="absolute bottom-4 left-4 z-20 bg-mars-panel/90 backdrop-blur border border-mars-border px-3 py-1.5 rounded-lg text-[11px] font-mono text-mars-subtle shadow-md flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-white font-semibold">PLANETARY TELEMETRY</span>
        </div>
        <span>|</span>
        {viewLevel === 'globe' ? (
          <>
            <span>SUB-LON: <strong className="text-slate-200">{telemetry.subLon >= 0 ? `${telemetry.subLon}°E` : `${Math.abs(telemetry.subLon)}°W`}</strong></span>
            <span>SUB-LAT: <strong className="text-slate-200">{telemetry.subLat >= 0 ? `+${telemetry.subLat}°N` : `${telemetry.subLat}°S`}</strong></span>
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

      {/* Bottom-Right: Planet Specs & Interaction Guide */}
      <div className="absolute bottom-4 right-4 z-20 bg-mars-panel/90 backdrop-blur border border-mars-border px-3 py-1.5 rounded-lg text-[11px] font-mono text-mars-subtle shadow-md flex items-center gap-2">
        <span>{viewLevel === 'globe' ? 'Mars IAU 2000 Sphere (R=3396.19 km, Tilt 25.19°)' : 'USGS SIM 3464 Geologic Elevation Model'}</span>
        <span className="text-slate-500">•</span>
        <span className="text-slate-400">Left-Drag: 360° Rotate | Scroll: Zoom | DblClick: Focus</span>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Helper: Map Lon/Lat to Surface 3D World Coordinates
// ---------------------------------------------------------------------------
function lonLatToTerrainWorld(lon: number, lat: number, mesh: TerrainMesh3DResponse, vertExag: number) {
  const [minLon, minLat, maxLon, maxLat] = mesh.bounds_lonlat;
  const worldW = 32;
  const worldH = 30;

  const u = (lon - minLon) / (maxLon - minLon);
  const v = (lat - minLat) / (maxLat - minLat);

  const x = (u - 0.5) * worldW;
  const z = (0.5 - v) * worldH;

  const gx = Math.min(mesh.grid_width - 1, Math.max(0, Math.floor(u * mesh.grid_width)));
  const gy = Math.min(mesh.grid_height - 1, Math.max(0, Math.floor((1.0 - v) * mesh.grid_height)));
  const idx = gy * mesh.grid_width + gx;
  const elev = mesh.elevations[idx] || mesh.min_elev_m;

  const elevNorm = (elev - mesh.min_elev_m) / Math.max(mesh.max_elev_m - mesh.min_elev_m, 1.0);
  const y = elevNorm * 4.5 * vertExag;

  return { x, y, z };
}

// ---------------------------------------------------------------------------
// 3D Visual Mesh Generators
// ---------------------------------------------------------------------------
function createGlobeLandmarkPin(colorHex: number, size: number, isPulsing: boolean) {
  const group = new THREE.Group();

  // Vertical light needle
  const pinGeom = new THREE.CylinderGeometry(size * 0.12, size * 0.28, size * 2.8, 12);
  pinGeom.translate(0, size * 1.4, 0);
  const pinMat = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.9 });
  const pin = new THREE.Mesh(pinGeom, pinMat);
  group.add(pin);

  // Summit orb
  const orbGeom = new THREE.SphereGeometry(size * 0.55, 16, 16);
  const orbMat = new THREE.MeshBasicMaterial({ color: colorHex });
  const orb = new THREE.Mesh(orbGeom, orbMat);
  orb.position.y = size * 2.8;
  group.add(orb);

  // Landing ellipse ring on surface
  const ringGeom = new THREE.RingGeometry(size * 0.75, size * 0.95, 24);
  ringGeom.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({ color: colorHex, side: THREE.DoubleSide, transparent: true, opacity: 0.75 });
  const ring = new THREE.Mesh(ringGeom, ringMat);
  ring.position.y = 0.05;
  group.add(ring);

  return group;
}

function createTerrainPinMesh(colorHex: number, radius: number) {
  const group = new THREE.Group();
  const sphereGeom = new THREE.SphereGeometry(radius, 16, 16);
  const mat = new THREE.MeshStandardMaterial({ color: colorHex, emissive: colorHex, emissiveIntensity: 0.45 });
  const sphere = new THREE.Mesh(sphereGeom, mat);
  sphere.position.y = radius * 2.8;
  group.add(sphere);

  const stickGeom = new THREE.CylinderGeometry(0.04, 0.04, radius * 2.8);
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
    emissiveIntensity: 0.55,
    roughness: 0.25
  });
  return new THREE.Mesh(geom, mat);
}

export default MarsGlobeViewer;
