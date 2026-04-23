import React from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, Info, ShieldAlert } from 'lucide-react';
import { cn } from '@/src/lib/utils';

interface SignalIntelProps {
  reports: any[];
}

export default function SignalIntel({ reports }: SignalIntelProps) {
  return (
    <div className="w-full">
      <div className="bg-tactical-panel/80 backdrop-blur-md border border-tactical-border p-4">
        <div className="flex items-center justify-between mb-4 border-b border-tactical-border pb-2">
          <h4 className="text-[10px] font-mono text-tactical-accent uppercase tracking-widest">Signal Intelligence</h4>
          <div className="flex gap-1">
            <div className="w-1 h-1 bg-tactical-accent" />
            <div className="w-1 h-1 bg-tactical-accent animate-pulse" />
          </div>
        </div>
        
        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
          {reports.length === 0 ? (
            <div className="text-[9px] text-gray-600 italic font-mono">Scanning for signals...</div>
          ) : (
            reports.map((item, i) => (
              <motion.div 
                key={item.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="group pointer-events-auto cursor-help"
              >
                <div className="flex gap-3">
                  <div className="mt-1">
                    {item.threat_level >= 8 ? <ShieldAlert className="w-3 h-3 text-tactical-danger" /> : 
                     item.threat_level >= 5 ? <AlertTriangle className="w-3 h-3 text-tactical-warning" /> :
                     <Info className="w-3 h-3 text-tactical-accent" />}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-mono text-gray-500">
                        {item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : 'RECENT'} | {item.state || 'GLOBAL'}
                      </span>
                    </div>
                    <p className={cn(
                      "text-[10px] font-mono leading-tight",
                      item.threat_level >= 8 ? "text-tactical-danger" : 
                      item.threat_level >= 5 ? "text-tactical-warning" : "text-gray-300"
                    )}>
                      {item.content}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
        
        <button className="w-full mt-4 py-2 border border-tactical-border text-[9px] font-mono uppercase text-gray-500 hover:text-tactical-accent hover:border-tactical-accent transition-colors pointer-events-auto">
          View Full Archive
        </button>
      </div>
    </div>
  );
}
