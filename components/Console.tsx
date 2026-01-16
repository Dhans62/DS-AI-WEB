import React, { useEffect, useRef } from 'react';
import { LogEntry } from '../types';

interface ConsoleProps {
  logs: LogEntry[];
  onClear: () => void;
  isOpen: boolean;
}

const Console: React.FC<ConsoleProps> = ({ logs, onClear, isOpen }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Otomatis scroll ke paling bawah setiap ada log baru
  useEffect(() => {
    if (scrollRef.current && isOpen) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-[#0d1117]/95 backdrop-blur-md border-t border-[#30363d] h-60 flex flex-col z-40 animate-in slide-in-from-bottom duration-300">
      
      {/* Header Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#161b22] border-b border-[#30363d]">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
          </div>
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
            System Console
          </span>
        </div>
        
        <button 
          onClick={onClear}
          className="text-[10px] font-bold text-gray-500 hover:text-red-400 transition-colors uppercase tracking-tighter"
        >
          Clear Buffer
        </button>
      </div>

      {/* Log Display */}
      <div 
        ref={scrollRef} 
        className="flex-1 overflow-y-auto p-4 font-mono text-[11px] leading-relaxed selection:bg-blue-500/30"
      >
        {logs.length === 0 ? (
          <div className="flex items-center gap-2 text-gray-600 italic">
            <span className="animate-pulse">_</span>
            <span>No process output recorded...</span>
          </div>
        ) : (
          <div className="space-y-1.5">
            {logs.map((log) => (
              <div key={log.id} className="group flex gap-3 items-start animate-in fade-in slide-in-from-left-2 duration-200">
                {/* Timestamp */}
                <span className="text-gray-600 shrink-0 select-none">
                  {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>

                {/* Status Indicator & Message */}
                <div className="flex gap-2">
                  <span className={`shrink-0 font-bold ${
                    log.type === 'error' ? 'text-red-500' :
                    log.type === 'ai' ? 'text-blue-400' :
                    log.type === 'warn' ? 'text-yellow-500' : 'text-green-500'
                  }`}>
                    {log.type === 'error' ? '✖' : 
                     log.type === 'ai' ? '✦' : 
                     log.type === 'warn' ? '⚠' : '❯'}
                  </span>
                  
                  <span className={`break-all ${
                    log.type === 'error' ? 'text-red-300' :
                    log.type === 'ai' ? 'text-blue-200 font-medium' :
                    log.type === 'warn' ? 'text-yellow-200' : 'text-gray-300'
                  }`}>
                    {log.message}
                  </span>
                </div>
              </div>
            ))}
            {/* Blinking Cursor at the end */}
            <div className="w-2 h-4 bg-gray-600 animate-pulse inline-block ml-11 mt-2" />
          </div>
        )}
      </div>
    </div>
  );
};

export default Console;
