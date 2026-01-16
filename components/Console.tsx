import React, { useEffect, useRef } from 'react';
import { LogEntry } from '../types';

interface ConsoleProps {
  logs: LogEntry[];
  onClear: () => void;
  isOpen: boolean;
}

const Console: React.FC<ConsoleProps> = ({ logs, onClear, isOpen }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current && isOpen) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-[#0d1117]/98 backdrop-blur-xl border-t border-[#30363d] h-72 flex flex-col z-40 animate-in slide-in-from-bottom duration-300">
      
      {/* Header Bar - Cleaner & More Visible */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#161b22] border-b border-[#30363d]">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
          </div>
          <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] ml-1">
            Terminal_Output
          </span>
        </div>
        
        <button 
          onClick={onClear}
          className="text-[10px] font-bold text-gray-400 hover:text-red-400 active:scale-90 transition-all uppercase px-2 py-1 rounded hover:bg-white/5"
        >
          Clear
        </button>
      </div>

      {/* Log Display - Font set to 12px for better readability */}
      <div 
        ref={scrollRef} 
        className="flex-1 overflow-y-auto p-3 font-mono text-[12px] leading-relaxed selection:bg-blue-600/40"
      >
        {logs.length === 0 ? (
          <div className="flex items-center gap-3 text-gray-700 italic p-1">
            <span className="animate-pulse">_</span>
            <span>Waiting for process output...</span>
          </div>
        ) : (
          <div className="space-y-1">
            {logs.map((log) => (
              <div key={log.id} className="group flex gap-4 items-start py-0.5 px-1 hover:bg-white/[0.02] rounded-sm transition-colors duration-75">
                {/* Timestamp - Tabular nums for perfect alignment */}
                <span className="text-gray-600/50 shrink-0 select-none tabular-nums font-medium">
                  {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>

                {/* Log Content */}
                <div className="flex gap-2 flex-1 min-w-0">
                  <span className={`shrink-0 font-bold ${
                    log.type === 'error' ? 'text-red-500' :
                    log.type === 'ai' ? 'text-blue-400' :
                    log.type === 'warn' ? 'text-yellow-500' : 'text-green-500'
                  }`}>
                    {log.type === 'error' ? '×' : 
                     log.type === 'ai' ? '✦' : 
                     log.type === 'warn' ? '!' : '❯'}
                  </span>
                  
                  <span className={`break-words whitespace-pre-wrap flex-1 ${
                    log.type === 'error' ? 'text-red-300' :
                    log.type === 'ai' ? 'text-blue-100 font-medium' :
                    log.type === 'warn' ? 'text-yellow-200' : 'text-gray-300'
                  }`}>
                    {log.message}
                  </span>
                </div>
              </div>
            ))}
            
            {/* Console Cursor - Adjusted for 12px font */}
            <div className="flex gap-4 py-2 px-1">
               <span className="w-[64px] shrink-0"></span> {/* Spacer sinkron dengan lebar timestamp */}
               <div className="w-2 h-4 bg-blue-500/40 animate-pulse rounded-sm" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Console;
