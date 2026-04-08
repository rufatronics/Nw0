import React from 'react';
import { 
  Shield, 
  Map as MapIcon, 
  Radio, 
  Users, 
  Settings, 
  Activity,
  ChevronRight,
  Database,
  Eye
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { motion } from 'motion/react';

const MENU_ITEMS = [
  { id: 'map', icon: MapIcon, label: 'Regional Map', active: true },
  { id: 'intel', icon: Eye, label: 'State Analysis' },
  { id: 'assets', icon: Users, label: 'Field Assets' },
  { id: 'comms', icon: Radio, label: 'Comms Center' },
  { id: 'database', icon: Database, label: 'OSINT Archive' },
  { id: 'system', icon: Settings, label: 'System Config' },
];

export default function Sidebar() {
  return (
    <div className="w-64 h-full bg-tactical-panel border-r border-tactical-border flex flex-col z-30">
      {/* Logo Area */}
      <div className="p-6 border-b border-tactical-border flex items-center gap-3">
        <div className="w-8 h-8 bg-tactical-accent/20 border border-tactical-accent flex items-center justify-center">
          <Shield className="w-5 h-5 text-tactical-accent" />
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-tighter text-white uppercase">Northwatch</h1>
          <p className="text-[10px] font-mono text-tactical-accent/60 uppercase">Northern Nigeria Command</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4">
        {MENU_ITEMS.map((item) => (
          <button
            key={item.id}
            className={cn(
              "w-full px-6 py-3 flex items-center gap-4 transition-all group relative",
              item.active 
                ? "text-tactical-accent bg-tactical-accent/5" 
                : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
            )}
          >
            {item.active && (
              <motion.div 
                layoutId="activeTab"
                className="absolute left-0 top-0 bottom-0 w-1 bg-tactical-accent"
              />
            )}
            <item.icon className={cn("w-5 h-5", item.active ? "text-tactical-accent" : "group-hover:text-gray-300")} />
            <span className="text-xs font-mono uppercase tracking-widest">{item.label}</span>
            {item.active && <ChevronRight className="w-4 h-4 ml-auto opacity-50" />}
          </button>
        ))}
      </nav>

      {/* System Status */}
      <div className="p-6 border-t border-tactical-border bg-black/20">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-3 h-3 text-tactical-accent animate-pulse" />
          <span className="text-[10px] font-mono uppercase tracking-tighter text-tactical-accent">Network: Stable</span>
        </div>
        <div className="space-y-2">
          <div className="h-1 w-full bg-tactical-border rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: '75%' }}
              className="h-full bg-tactical-accent"
            />
          </div>
          <div className="flex justify-between text-[8px] font-mono text-gray-500 uppercase">
            <span>CPU LOAD</span>
            <span>75%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
