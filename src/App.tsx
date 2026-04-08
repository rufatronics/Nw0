import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import TacticalMap from './components/TacticalMap';
import TacticalChat from './components/TacticalChat';
import SignalIntel from './components/SignalIntel';
import { Eye, EyeOff, Brain, Loader2, ShieldCheck, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { db, auth, handleFirestoreError, OperationType } from './firebase';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { scrapeAndAnalyzeSecurity, StateThreatData, HeatmapCell } from './services/aiService';
import { useAuthState } from 'react-firebase-hooks/auth';

export default function App() {
  const [user] = useAuthState(auth);
  const [uiVisible, setUiVisible] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [stateThreats, setStateThreats] = useState<StateThreatData[]>([]);
  const [intelReports, setIntelReports] = useState<any[]>([]);
  const [heatmapCells, setHeatmapCells] = useState<HeatmapCell[]>([]);

  // 1. Real-time listener for State Threats
  useEffect(() => {
    const path = "stateThreats";
    const q = query(collection(db, path));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const threats = snapshot.docs.map(doc => doc.data() as StateThreatData);
      setStateThreats(threats);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });
    return () => unsubscribe();
  }, []);

  // 2. Real-time listener for Intel Reports
  useEffect(() => {
    const path = "intelReports";
    const q = query(collection(db, path), orderBy("timestamp", "desc"), limit(10));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reports = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setIntelReports(reports);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });
    return () => unsubscribe();
  }, []);

  // 3. Real-time listener for Regional Heatmaps
  useEffect(() => {
    const path = "regionalHeatmaps";
    const q = query(collection(db, path));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allCells: HeatmapCell[] = [];
      console.log(`Heatmap snapshot received. Documents: ${snapshot.size}`);
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.cells) {
          console.log(`Region ${data.region} has ${data.cells.length} cells.`);
          allCells.push(...data.cells);
        }
      });
      console.log(`Total heatmap cells: ${allCells.length}`);
      setHeatmapCells(allCells);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });
    return () => unsubscribe();
  }, []);

  const runAIPrediction = async () => {
    if (isAnalyzing) return;
    setIsAnalyzing(true);
    try {
      await scrapeAndAnalyzeSecurity();
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
              className="h-14 border-b border-tactical-border bg-tactical-panel/80 backdrop-blur-md flex items-center justify-between px-6 pl-16 z-20"
            >
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-tactical-accent animate-pulse" />
                  <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-tactical-accent">
                    Intelligence Loop: {isAnalyzing ? 'Analyzing...' : 'Active'}
                  </span>
                </div>
                <button 
                  onClick={runAIPrediction}
                  disabled={isAnalyzing}
                  className="flex items-center gap-2 bg-tactical-accent/10 border border-tactical-accent/30 px-3 py-1 text-[9px] font-mono text-tactical-accent hover:bg-tactical-accent/20 transition-all disabled:opacity-50"
                >
                  {isAnalyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}
                  REFRESH REGIONAL INTELLIGENCE
                </button>
              </div>
              
              <div className="flex items-center gap-4 text-[10px] font-mono text-gray-400 uppercase tracking-widest">
                <span>Grounding: Google Search</span>
                <div className="h-4 w-[1px] bg-tactical-border" />
                <span>{new Date().toLocaleTimeString()} UTC</span>
              </div>
            </motion.header>
          )}
        </AnimatePresence>

        <div className="flex-1 relative">
          <TacticalMap stateThreats={stateThreats} heatmapCells={heatmapCells} />
          
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
                        stateThreats.sort((a, b) => b.threatLevel - a.threatLevel).map((state) => (
                          <div key={state.stateName} className="space-y-1">
                            <div className="flex justify-between text-[8px] font-mono uppercase text-gray-400">
                              <span>{state.stateName}</span>
                              <span className={state.threatLevel >= 8 ? "text-tactical-danger" : "text-tactical-warning"}>
                                {state.threatLevel}/10
                              </span>
                            </div>
                            <div className="h-1 w-full bg-tactical-border rounded-full overflow-hidden">
                              <div 
                                className={cn("h-full", state.threatLevel >= 8 ? "bg-tactical-danger" : "bg-tactical-warning")} 
                                style={{ width: `${state.threatLevel * 10}%` }} 
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
