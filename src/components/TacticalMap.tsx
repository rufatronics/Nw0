import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon, Circle, Rectangle } from 'react-leaflet';
import L from 'leaflet';
import { cn } from '@/src/lib/utils';
import { StateThreatData, HeatmapCell } from '../services/aiService';

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
  "Adamawa": [9.3265, 12.4453],
  "Bauchi": [10.3103, 9.8439],
  "Benue": [7.3321, 8.7404],
  "Borno": [11.8311, 13.1510],
  "Gombe": [10.2791, 11.1731],
  "Jigawa": [12.1614, 9.4858],
  "Kaduna": [10.5105, 7.4165],
  "Kano": [12.0022, 8.5920],
  "Katsina": [12.9816, 7.6171],
  "Kebbi": [11.4942, 4.2333],
  "Kogi": [7.7337, 6.6906],
  "Kwara": [8.4799, 4.5418],
  "Nasarawa": [8.4904, 8.1991],
  "Niger": [9.9309, 5.5983],
  "Plateau": [9.2182, 9.5179],
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
}

const REGIONS = [
  { bounds: { minLat: 9.0, maxLat: 14.0, minLng: 3.0, maxLng: 10.0 } },
  { bounds: { minLat: 7.0, maxLat: 14.0, minLng: 9.0, maxLng: 15.0 } },
  { bounds: { minLat: 7.0, maxLat: 11.5, minLng: 2.5, maxLng: 7.5 } },
  { bounds: { minLat: 6.5, maxLat: 10.5, minLng: 7.0, maxLng: 11.0 } }
];

export default function TacticalMap({ 
  className, 
  center = [10.0000, 8.5000], // Center of Northern Nigeria
  zoom = 6,
  stateThreats = [],
  heatmapCells = []
}: TacticalMapProps) {
  console.log(`TacticalMap rendering with ${heatmapCells.length} heatmap cells.`);

  // Generate a base grid of "Safe" cells if no data is present
  const baseGrid = React.useMemo(() => {
    if (heatmapCells.length > 0) return [];
    
    const cells: HeatmapCell[] = [];
    REGIONS.forEach(region => {
      for (let lat = region.bounds.minLat; lat <= region.bounds.maxLat; lat += 0.5) { // Using 0.5 for base grid to avoid performance lag
        for (let lng = region.bounds.minLng; lng <= region.bounds.maxLng; lng += 0.5) {
          cells.push({ lat, lng, level: 1 });
        }
      }
    });
    return cells;
  }, [heatmapCells.length]);

  const displayCells = heatmapCells.length > 0 ? heatmapCells : baseGrid;
  
  const getThreatColor = (level: number) => {
    if (level >= 8) return '#ff3131'; // Critical
    if (level >= 6) return '#ffb000'; // High
    if (level >= 4) return '#facc15'; // Moderate
    return '#00ff41'; // Safe
  };

  const getHeatmapColor = (level: number) => {
    if (level >= 8) return '#ff0000'; // Pure Red (Critical)
    if (level >= 6) return '#ff4500'; // Orange Red (High)
    if (level >= 4) return '#ffa500'; // Orange (Moderate)
    if (level >= 3) return '#ffd700'; // Gold/Yellow (Calculated Risk)
    return '#00ff41'; // Tactical Green (Safe Zone)
  };

  return (
    <div className={cn("relative w-full h-full", className)}>
      <MapContainer 
        center={center} 
        zoom={zoom} 
        scrollWheelZoom={true}
        zoomControl={false}
        className="w-full h-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* 10km Grid Heatmap (Terrain Based) */}
        {displayCells.map((cell, idx) => {
          if (typeof cell.lat !== 'number' || typeof cell.lng !== 'number') return null;
          const isBaseGrid = heatmapCells.length === 0;
          const step = isBaseGrid ? 0.25 : 0.05; // Half of the grid step
          return (
            <Rectangle
              key={`cell-${idx}`}
              bounds={[
                [cell.lat - step, cell.lng - step],
                [cell.lat + step, cell.lng + step]
              ]}
              pathOptions={{
                fillColor: getHeatmapColor(cell.level),
                fillOpacity: isBaseGrid ? 0.1 : cell.level / 10,
                color: 'transparent',
                weight: 0
              }}
            />
          );
        })}

        {/* State Markers and Threat Zones */}
        {stateThreats.map((state) => {
          const coords = STATE_COORDINATES[state.stateName];
          if (!coords) return null;
          
          return (
            <React.Fragment key={state.stateName}>
              <Circle 
                center={coords} 
                radius={40000} // 40km radius for state-level visualization
                pathOptions={{ 
                  fillColor: getThreatColor(state.threatLevel), 
                  fillOpacity: 0.1, 
                  color: getThreatColor(state.threatLevel), 
                  weight: 2,
                  dashArray: '10, 10'
                }} 
              >
                <Popup>
                  <div className="bg-tactical-panel p-3 border border-tactical-border text-tactical-accent font-mono text-[10px]">
                    <h3 className="font-bold border-b border-tactical-border mb-2 pb-1 uppercase text-sm">
                      {state.stateName} STATE REPORT
                    </h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-500">THREAT LEVEL:</span>
                        <span className={cn("font-bold", state.threatLevel >= 8 ? "text-tactical-danger" : "text-tactical-warning")}>
                          {state.threatLevel}/10
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 block mb-1">WEATHER:</span>
                        <p className="text-gray-300 italic">{state.weather}</p>
                      </div>
                      <div>
                        <span className="text-gray-500 block mb-1">TERRAIN ANALYSIS:</span>
                        <p className="text-gray-300">{state.terrainFactors}</p>
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

      {/* Map HUD Elements */}
      <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2 pointer-events-none">
        <div className="bg-tactical-panel/80 backdrop-blur-md border border-tactical-border p-3 font-mono text-[10px] uppercase tracking-widest text-tactical-accent">
          <div className="flex justify-between gap-4">
            <span>REGION: NORTHERN NIGERIA</span>
            <span>STATES: 19</span>
          </div>
          <div className="mt-1 opacity-60">AI GROUNDING: GOOGLE SEARCH ACTIVE</div>
          <div className="mt-1 text-[8px] text-tactical-danger animate-pulse">HEATMAP: 10KM TERRAIN GRID ACTIVE</div>
        </div>
      </div>
    </div>
  );
}
