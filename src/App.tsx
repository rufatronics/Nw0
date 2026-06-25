import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Sidebar from './components/Sidebar';
import TacticalMap from './components/TacticalMap';
import TacticalChat from './components/TacticalChat';
import SignalIntel from './components/SignalIntel';
import { Eye, EyeOff, Brain, Loader2, MoreVertical, Globe, Map, Radio, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { supabase } from './lib/supabase';
import { StateThreatData, HeatmapCell, IntelReport, RegionalHeatmap, Hotspot } from './types';
import tacticalStaticData from './data/tactical_db.json';

const normalizeStateThreat = (state: any): StateThreatData => ({
  id: state.id,
  state_name: state.state_name ?? state.n,
  threat_level: Number(state.threat_level ?? state.l ?? 1),
  weather: state.weather ?? state.w ?? 'Unknown',
  terrain_factors: state.terrain_factors ?? state.t ?? 'Unknown terrain',
  summary: state.summary ?? state.s ?? 'No state summary available.',
  last_updated: state.last_updated ?? new Date().toISOString(),
});

const normalizeIntelReport = (report: any): IntelReport => ({
  id: report.id,
  source: report.source ?? report.src ?? 'CACHE',
  content: report.content ?? report.c ?? 'No report content available.',
  state: report.state ?? report.st ?? 'GLOBAL',
  timestamp: report.timestamp ?? report.ts ?? new Date().toISOString(),
  threat_level: Number(report.threat_level ?? report.l ?? 1),
});

const normalizeHeatmapCell = (cell: any): HeatmapCell => ({
  lat: Number(cell.lat),
  lng: Number(cell.lng),
  level: Number(cell.level ?? cell.l ?? 1),
});

const normalizeHotspot = (spot: any): Hotspot => ({
  id: String(spot.id),
  lat: Number(spot.lat),
  lng: Number(spot.lng),
  label: String(spot.label),
  threat: Number(spot.threat ?? 1),
  reason: String(spot.reason ?? 'No tactical rationale available.'),
});

const staticStates = ((tacticalStaticData as any).states || []).map(normalizeStateThreat);
const staticReports = ((tacticalStaticData as any).reports || []).map(normalizeIntelReport);
const staticHeatmapCells = ((tacticalStaticData as any).hex_grid || []).map(normalizeHeatmapCell);
const staticHotspots = ((tacticalStaticData as any).hotspots || []).map(normalizeHotspot);

interface SectorListProps {
  states: StateThreatData[];
  activePanel: string;
}

function SectorList({ states, activePanel }: SectorListProps) {
  const sortedStates = useMemo(
    () => [...states].sort((a, b) => b.threat_level - a.threat_level || a.state_name.localeCompare(b.state_name)),
    [states]
  );

  return (
    <div className="space-y-2">
      <div className="text-[9px] font-mono text-gray-500 uppercase">
        Active Panel: <span className="text-tactical-accent">{activePanel}</span>
      </div>
      <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
        {sortedStates.map((state) => (
          <div key={state.state_name} className="flex items-center justify-between border border-tactical-border bg-white/5 px-3 py-2">
            <div>
              <div className="text-[10px] font-mono text-gray-200 uppercase">{state.state_name}</div>
              <div className="text-[8px] font-mono text-gray-500 uppercase">{state.terrain_factors}</div>
            </div>
            <div className={cn(
              "text-[10px] font-mono font-bold",
              state.threat_level >= 8 ? 'text-tactical-danger' : state.threat_level >= 5 ? 'text-tactical-warning' : 'text-tactical-accent'
            )}>
              {state.threat_level}/10
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Main Application Component (Northwatch Tactical)
 *
 * Orchestrates the tactical intelligence dashboard, handling:
 * 1. Real-time Supabase data synchronization for threats and reports.
 * 2. Responsive UI state management (Mobile vs Desktop).
 * 3. AI Prediction orchestration.
 * 4. Modular HUD and Map rendering.
 */
export default function App() {
  const [uiVisible, setUiVisible] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [stateThreats, setStateThreats] = useState<StateThreatData[]>([]);
  const [intelReports, setIntelReports] = useState<IntelReport[]>([]);
  const [heatmapCells, setHeatmapCells] = useState<HeatmapCell[]>([]);
  const [hotspots, setHotspots] = useState<Hotspot[]>(staticHotspots);
  const [dataSource, setDataSource] = useState<'LIVE' | 'CACHE'>('LIVE');
  const [isMobile, setIsMobile] = useState(false);
  const [showSatellite, setShowSatellite] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activePanel, setActivePanel] = useState('map');
  const [currentTime, setCurrentTime] = useState(() => new Date());

  const handlePanelSelect = (id: string) => {
    setActivePanel(id);
    if (isMobile) setMenuOpen(true);
  };

  const loadStateThreats = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('state_threats')
        .select('*');

      if (error || !data || data.length === 0) throw new Error('Supabase unavailable');

      setStateThreats((data || []).map(normalizeStateThreat));
      setDataSource('LIVE');
    } catch (e) {
      console.warn('Falling back to Static Intelligence Cache for States');
      setStateThreats(staticStates);
      setDataSource('CACHE');
    }
  }, []);

  const loadIntelReports = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('intel_reports')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(10);

      if (error || !data || data.length === 0) throw new Error('Supabase unavailable');
      setIntelReports((data || []).map(normalizeIntelReport));
    } catch (e) {
      setIntelReports(staticReports);
    }
  }, []);

  const loadHeatmaps = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('regional_heatmaps')
        .select('*');

      if (error || !data || data.length === 0) throw new Error('Supabase unavailable');

      const allCells: HeatmapCell[] = [];
      data?.forEach((region: RegionalHeatmap) => {
        if (region.cells) allCells.push(...region.cells.map(normalizeHeatmapCell));
      });
      setHeatmapCells(allCells);
    } catch (e) {
      setHeatmapCells(staticHeatmapCells);
    }
  }, []);

  const refreshIntelData = useCallback(async () => {
    await Promise.all([
      loadStateThreats(),
      loadIntelReports(),
      loadHeatmaps(),
    ]);
    setHotspots(staticHotspots);
  }, [loadHeatmaps, loadIntelReports, loadStateThreats]);

  /**
   * Device Detection
   * Monitors viewport width to adapt UI for Nigerian mobile usage.
   */
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    refreshIntelData();
  }, [refreshIntelData]);

  /**
   * State Threat Data Pipeline
   * Synchronizes with 'state_threats' table for live regional monitoring.
   */
  useEffect(() => {
    const subscription = supabase
      .channel('state_threats_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'state_threats' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setStateThreats(prev => [...prev, normalizeStateThreat(payload.new)]);
        } else if (payload.eventType === 'UPDATE') {
          const next = normalizeStateThreat(payload.new);
          setStateThreats(prev => prev.map(item => item.state_name === next.state_name ? next : item));
        } else if (payload.eventType === 'DELETE') {
          setStateThreats(prev => prev.filter(item => item.state_name !== payload.old.state_name));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  /**
   * Signal Intelligence Pipeline (SIGINT)
   * Monitors 'intel_reports' for real-time field data and classified sitreps.
   */
  useEffect(() => {
    const subscription = supabase
      .channel('intel_reports_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'intel_reports' }, (payload) => {
        setIntelReports(prev => [normalizeIntelReport(payload.new), ...prev].slice(0, 10));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  /**
   * Geospatial Heatmap Pipeline
   * Synchronizes regional danger grid cells for high-fidelity terrain visualization.
   */
  useEffect(() => {
    const subscription = supabase
      .channel('regional_heatmaps_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'regional_heatmaps' }, () => {
        loadHeatmaps();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [loadHeatmaps]);

  const runAIPrediction = async () => {
    if (isAnalyzing) return;
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-security');
      if (error) throw error;
      console.log('AI Prediction triggered:', data);
      await refreshIntelData();
    } catch (error) {
      console.error('AI Prediction failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="flex h-screen w-screen bg-tactical-bg overflow-hidden relative text-gray-300 font-sans">
      <div className="scanlines" />
      <div className="grid-overlay" />

      {/* UI Toggle Button */}
      <button
        type="button"
        onClick={() => setUiVisible(!uiVisible)}
        className="fixed top-4 left-4 z-[5000] w-10 h-10 bg-tactical-panel/90 backdrop-blur-md border border-tactical-border flex items-center justify-center text-tactical-accent hover:bg-tactical-accent hover:text-black transition-all rounded-sm shadow-xl"
      >
        {uiVisible ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
      </button>

      <AnimatePresence>
        {uiVisible && (
          <motion.div
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            className={cn(
              "z-[4000] h-full",
              isMobile ? "fixed inset-y-0 left-0 w-72 bg-tactical-bg shadow-2xl" : "relative"
            )}
          >
            <div className="h-full relative pt-16">
               <Sidebar activeId={activePanel} onSelect={handlePanelSelect} />
               {isMobile && (
                 <button
                   type="button"
                   onClick={() => setUiVisible(false)}
                   className="absolute top-4 right-4 text-gray-500"
                 >
                   <EyeOff className="w-5 h-5" />
                 </button>
               )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 relative flex flex-col min-w-0 min-h-0 h-full">
        <AnimatePresence>
          {uiVisible && (
            <motion.header
              initial={{ y: -60 }} animate={{ y: 0 }} exit={{ y: -60 }}
              className={cn(
                "border-b border-tactical-accent/20 bg-black/80 backdrop-blur-xl flex items-center justify-between px-4 z-[5000] transition-all",
                isMobile ? "h-14 pl-4 pt-0" : "h-16 pl-4"
              )}
            >
              <div className="flex items-center gap-4 lg:gap-10">
                <button
                  type="button"
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="p-2 hover:bg-tactical-accent/10 border border-transparent hover:border-tactical-accent/30 transition-all text-tactical-accent"
                >
                  <MoreVertical className="w-5 h-5" />
                </button>

                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-tactical-accent animate-pulse" />
                    <span className="text-[9px] lg:text-[10px] font-mono uppercase tracking-[0.2em] lg:tracking-[0.3em] text-tactical-accent font-bold truncate max-w-[120px] lg:max-w-none">
                      NORTHWATCH // {dataSource}
                    </span>
                  </div>
                </div>

                {!isMobile && <div className="h-8 w-[1px] bg-tactical-border" />}

                <button
                  type="button"
                  onClick={runAIPrediction}
                  disabled={isAnalyzing}
                  className="group relative flex items-center gap-2 lg:gap-3 bg-black/40 border border-tactical-accent/20 px-3 lg:px-4 py-1 lg:py-1.5 overflow-hidden transition-all hover:border-tactical-accent/50"
                >
                  <div className="absolute inset-0 bg-tactical-accent/5 translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-300" />
                  {isAnalyzing ? <Loader2 className="w-3 h-3 lg:w-3.5 lg:h-3.5 animate-spin text-tactical-accent" /> : <Brain className="w-3 h-3 lg:w-3.5 lg:h-3.5 text-tactical-accent" />}
                  <span className="text-[8px] lg:text-[9px] font-mono text-tactical-accent uppercase tracking-[0.1em] lg:tracking-[0.2em] relative z-10">
                    {isAnalyzing ? (isMobile ? 'SYNC' : 'UPLOADING_VECTORS...') : (isMobile ? 'CRUNCH' : 'INITIATE_SITUATION_CRUNCH')}
                  </span>
                </button>
              </div>

              <div className="flex items-center gap-4 lg:gap-8 font-mono">
                <div className="text-right hidden sm:block">
                  <div className="text-[9px] lg:text-[10px] text-gray-300 uppercase tracking-tighter">
                    TARGET: <span className="text-tactical-accent">NATIONAL_NG</span>
                  </div>
                </div>
                {!isMobile && <div className="h-8 w-[1px] bg-tactical-border" />}
                <div className="text-[10px] lg:text-[11px] text-tactical-accent tracking-[0.1em] font-bold">
                  {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </motion.header>
          )}
        </AnimatePresence>

        {/* Tactical Dropdown Menu */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-16 left-4 z-[4500] w-[320px] lg:w-[400px] bg-black/90 backdrop-blur-2xl border border-tactical-border shadow-2xl p-4 overflow-y-auto max-h-[80vh]"
            >
              <div className="flex items-center justify-between mb-6 border-b border-tactical-border pb-2">
                <span className="text-xs font-mono text-tactical-accent tracking-[0.2em] uppercase">Tactical Operations Menu</span>
                <button type="button" onClick={() => setMenuOpen(false)} className="text-gray-500 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-8">
                {/* SETTINGS SECTION */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-mono text-gray-500 uppercase tracking-widest flex items-center gap-2">
                    <Map className="w-3 h-3" /> Visualization Controls
                  </h4>
                  <div className="flex items-center justify-between bg-white/5 p-3 border border-tactical-border">
                    <div className="space-y-1">
                      <div className="text-[10px] text-gray-300 uppercase font-bold">High-Res Satellite</div>
                      <div className="text-[8px] text-gray-500 uppercase">Preserves vegetation & terrain</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={showSatellite}
                        onChange={() => setShowSatellite(!showSatellite)}
                      />
                      <div className="w-9 h-5 bg-tactical-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-300 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-tactical-accent"></div>
                    </label>
                  </div>
                </div>

                {/* SENSORS SECTION */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-mono text-gray-500 uppercase tracking-widest flex items-center gap-2">
                    <Radio className="w-3 h-3" /> Intelligence Feed
                  </h4>
                  <SignalIntel reports={intelReports} />
                </div>

                {/* SECTORS SECTION */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-mono text-gray-500 uppercase tracking-widest flex items-center gap-2">
                    <Globe className="w-3 h-3" /> National Sectors
                  </h4>
                  <SectorList states={stateThreats} activePanel={activePanel} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1 relative flex flex-col min-h-0 overflow-hidden">
          {/* Map Section */}
          <div className={cn("relative flex-1 order-1 lg:order-2 h-full")}>
            <TacticalMap
              stateThreats={stateThreats}
              heatmapCells={heatmapCells}
              hotspots={hotspots}
              showSatellite={showSatellite}
            />
          </div>

          {/* Tactical Chat remains fixed but accessible */}
          <AnimatePresence>
            {uiVisible && (
              <div className="absolute bottom-4 right-4 z-40 w-full sm:w-auto px-4 sm:px-0">
                <TacticalChat />
              </div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
