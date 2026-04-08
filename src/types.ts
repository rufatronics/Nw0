export interface StateThreatData {
  id?: string;
  state_name: string;
  threat_level: number;
  weather: string;
  terrain_factors: string;
  summary: string;
  last_updated: string;
}

export interface HeatmapCell {
  lat: number;
  lng: number;
  level: number;
}

export interface RegionalHeatmap {
  id?: string;
  region_name: string;
  cells: HeatmapCell[];
  last_updated: string;
}

export interface IntelReport {
  id?: string;
  source: string;
  content: string;
  state: string;
  timestamp: string;
  threat_level: number;
}
