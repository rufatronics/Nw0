import React from 'react';
import { MapContainer, TileLayer, Popup, Circle, Rectangle } from 'react-leaflet';
import L from 'leaflet';
import { cn } from '@/src/lib/utils';
import { StateThreatData, HeatmapCell, Hotspot } from '../types';

// Fix for default marker icons in Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

// Approximate centers for Northern Nigeria states
const STATE_COORDINATES: Record<string, [number, number]> = {
  "Abia": [5.4527, 7.5248],
  "Adamawa": [9.3265, 12.4453],
  "Akwa Ibom": [5.0079, 7.8490],
  "Anambra": [6.2209, 6.9369],
  "Bauchi": [10.3103, 9.8439],
  "Bayelsa": [4.7719, 6.0699],
  "Benue": [7.3321, 8.7404],
  "Borno": [11.8311, 13.1510],
  "Cross River": [5.8702, 8.5988],
  "Delta": [5.5325, 5.8987],
  "Ebonyi": [6.2649, 8.0137],
  "Edo": [6.5438, 5.8987],
  "Ekiti": [7.7190, 5.3110],
  "Enugu": [6.5364, 7.4356],
  "FCT": [9.0765, 7.3986],
  "Gombe": [10.2791, 11.1731],
  "Imo": [5.5720, 7.0588],
  "Jigawa": [12.1614, 9.4858],
  "Kaduna": [10.5105, 7.4165],
  "Kano": [12.0022, 8.5920],
  "Katsina": [12.9816, 7.6171],
  "Kebbi": [11.4942, 4.2333],
  "Kogi": [7.7337, 6.6906],
  "Kwara": [8.4799, 4.5418],
  "Lagos": [6.5244, 3.3792],
  "Nasarawa": [8.4904, 8.1991],
  "Niger": [9.9309, 5.5983],
  "Ogun": [7.1608, 3.3486],
  "Ondo": [7.2571, 5.2058],
  "Osun": [7.5629, 4.5200],
  "Oyo": [7.3775, 3.9470],
  "Plateau": [9.2182, 9.5179],
  "Rivers": [4.8396, 6.9112],
  "Sokoto": [13.0059, 5.2476],
  "Taraba": [7.9994, 10.5888],
  "Yobe": [12.0000, 11.5000],
  "Zamfara": [12.1222, 6.2236]
};

interface TacticalMapProps {
  className?: string;
  center?: [number, number];
  zoom?: number;
  stateThreats: StateThreatData[];
  heatmapCells: HeatmapCell[];
  hotspots?: Hotspot[];
  showSatellite?: boolean;
}

const REGIONS = [
  { bounds: { minLat: 9.0, maxLat: 14.0, minLng: 3.0, maxLng: 10.0 } },
  { bounds: { minLat: 7.0, maxLat: 14.0, minLng: 9.0, maxLng: 15.0 } },
  { bounds: { minLat: 7.0, maxLat: 11.5, minLng: 2.5, maxLng: 7.5 } },
  { bounds: { minLat: 6.5, maxLat: 10.5, minLng: 7.0, maxLng: 11.0 } }
];

/**
 * TacticalMap Component
 * 
 * Provides a high-fidelity geospatial intelligence interface using Leaflet.
 * Supports dual-mode visualization:
 * 1. Dark Matter (Standard): High-contrast tactical mode for urban/structural analysis.
 * 2. Satellite (Terrain): High-res terrain-aware mode for vegetation and topography analysis.
 */
export default function TacticalMap({ 
/**
 * @param {TacticalMapProps} props
 * @param {StateThreatData[]} props.stateThreats - Array of threat data by state
 * @param {HeatmapCell[]} props.heatmapCells - National 5000+ point danger grid
 * @param {Hotspot[]} props.hotspots - High-priority predictive danger zones
 * @param {boolean} props.showSatellite - Toggle for Satellite vs Dark mode
 */
  className, 
  center = [9.0820, 8.6753], // Geodetic center of Nigeria
  zoom = 6,
  stateThreats = [],
  heatmapCells = [],
  hotspots = [],
  showSatellite = false
}: TacticalMapProps) {
  /**
   * Base Grid Memoization
   * Used for fallback visualization if the dynamic grid is loading or unavailable.
   */
  const baseGrid = React.useMemo(() => {
    if (heatmapCells.length > 0) return [];
    
    const cells: HeatmapCell[] = [];
    REGIONS.forEach(region => {
      for (let lat = region.bounds.minLat; lat <= region.bounds.maxLat; lat += 0.5) {
        for (let lng = region.bounds.minLng; lng <= region.bounds.maxLng; lng += 0.5) {
          cells.push({ lat, lng, level: 1 });
        }
      }
    });
    return cells;
  }, [heatmapCells.length]);

  const displayCells = heatmapCells.length > 0 ? heatmapCells : baseGrid;
  
  /**
   * Color Mapping Functions
   * Translates danger levels (1-10) into Tactical RGB values.
   */
  const getThreatColor = (level: number) => {
    if (level >= 8) return '#FF2079'; // CRITICAL_DANGER
    if (level >= 4) return '#FFB300'; // MODERATE_THREAT
    return '#00BFFF'; // STABLE_ZONE
  };

  const getHeatmapColor = (level: number) => {
    if (level >= 8) return '#FF2079';
    if (level >= 6) return '#FF2079';
    if (level >= 4) return '#FFB300';
    if (level >= 3) return '#FFB300';
    return '#00BFFF';
  };

  return (
    <div className={cn("relative w-full h-full", className)}>
      <MapContainer 
        center={center} 
        zoom={zoom} 
        scrollWheelZoom={true}
        zoomControl={false}
        preferCanvas={true}
        className="w-full h-full"
      >
        {/* Layer Toggle logic: Satellite vs Dark Matter */}
        {showSatellite ? (
          <TileLayer
            attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
        ) : (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
        )}

        {/* Tactical Coordinates HUD (Centered Overlay) */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] flex gap-4 pointer-events-none">
          <div className="bg-black/60 backdrop-blur-md border border-tactical-accent/20 px-3 py-1 flex items-center gap-2">
            <span className="text-[8px] font-mono text-tactical-accent uppercase tracking-widest">Lat: {center[0].toFixed(4)}N</span>
            <div className="w-[1px] h-3 bg-tactical-accent/20" />
            <span className="text-[8px] font-mono text-tactical-accent uppercase tracking-widest">Lng: {center[1].toFixed(4)}E</span>
          </div>
        </div>

        {/* Reticle Overlay: Visual reference for the user */}
        <div className="absolute inset-0 z-[1000] pointer-events-none flex items-center justify-center">
          <div className="relative w-48 h-48">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1px] h-4 bg-tactical-accent/40" />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[1px] h-4 bg-tactical-accent/40" />
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-[1px] bg-tactical-accent/40" />
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-[1px] bg-tactical-accent/40" />
            <div className="absolute inset-0 border border-tactical-accent/10 rounded-full" />
          </div>
        </div>
        
        {/* National 5000+ Point Danger Grid */}
        {displayCells.map((cell, idx) => {
          if (typeof cell.lat !== 'number' || typeof cell.lng !== 'number') return null;
          const isBaseGrid = heatmapCells.length === 0;
          const isHighThreat = cell.level >= 8;
          const isModerate = cell.level >= 4 && cell.level < 8;
          
          const step = isBaseGrid ? 0.15 : 0.08; 

          return (
            <Rectangle
              key={`rect-${idx}`}
              bounds={[
                [cell.lat - step, cell.lng - step],
                [cell.lat + step, cell.lng + step]
              ]}
              pathOptions={{
                fillColor: getHeatmapColor(cell.level),
                fillOpacity: isHighThreat ? 0.4 : isModerate ? 0.15 : 0.02,
                color: isHighThreat ? '#FF2079' : isModerate ? '#FFB300' : 'rgba(0, 191, 255, 0.1)',
                weight: isHighThreat ? 1 : 0.3,
                stroke: true,
                dashArray: isHighThreat ? undefined : '2, 4'
              }}
            />
          );
        })}

        {/* Predictive AI Hotspots: Highlight areas requiring immediate intervention */}
        {hotspots.map((spot) => (
          <React.Fragment key={spot.id}>
            <Circle
              center={[spot.lat, spot.lng]}
              radius={35000}
              pathOptions={{
                fillColor: 'transparent',
                color: '#FF2079',
                weight: 1,
                dashArray: '5, 10',
                className: 'animate-pulse'
              }}
            />
            <Circle
              center={[spot.lat, spot.lng]}
              radius={8000}
              pathOptions={{
                fillColor: '#FF2079',
                fillOpacity: 0.4,
                color: '#FF2079',
                weight: 2
              }}
            >
              <Popup>
                <div className="bg-tactical-panel p-2 border border-tactical-danger text-tactical-danger font-mono text-[9px] uppercase tracking-widest">
                  <div className="font-bold border-b border-tactical-danger mb-1">CRITICAL_PREDICTION: {spot.label}</div>
                  <div>Threat Index: {spot.threat}/10</div>
                  <div className="text-gray-400 mt-1 leading-tight">{spot.reason}</div>
                </div>
              </Popup>
            </Circle>
          </React.Fragment>
        ))}

        {/* State-Level Threat Aggregation Markers */}
        {stateThreats.map((state) => {
          const coords = STATE_COORDINATES[state.state_name];
          if (!coords) return null;
          
          return (
            <React.Fragment key={state.state_name}>
              <Circle 
                center={coords} 
                radius={40000} 
                pathOptions={{ 
                  fillColor: getThreatColor(state.threat_level), 
                  fillOpacity: 0.1, 
                  color: getThreatColor(state.threat_level), 
                  weight: 2,
                  dashArray: '10, 10'
                }} 
              >
                <Popup>
                  <div className="bg-tactical-panel p-3 border border-tactical-border text-tactical-accent font-mono text-[10px]">
                    <h3 className="font-bold border-b border-tactical-border mb-2 pb-1 uppercase text-sm">
                      {state.state_name} STATE REPORT
                    </h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-500">THREAT LEVEL:</span>
                        <span className={cn("font-bold", state.threat_level >= 8 ? "text-tactical-danger" : "text-tactical-warning")}>
                          {state.threat_level}/10
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 block mb-1">WEATHER:</span>
                        <p className="text-gray-300 italic">{state.weather}</p>
                      </div>
                      <div>
                        <span className="text-gray-500 block mb-1">TERRAIN ANALYSIS:</span>
                        <p className="text-gray-300">{state.terrain_factors}</p>
                      </div>
                      <div className="pt-2 border-t border-tactical-border">
                        <p className="text-xs leading-relaxed">{state.summary}</p>
                      </div>
                    </div>
                  </div>
                </Popup>
              </Circle>
            </React.Fragment>
          );
        })}
      </MapContainer>
    </div>
  );
}
