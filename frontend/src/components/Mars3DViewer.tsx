import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { TerrainMesh3DResponse, RoutePlanResponse, ScienceTarget, EnvironmentalConditions } from '../types';
import { Eye, Compass, RotateCcw, Sliders, Play, Pause } from 'lucide-react';

interface Mars3DViewerProps {
  meshData?: TerrainMesh3DResponse;
  routePlan?: RoutePlanResponse;
  startCoords: [number, number];
  targetCoords: [number, number];
  scienceTargets: ScienceTarget[];
  selectedTargetId?: string;
  environment?: EnvironmentalConditions;
  onSelectTarget: (target: ScienceTarget) => void;
}

export const Mars3DViewer: React.FC<Mars3DViewerProps> = ({
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
  const [cameraMode, setCameraMode] = useState<'orbit' | 'drone' | 'astronaut'>('orbit');
  const [vertExaggeration, setVertExaggeration] = useState<number>(1.5);
  const [isPlayingFlyover, setIsPlayingFlyover] = useState<boolean>(false);
  const animProgressRef = useRef<number>(0);

  // Three.js internal references
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const terrainMeshRef = useRef<THREE.Mesh | null>(null);
  const routeLineRef = useRef<THREE.Line | null>(null);
  const markersGroupRef = useRef<THREE.Group | null>(null);
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);

  // Mouse drag state for orbit
  const isDraggingRef = useRef<boolean>(false);
  const prevMouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const sphericalRef = useRef<{ theta: number; phi: number; radius: number }>({
    theta: Math.PI / 4,
    phi: Math.PI / 3,
    radius: 350
  });
  const targetLookAtRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));

  // Initialize Scene
  useEffect(() => {
    if (!mountRef.current) return;

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    const scene = new THREE.Scene();
    // Atmospheric fog simulating Martian sky (ochre-peach dust glow)
    scene.background = new THREE.Color(0x180E0A);
    scene.fog = new THREE.FogExp2(0x180E0A, 0.0018);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 2000);
    camera.position.set(0, 180, 260);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    rendererRef.current = renderer;

    mountRef.current.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0x734839, 0.7);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xFFE5CC, 1.4);
    sunLight.position.set(150, 200, 100);
    sunLight.castShadow = true;
    scene.add(sunLight);
    sunLightRef.current = sunLight;

    // Markers group
    const markersGroup = new THREE.Group();
    scene.add(markersGroup);
    markersGroupRef.current = markersGroup;

    // Mouse Controls
    const dom = renderer.domElement;
    const onMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      prevMouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || cameraMode === 'astronaut') return;
      const dx = e.clientX - prevMouseRef.current.x;
      const dy = e.clientY - prevMouseRef.current.y;

      sphericalRef.current.theta -= dx * 0.006;
      sphericalRef.current.phi = Math.max(0.1, Math.min(Math.PI / 2.05, sphericalRef.current.phi - dy * 0.006));

      prevMouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isDraggingRef.current = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      sphericalRef.current.radius = Math.max(30, Math.min(600, sphericalRef.current.radius + e.deltaY * 0.25));
    };

    dom.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    dom.addEventListener('wheel', onWheel, { passive: false });

    // Animation Loop
    let reqId: number;
    const animate = () => {
      reqId = requestAnimationFrame(animate);

      if (cameraMode === 'orbit') {
        const { theta, phi, radius } = sphericalRef.current;
        const x = radius * Math.sin(phi) * Math.sin(theta);
        const y = radius * Math.cos(phi);
        const z = radius * Math.sin(phi) * Math.cos(theta);

        camera.position.set(
          targetLookAtRef.current.x + x,
          targetLookAtRef.current.y + y,
          targetLookAtRef.current.z + z
        );
        camera.lookAt(targetLookAtRef.current);
      } else if (cameraMode === 'drone' && routePlan && routePlan.coords_lonlat.length > 2) {
        // Fly along route
        if (isPlayingFlyover) {
          animProgressRef.current = (animProgressRef.current + 0.001) % 1.0;
        }
        const pts = routePlan.coords_lonlat;
        const idx = Math.floor(animProgressRef.current * (pts.length - 1));
        const pt = pts[idx];
        const nextPt = pts[Math.min(idx + 1, pts.length - 1)];

        if (meshData) {
          const pos = lonLatToWorld(pt[0], pt[1], meshData, vertExaggeration);
          const nextPos = lonLatToWorld(nextPt[0], nextPt[1], meshData, vertExaggeration);
          camera.position.set(pos.x, pos.y + 25, pos.z + 30);
          camera.lookAt(nextPos.x, nextPos.y + 5, nextPos.z);
        }
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
      window.removeEventListener('resize', handleResize);
      if (mountRef.current && dom) {
        mountRef.current.removeChild(dom);
      }
      renderer.dispose();
    };
  }, []);

  // Update Solar Elevation Light
  useEffect(() => {
    if (!sunLightRef.current || !environment) return;
    const elev = environment.solar_elevation_deg;
    const rad = THREE.MathUtils.degToRad(elev);
    const sunY = Math.max(Math.sin(rad) * 250, 10);
    const sunX = Math.cos(rad) * 200;
    sunLightRef.current.position.set(sunX, sunY, 100);
    sunLightRef.current.intensity = elev > 0 ? 1.4 : 0.2;
  }, [environment]);

  // Build / Update Terrain Mesh
  useEffect(() => {
    if (!sceneRef.current || !meshData) return;

    if (terrainMeshRef.current) {
      sceneRef.current.remove(terrainMeshRef.current);
      terrainMeshRef.current.geometry.dispose();
    }

    const { grid_width, grid_height, elevations, min_elev_m, max_elev_m } = meshData;
    const worldW = 300;
    const worldH = 280;

    const geometry = new THREE.PlaneGeometry(worldW, worldH, grid_width - 1, grid_height - 1);
    geometry.rotateX(-Math.PI / 2);

    const pos = geometry.attributes.position;
    const colors = new Float32Array(pos.count * 3);

    const elevRange = Math.max(max_elev_m - min_elev_m, 1.0);

    for (let i = 0; i < pos.count; i++) {
      const e = elevations[i] !== undefined ? elevations[i] : min_elev_m;
      const norm = (e - min_elev_m) / elevRange; // 0.0 to 1.0

      // Displace Y position
      pos.setY(i, norm * 45 * vertExaggeration);

      // Procedural Martian rock & mineral color mapping
      // Low crater floor: deep basaltic rust (0.6, 0.25, 0.16)
      // Mid delta terraces: oxidized clay ochre (0.78, 0.45, 0.25)
      // High crater rims & scarps: pale high-albedo silicate (0.85, 0.62, 0.42)
      let r = 0.55 + norm * 0.3;
      let g = 0.22 + norm * 0.38;
      let b = 0.14 + norm * 0.26;

      colors[i * 3] = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;
    }

    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.85,
      metalness: 0.1,
      flatShading: false
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    sceneRef.current.add(mesh);
    terrainMeshRef.current = mesh;
  }, [meshData, vertExaggeration]);

  // Update Route Line & Markers
  useEffect(() => {
    if (!sceneRef.current || !meshData) return;

    // 1. Draw Route Ribbon
    if (routeLineRef.current) {
      sceneRef.current.remove(routeLineRef.current);
      routeLineRef.current.geometry.dispose();
      routeLineRef.current = null;
    }

    if (routePlan && routePlan.coords_lonlat.length > 1) {
      const linePts: THREE.Vector3[] = [];
      routePlan.coords_lonlat.forEach(([lon, lat]) => {
        const p = lonLatToWorld(lon, lat, meshData, vertExaggeration);
        linePts.push(new THREE.Vector3(p.x, p.y + 1.2, p.z));
      });

      const lineGeom = new THREE.BufferGeometry().setFromPoints(linePts);
      const lineMat = new THREE.LineBasicMaterial({
        color: routePlan.mode === 'safe' ? 0x38BDF8 : 0xF97316,
        linewidth: 4
      });

      const line = new THREE.Line(lineGeom, lineMat);
      sceneRef.current.add(line);
      routeLineRef.current = line;
    }

    // 2. Draw 3D Markers
    const markersGroup = markersGroupRef.current;
    if (markersGroup) {
      markersGroup.clear();

      // Staging Marker
      const startPos = lonLatToWorld(startCoords[0], startCoords[1], meshData, vertExaggeration);
      const startMesh = createPinMesh(0x22C55E, 2.5);
      startMesh.position.set(startPos.x, startPos.y, startPos.z);
      markersGroup.add(startMesh);

      // Target Marker
      const targetPos = lonLatToWorld(targetCoords[0], targetCoords[1], meshData, vertExaggeration);
      const targetMesh = createPinMesh(0xEF4444, 3.0);
      targetMesh.position.set(targetPos.x, targetPos.y, targetPos.z);
      markersGroup.add(targetMesh);

      // Science POIs
      scienceTargets.forEach((t) => {
        const tPos = lonLatToWorld(t.lon, t.lat, meshData, vertExaggeration);
        const isSel = t.target_id === selectedTargetId;
        const poiMesh = createDiamondMesh(isSel ? 0xA855F7 : 0x6366F1, isSel ? 2.8 : 1.8);
        poiMesh.position.set(tPos.x, tPos.y + 3, tPos.z);
        markersGroup.add(poiMesh);
      });
    }
  }, [meshData, routePlan, startCoords, targetCoords, scienceTargets, selectedTargetId, vertExaggeration]);

  // Reset Camera View
  const handleResetCamera = () => {
    sphericalRef.current = { theta: Math.PI / 4, phi: Math.PI / 3, radius: 350 };
    targetLookAtRef.current.set(0, 0, 0);
    setCameraMode('orbit');
    setIsPlayingFlyover(false);
  };

  return (
    <div className="relative w-full h-full select-none overflow-hidden bg-mars-dark">
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Floating 3D Control Bar */}
      <div className="absolute top-4 left-4 z-20 bg-mars-panel/90 backdrop-blur border border-mars-border p-2 rounded-xl flex items-center gap-3 shadow-2xl text-xs">
        <div className="flex items-center gap-1.5 border-r border-mars-border/60 pr-3">
          <Compass className="w-4 h-4 text-mars-accent" />
          <span className="font-bold text-white tracking-wide">3D Mars Terrain</span>
        </div>

        {/* Camera Mode Toggles */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setCameraMode('orbit'); setIsPlayingFlyover(false); }}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
              cameraMode === 'orbit'
                ? 'bg-mars-accent text-black font-semibold'
                : 'text-mars-subtle hover:text-white bg-mars-dark/50'
            }`}
          >
            Orbit
          </button>

          <button
            onClick={() => { setCameraMode('drone'); setIsPlayingFlyover(true); }}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
              cameraMode === 'drone'
                ? 'bg-mars-accent text-black font-semibold'
                : 'text-mars-subtle hover:text-white bg-mars-dark/50'
            }`}
          >
            Flyover Drone
          </button>
        </div>

        {cameraMode === 'drone' && (
          <button
            onClick={() => setIsPlayingFlyover(!isPlayingFlyover)}
            className="p-1 rounded bg-mars-dark hover:bg-mars-border text-white text-xs"
          >
            {isPlayingFlyover ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>
        )}

        <button
          onClick={handleResetCamera}
          className="p-1.5 rounded-lg border border-mars-border hover:bg-mars-border text-mars-subtle hover:text-white transition"
          title="Reset Camera Orientation"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Vertical Exaggeration Slider */}
      <div className="absolute top-4 right-4 z-20 bg-mars-panel/90 backdrop-blur border border-mars-border px-3 py-2 rounded-xl flex items-center gap-2.5 shadow-2xl text-xs font-mono">
        <Sliders className="w-3.5 h-3.5 text-mars-subtle" />
        <span className="text-mars-subtle text-[11px]">Relief Exag:</span>
        <span className="text-mars-accent font-bold">{vertExaggeration.toFixed(1)}x</span>
        <input
          type="range"
          min="1.0"
          max="3.0"
          step="0.2"
          value={vertExaggeration}
          onChange={(e) => setVertExaggeration(Number(e.target.value))}
          className="w-20 accent-mars-accent cursor-pointer h-1.5 bg-mars-border rounded-lg"
        />
      </div>

      {/* Tactical Compass Overlay */}
      <div className="absolute bottom-4 right-4 z-20 bg-mars-panel/90 backdrop-blur border border-mars-border px-3 py-1.5 rounded-lg text-[11px] font-mono text-mars-subtle shadow-md">
        Sector: Jezero Western Delta | 2.41M Elevation Vertices | 60 FPS WebGL
      </div>
    </div>
  );
};

// Helper: Convert Lon/Lat into 3D World space coordinates
function lonLatToWorld(lon: number, lat: number, mesh: TerrainMesh3DResponse, vertExag: number) {
  const [minLon, minLat, maxLon, maxLat] = mesh.bounds_lonlat;
  const worldW = 300;
  const worldH = 280;

  const u = (lon - minLon) / (maxLon - minLon);
  const v = (lat - minLat) / (maxLat - minLat);

  const x = (u - 0.5) * worldW;
  const z = (0.5 - v) * worldH;

  // Bilinear elevation sample
  const gx = Math.min(mesh.grid_width - 1, Math.max(0, Math.floor(u * mesh.grid_width)));
  const gy = Math.min(mesh.grid_height - 1, Math.max(0, Math.floor((1.0 - v) * mesh.grid_height)));
  const idx = gy * mesh.grid_width + gx;
  const elev = mesh.elevations[idx] || mesh.min_elev_m;

  const elevNorm = (elev - mesh.min_elev_m) / Math.max(mesh.max_elev_m - mesh.min_elev_m, 1.0);
  const y = elevNorm * 45 * vertExag;

  return { x, y, z };
}

function createPinMesh(colorHex: number, radius: number) {
  const group = new THREE.Group();
  const sphereGeom = new THREE.SphereGeometry(radius, 16, 16);
  const mat = new THREE.MeshStandardMaterial({ color: colorHex, emissive: colorHex, emissiveIntensity: 0.3 });
  const sphere = new THREE.Mesh(sphereGeom, mat);
  sphere.position.y = radius * 2;
  group.add(sphere);

  const stickGeom = new THREE.CylinderGeometry(0.4, 0.4, radius * 2);
  const stickMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const stick = new THREE.Mesh(stickGeom, stickMat);
  stick.position.y = radius;
  group.add(stick);

  return group;
}

function createDiamondMesh(colorHex: number, size: number) {
  const geom = new THREE.OctahedronGeometry(size);
  const mat = new THREE.MeshStandardMaterial({
    color: colorHex,
    emissive: colorHex,
    emissiveIntensity: 0.4,
    roughness: 0.3
  });
  return new THREE.Mesh(geom, mat);
}
