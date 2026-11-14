import React, { useEffect, useRef } from 'react';
import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import XYZ from 'ol/source/XYZ';
import TileGrid from 'ol/tilegrid/TileGrid';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import LineString from 'ol/geom/LineString';
import { Style, Stroke, Fill, Circle as CircleStyle, Text } from 'ol/style';
import { ScienceTarget, RoutePlanResponse } from '../types';

interface MapViewerProps {
  startCoords: [number, number];
  targetCoords: [number, number];
  scienceTargets: ScienceTarget[];
  selectedTargetId?: string;
  routePlan?: RoutePlanResponse;
  altRoutePlan?: RoutePlanResponse;
  activeBaseLayer: string; // 'ctx', 'mola', 'viking'
  clickMode: 'start' | 'target' | 'inspect';
  onMapClick: (lon: number, lat: number) => void;
  onTargetSelect: (target: ScienceTarget) => void;
}

export const MapViewer: React.FC<MapViewerProps> = ({
  startCoords,
  targetCoords,
  scienceTargets,
  selectedTargetId,
  routePlan,
  altRoutePlan,
  activeBaseLayer,
  clickMode,
  onMapClick,
  onTargetSelect
}) => {
  const mapElement = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const vectorSourceRef = useRef<VectorSource>(new VectorSource());

  // Initialize Map
  useEffect(() => {
    if (!mapElement.current || mapRef.current) return;

    // Mars Trek Equirectangular TileGrid: MatrixWidth = 2^(z+1), MatrixHeight = 2^z
    // TopLeft: -180, 90; Extent: [-180, -90, 180, 90]
    const resolutions: number[] = [];
    for (let z = 0; z <= 13; z++) {
      resolutions.push(360.0 / (256 * (2 ** (z + 1))));
    }

    const marsTileGrid = new TileGrid({
      extent: [-180.0, -90.0, 180.0, 90.0],
      resolutions: resolutions,
      tileSize: [256, 256],
      origin: [-180.0, 90.0]
    });

    // Jezero CTX 6m layer source
    const ctxSource = new XYZ({
      tileGrid: marsTileGrid,
      maxZoom: 13,
      minZoom: 5,
      tileUrlFunction: (tileCoord) => {
        const [z, x, y] = tileCoord;
        // Mars Trek row index y is positive downwards
        return `https://trek.nasa.gov/tiles/Mars/EQ/JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0/1.0.0/default/default028mm/${z}/${y}/${x}.png`;
      }
    });

    // Global MOLA Shaded Relief source
    const molaSource = new XYZ({
      tileGrid: marsTileGrid,
      maxZoom: 8,
      minZoom: 0,
      tileUrlFunction: (tileCoord) => {
        const [z, x, y] = tileCoord;
        return `https://trek.nasa.gov/tiles/Mars/EQ/Mars_MGS_MOLA_ClrShade_merge_global_463m/1.0.0/default/default028mm/${z}/${y}/${x}.jpg`;
      }
    });

    // Global Viking Color Mosaic
    const vikingSource = new XYZ({
      tileGrid: marsTileGrid,
      maxZoom: 7,
      minZoom: 0,
      tileUrlFunction: (tileCoord) => {
        const [z, x, y] = tileCoord;
        return `https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/default/default028mm/${z}/${y}/${x}.jpg`;
      }
    });

    const ctxLayer = new TileLayer({
      source: ctxSource,
      properties: { id: 'ctx' },
      visible: true
    });

    const molaLayer = new TileLayer({
      source: molaSource,
      properties: { id: 'mola' },
      visible: false
    });

    const vikingLayer = new TileLayer({
      source: vikingSource,
      properties: { id: 'viking' },
      visible: false
    });

    const vectorLayer = new VectorLayer({
      source: vectorSourceRef.current,
      zIndex: 10
    });

    const map = new Map({
      target: mapElement.current,
      layers: [vikingLayer, molaLayer, ctxLayer, vectorLayer],
      view: new View({
        projection: 'EPSG:4326', // Planetocentric degrees Equirectangular
        center: [77.43, 18.44], // Center on Jezero exploration sector
        zoom: 12,
        minZoom: 5,
        maxZoom: 14
      })
    });

    map.on('singleclick', (evt) => {
      const coords = evt.coordinate;
      onMapClick(coords[0], coords[1]);
    });

    mapRef.current = map;

    return () => {
      map.setTarget(undefined);
      mapRef.current = null;
    };
  }, []);

  // Switch base layers
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.getLayers().forEach((layer) => {
      const id = layer.get('id');
      if (id === 'ctx' || id === 'mola' || id === 'viking') {
        layer.setVisible(id === activeBaseLayer);
      }
    });
  }, [activeBaseLayer]);

  // Update vector features (Start, Target, Route, Science POIs)
  useEffect(() => {
    const source = vectorSourceRef.current;
    source.clear();

    // 1. Alternate Route (if present)
    if (altRoutePlan && altRoutePlan.coords_lonlat.length > 1) {
      const altLine = new Feature({
        geometry: new LineString(altRoutePlan.coords_lonlat),
        properties: { type: 'alt_route' }
      });
      altLine.setStyle(
        new Style({
          stroke: new Stroke({
            color: '#EAB308',
            width: 3,
            lineDash: [6, 6]
          })
        })
      );
      source.addFeature(altLine);
    }

    // 2. Primary Route
    if (routePlan && routePlan.coords_lonlat.length > 1) {
      const mainLine = new Feature({
        geometry: new LineString(routePlan.coords_lonlat),
        properties: { type: 'primary_route' }
      });
      mainLine.setStyle(
        new Style({
          stroke: new Stroke({
            color: routePlan.mode === 'safe' ? '#38BDF8' : '#F97316',
            width: 4
          })
        })
      );
      source.addFeature(mainLine);
    }

    // 3. Science Targets
    scienceTargets.forEach((t) => {
      const isSelected = t.target_id === selectedTargetId;
      const feat = new Feature({
        geometry: new Point([t.lon, t.lat]),
        properties: { type: 'science_target', target: t }
      });
      feat.setStyle(
        new Style({
          image: new CircleStyle({
            radius: isSelected ? 8 : 6,
            fill: new Fill({ color: isSelected ? '#A855F7' : '#6366F1' }),
            stroke: new Stroke({ color: '#FFFFFF', width: isSelected ? 2.5 : 1.5 })
          }),
          text: new Text({
            text: t.name.split(' ')[0],
            offsetY: -14,
            fill: new Fill({ color: '#FFFFFF' }),
            stroke: new Stroke({ color: '#0F172A', width: 3 }),
            font: 'bold 11px sans-serif'
          })
        })
      );
      source.addFeature(feat);
    });

    // 4. Staging Point Marker
    if (startCoords) {
      const startFeat = new Feature({
        geometry: new Point(startCoords),
        properties: { type: 'start' }
      });
      startFeat.setStyle(
        new Style({
          image: new CircleStyle({
            radius: 8,
            fill: new Fill({ color: '#22C55E' }),
            stroke: new Stroke({ color: '#FFFFFF', width: 2.5 })
          }),
          text: new Text({
            text: 'STAGING',
            offsetY: 15,
            fill: new Fill({ color: '#22C55E' }),
            stroke: new Stroke({ color: '#0B0D13', width: 3 }),
            font: 'bold 11px sans-serif'
          })
        })
      );
      source.addFeature(startFeat);
    }

    // 5. Destination Target Marker
    if (targetCoords) {
      const targetFeat = new Feature({
        geometry: new Point(targetCoords),
        properties: { type: 'target' }
      });
      targetFeat.setStyle(
        new Style({
          image: new CircleStyle({
            radius: 9,
            fill: new Fill({ color: '#EF4444' }),
            stroke: new Stroke({ color: '#FFFFFF', width: 2.5 })
          }),
          text: new Text({
            text: 'DESTINATION',
            offsetY: 16,
            fill: new Fill({ color: '#EF4444' }),
            stroke: new Stroke({ color: '#0B0D13', width: 3 }),
            font: 'bold 11px sans-serif'
          })
        })
      );
      source.addFeature(targetFeat);
    }
  }, [startCoords, targetCoords, scienceTargets, selectedTargetId, routePlan, altRoutePlan]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapElement} className="w-full h-full cursor-crosshair" />

      {/* Map Mode Indicator */}
      <div className="absolute top-4 left-4 z-20 bg-mars-panel/90 backdrop-blur border border-mars-border px-3 py-1.5 rounded-lg text-xs flex items-center gap-2 shadow-lg">
        <span className="w-2.5 h-2.5 rounded-full bg-mars-red animate-pulse" />
        <span className="text-mars-subtle uppercase tracking-wider font-semibold">Map Action:</span>
        <span className="text-white font-medium capitalize">
          {clickMode === 'start' && 'Click to set Staging Location'}
          {clickMode === 'target' && 'Click to set Destination Target'}
          {clickMode === 'inspect' && 'Click to inspect point terrain'}
        </span>
      </div>

      {/* Coordinate Scale & Center Info */}
      <div className="absolute bottom-4 left-4 z-20 bg-mars-panel/90 backdrop-blur border border-mars-border px-3 py-1.5 rounded text-[11px] text-mars-subtle font-mono shadow-md">
        Jezero Sector: 18.21°N - 18.72°N, 77.16°E - 77.70°E | IAU 2000 Mars
      </div>
    </div>
  );
};
