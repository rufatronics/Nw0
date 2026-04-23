import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import TacticalMap from './components/TacticalMap';
import TacticalChat from './components/TacticalChat';
import SignalIntel from './components/SignalIntel';
import { Eye, EyeOff, Brain, Loader2, ShieldCheck, AlertCircle } from 'lucide-react';
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
        className="fixed top-4 left-4 z-[3000] w-10 h-10 bg-tactical-panel border border-tactical-border flex items-center justify-center text-tactical-accent hover:bg-tactical-accent hover:text-black transition-all"
      >
        {uiVisible ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
      </button>

      <AnimatePresence>
        {uiVisible && (
          <motion.div initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} className="z-30 h-full">
            <Sidebar />
          </motion.div>
        )}
      </AnimatePresence>
      
      <main className="flex-1 relative flex flex-col">
        <AnimatePresence>
          {uiVisible && (
            <motion.header 
              initial={{ y: -60 }} animate={{ y: 0 }} exit={{ y: -60 }}
              className="h-16 border-b border-tactical-accent/20 bg-black/60 backdrop-blur-xl flex items-center justify-between px-6 pl-16 z-20"
            >
              <div className="flex items-center gap-10">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-tactical-accent animate-pulse" />
                    <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-tactical-accent font-bold">
                      NORTHWATCH INTEL_CORE // {dataSource}
                    </span>
                  </div>
                  <div className="text-[8px] font-mono text-gray-500 uppercase tracking-widest">
                    Encryption: AES-256-GCM | Protocol: SITREP-4.1
                  </div>
                </div>

                <div className="h-8 w-[1px] bg-tactical-border" />

                <button 
                  onClick={runAIPrediction}
                  disabled={isAnalyzing}
                  className="group relative flex items-center gap-3 bg-black/40 border border-tactical-accent/20 px-4 py-1.5 overflow-hidden transition-all hover:border-tactical-accent/50"
                >
                  <div className="absolute inset-0 bg-tactical-accent/5 translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-300" />
                  {isAnalyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin text-tactical-accent" /> : <Brain className="w-3.5 h-3.5 text-tactical-accent" />}
                  <span className="text-[9px] font-mono text-tactical-accent uppercase tracking-[0.2em] relative z-10">
                    {isAnalyzing ? 'UPLOADING_VECTORS...' : 'INITIATE_SITUATION_CRUNCH'}
                  </span>
                </button>
              </div>
              
              <div className="flex items-center gap-8 font-mono">
                <div className="text-right">
                  <div className="text-[10px] text-gray-300 uppercase tracking-tighter letter-spacing-1">
                    TARGET: <span className="text-tactical-accent">NATIONAL_NIGERIA</span>
                  </div>
                  <div className="text-[8px] text-gray-500 uppercase tracking-[0.2em]">
                    SENSORS: ACTIVE ({heatmapCells.length} NODES)
                  </div>
                </div>
                <div className="h-8 w-[1px] bg-tactical-border" />
                <div className="text-[11px] text-tactical-accent tracking-[0.1em] font-bold">
                  {new Date().toLocaleTimeString()} <span className="text-[8px] text-gray-500">ZULU</span>
                </div>
              </div>
            </motion.header>
          )}
        </AnimatePresence>

        <div className="flex-1 relative">
          <TacticalMap 
            stateThreats={stateThreats} 
            heatmapCells={heatmapCells} 
            hotspots={hotspots}
          />
          
          <AnimatePresence>
            {uiVisible && (
              <>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <SignalIntel reports={intelReports} />
                </motion.div>
                
                <motion.div 
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
                  className="absolute bottom-6 left-6 z-20 pointer-events-none"
                >
                  <div className="bg-tactical-panel/60 backdrop-blur-md border border-tactical-border p-4 w-72">
                    <h4 className="text-[10px] font-mono text-tactical-accent uppercase mb-3 tracking-widest border-b border-tactical-border pb-1">Regional Threat Matrix</h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                      {stateThreats.length === 0 ? (
                        <div className="text-[9px] text-gray-600 italic">Awaiting AI analysis...</div>
                      ) : (
                        stateThreats.sort((a, b) => b.threat_level - a.threat_level).map((state) => (
                          <div key={state.state_name} className="space-y-1">
                            <div className="flex justify-between text-[8px] font-mono uppercase text-gray-400">
                              <span>{state.state_name}</span>
                              <span className={state.threat_level >= 8 ? "text-tactical-danger" : "text-tactical-warning"}>
                                {state.threat_level}/10
                              </span>
                            </div>
                            <div className="h-1 w-full bg-tactical-border rounded-full overflow-hidden">
                              <div 
                                className={cn("h-full", state.threat_level >= 8 ? "bg-tactical-danger" : "bg-tactical-warning")} 
                                style={{ width: `${state.threat_level * 10}%` }} 
                              />
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </main>

      <AnimatePresence>
        {uiVisible && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
            <TacticalChat />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
