import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import TacticalMap from './components/TacticalMap';
import TacticalChat from './components/TacticalChat';
import SignalIntel from './components/SignalIntel';
import { Eye, EyeOff, Brain, Loader2, ShieldCheck, AlertCircle, MoreVertical, Globe, Map, Radio, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { supabase } from './lib/supabase';
import { StateThreatData, HeatmapCell, IntelReport, RegionalHeatmap, Hotspot } from './types';
import tacticalStaticData from './data/tactical_db.json';

export default function App() {
  const [uiVisible, setUiVisible] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [stateThreats, setStateThreats] = useState<StateThreatData[]>([]);
  const [intelReports, setIntelReports] = useState<IntelReport[]>([]);
  const [heatmapCells, setHeatmapCells] = useState<HeatmapCell[]>([]);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [dataSource, setDataSource] = useState<'LIVE' | 'CACHE'>('LIVE');
  const [isMobile, setIsMobile] = useState(false);
  const [showSatellite, setShowSatellite] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 1. Initial Fetch and Real-time listener for State Threats
  useEffect(() => {
    const fetchStateThreats = async () => {
      try {
        const { data, error } = await supabase
          .from('state_threats')
          .select('*');
        
        if (error || !data || data.length === 0) throw new Error('Supabase unavailable');
        
        setStateThreats(data || []);
        setDataSource('LIVE');
      } catch (e) {
        console.warn('Falling back to Static Intelligence Cache for States');
        const fallbackStates = (tacticalStaticData as any).states.map((s: any) => ({
          state_name: s.n,
          threat_level: s.l,
          weather: s.w,
          terrain_factors: s.t,
          summary: s.s
        }));
        setStateThreats(fallbackStates);
        setDataSource('CACHE');
      }
    };

    fetchStateThreats();
    
    // ... (rest of the registration logic remains, but we add guards)

    const subscription = supabase
      .channel('state_threats_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'state_threats' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setStateThreats(prev => [...prev, payload.new as StateThreatData]);
        } else if (payload.eventType === 'UPDATE') {
          setStateThreats(prev => prev.map(item => item.state_name === payload.new.state_name ? payload.new as StateThreatData : item));
        } else if (payload.eventType === 'DELETE') {
          setStateThreats(prev => prev.filter(item => item.state_name !== payload.old.state_name));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  // 2. Initial Fetch and Real-time listener for Intel Reports
  useEffect(() => {
    const fetchIntelReports = async () => {
      try {
        const { data, error } = await supabase
          .from('intel_reports')
          .select('*')
          .order('timestamp', { ascending: false })
          .limit(10);
        
        if (error || !data || data.length === 0) throw new Error('Supabase unavailable');
        setIntelReports(data || []);
      } catch (e) {
        const fallbackReports = ((tacticalStaticData as any).reports || []).map((r: any) => ({
          id: r.id,
          source: r.src,
          content: r.c,
          state: r.st,
          timestamp: r.ts,
          threat_level: r.l
        }));
        setIntelReports(fallbackReports);
      }
    };

    fetchIntelReports();

    const subscription = supabase
      .channel('intel_reports_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'intel_reports' }, (payload) => {
        setIntelReports(prev => [payload.new as IntelReport, ...prev].slice(0, 10));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  // 3. Initial Fetch and Real-time listener for Regional Heatmaps
  useEffect(() => {
    const fetchHeatmaps = async () => {
      try {
        const { data, error } = await supabase
          .from('regional_heatmaps')
          .select('*');
        
        if (error || !data || data.length === 0) throw new Error('Supabase unavailable');

        const allCells: HeatmapCell[] = [];
        data?.forEach((region: RegionalHeatmap) => {
          if (region.cells) allCells.push(...region.cells);
        });
        setHeatmapCells(allCells);
      } catch (e) {
        setHeatmapCells((tacticalStaticData as any).hex_grid || []);
      }
    };

    fetchHeatmaps();

    const subscription = supabase
      .channel('regional_heatmaps_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'regional_heatmaps' }, async () => {
        // For heatmaps, it's often easier to refetch all to ensure consistency across regions
        const { data } = await supabase.from('regional_heatmaps').select('*');
        const allCells: HeatmapCell[] = [];
        data?.forEach((region: RegionalHeatmap) => {
          if (region.cells) allCells.push(...region.cells);
        });
        setHeatmapCells(allCells);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  // 4. Hotspots (Predictive Danger Zones)
  useEffect(() => {
    if (dataSource === 'CACHE') {
      setHotspots((tacticalStaticData as any).hotspots || []);
    } else {
      // In a real live app we'd fetch from supabase, 
      // but for now we follow the user's focus on the static DB for this turn
      setHotspots((tacticalStaticData as any).hotspots || []);
    }
  }, [dataSource]);

  const runAIPrediction = async () => {
    if (isAnalyzing) return;
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('regional-security-analysis');
      if (error) throw error;
      console.log('AI Prediction triggered:', data);
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
              isMobile ? "fixed inset-0 w-72 bg-tactical-bg shadow-2xl" : "relative"
            )}
          >
            <div className="h-full relative pt-16">
               <Sidebar />
               {isMobile && (
                 <button 
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
                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                <button onClick={() => setMenuOpen(false)} className="text-gray-500 hover:text-white">
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
                  <div className="max-h-60 overflow-y-auto">
                    <Sidebar />
                  </div>
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
