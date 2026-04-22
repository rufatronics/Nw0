import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Minimize2, Maximize2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import tacticalStaticData from '../data/tactical_db.json';
import Markdown from 'react-markdown';
import { cn } from '@/src/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface Message {
  role: 'user' | 'model';
  content: string;
}

export default function TacticalChat() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', content: 'Tactical Analyst online. Awaiting signal intelligence or field reports.' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('super-endpoint', {
        body: { messages, userMessage }
      });

      if (error) throw error;

      setMessages(prev => [...prev, { role: 'model', content: data.text || 'No response received.' }]);
    } catch (error) {
      console.warn('Network error or 404. Falling back to local intelligence manual.');
      
      // Local fallback logic: match keywords in the static database
      const lowerInput = userMessage.toLowerCase();
      const fallbackMatch = tacticalStaticData.fallback_chat_responses.find(item => 
        item.keywords.some(kw => lowerInput.includes(kw.toLowerCase()))
      );

      const fallbackContent = fallbackMatch 
        ? `[LOCAL_INTEL_CACHE] ${fallbackMatch.response}`
        : "[LOCAL_INTEL_CACHE] No specific intelligence found for your query in the current offline manual. Try keywords like 'Borno', 'Highway', or 'Status'.";

      setMessages(prev => [...prev, { role: 'model', content: fallbackContent }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn(
      "fixed bottom-4 right-4 z-[2000] flex flex-col transition-all duration-300",
      isMinimized ? "w-64 h-12" : "w-96 h-[500px]"
    )}>
      {/* Header */}
      <div className="bg-tactical-panel border border-tactical-border p-3 flex items-center justify-between cursor-pointer" onClick={() => isMinimized && setIsMinimized(false)}>
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-tactical-accent" />
          <span className="text-xs font-mono uppercase tracking-widest text-tactical-accent">Tactical Comms</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }} className="text-gray-500 hover:text-white">
            {isMinimized ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {!isMinimized && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="flex-1 bg-tactical-panel/90 backdrop-blur-xl border-x border-b border-tactical-border flex flex-col overflow-hidden"
          >
            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-[11px]">
              {messages.map((msg, i) => (
                <div key={i} className={cn(
                  "flex gap-3",
                  msg.role === 'user' ? "flex-row-reverse" : "flex-row"
                )}>
                  <div className={cn(
                    "w-6 h-6 flex items-center justify-center border",
                    msg.role === 'user' ? "bg-tactical-border border-gray-500" : "bg-tactical-accent/10 border-tactical-accent"
                  )}>
                    {msg.role === 'user' ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3 text-tactical-accent" />}
                  </div>
                  <div className={cn(
                    "max-w-[80%] p-3 border",
                    msg.role === 'user' ? "bg-white/5 border-tactical-border text-gray-300" : "bg-tactical-accent/5 border-tactical-accent/20 text-tactical-accent"
                  )}>
                    <div className="markdown-body">
                      <Markdown>{msg.content}</Markdown>
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3">
                  <div className="w-6 h-6 flex items-center justify-center border bg-tactical-accent/10 border-tactical-accent">
                    <Loader2 className="w-3 h-3 text-tactical-accent animate-spin" />
                  </div>
                  <div className="p-3 border bg-tactical-accent/5 border-tactical-accent/20 text-tactical-accent italic">
                    Analyzing signal...
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-4 border-t border-tactical-border bg-black/40">
              <div className="relative">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="ENTER COMMAND OR REPORT..."
                  className="w-full bg-tactical-bg border border-tactical-border p-3 pr-10 text-[10px] font-mono text-tactical-accent focus:outline-none focus:border-tactical-accent transition-colors placeholder:text-gray-700"
                />
                <button 
                  onClick={handleSend}
                  disabled={isLoading}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-tactical-accent hover:text-white transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
