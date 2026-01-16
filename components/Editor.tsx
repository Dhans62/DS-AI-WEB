import React, { useState, useEffect, useRef } from 'react';
import './Editor.css';

interface EditorProps {
  theme: 'dark' | 'light';
  file: { path: string; content?: string } | null;
  onChange: (content: string) => void;
  isConsoleOpen: boolean;
  toggleConsole: () => void;
  hasNewLogs?: boolean;
}

const Editor: React.FC<EditorProps> = ({ file, onChange, isConsoleOpen, toggleConsole, hasNewLogs }) => {
  const [code, setCode] = useState(file?.content || '');
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (file) {
      setCode(file.content || '');
    }
  }, [file]);

  const highlightCode = (input: string) => {
    return input
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/\b(const|let|var|function|return|if|else|for|while|import|export|class|async|await)\b/g, '<span class="token-keyword">$1</span>')
      .replace(/\b(\w+)(?=\()/g, '<span class="token-function">$1</span>')
      .replace(/(".*?"|'.*?'|`.*?`)/g, '<span class="token-string">$1</span>')
      .replace(/(\/\/.*)/g, '<span class="token-comment">$1</span>');
  };

  const handleScroll = () => {
    if (textareaRef.current && highlightRef.current && lineNumbersRef.current) {
      const scrollTop = textareaRef.current.scrollTop;
      const scrollLeft = textareaRef.current.scrollLeft;
      
      highlightRef.current.scrollTop = scrollTop;
      highlightRef.current.scrollLeft = scrollLeft;
      lineNumbersRef.current.scrollTop = scrollTop;
    }
  };

  const lineCount = code.split('\n').length;

  if (!file) {
    return (
      <div className="editor-floating-canvas flex items-center justify-center opacity-20">
        <p className="font-mono text-sm uppercase tracking-widest">Select file to edit</p>
      </div>
    );
  }

  return (
    <div className="editor-floating-canvas relative flex flex-col h-full overflow-hidden">
      {/* HEADER INFO */}
      <div className="px-4 py-2 bg-[#161b22] border-b border-[#30363d] flex justify-between items-center">
        <span className="text-[10px] font-mono text-blue-400 truncate max-w-[70%]">{file.path}</span>
        <span className="text-[9px] font-bold opacity-50 uppercase">{lineCount} Lines</span>
      </div>

      <div className="flex-1 relative flex overflow-hidden bg-[#0d1117]">
        
        {/* 1. LINE NUMBERS (NEW) */}
        <div 
          ref={lineNumbersRef}
          className="w-12 bg-[#0d1117] border-r border-[#30363d] text-right pr-3 pt-4 font-mono text-[13px] text-gray-600 select-none overflow-hidden"
          style={{ lineHeight: '1.6' }}
        >
          {Array.from({ length: lineCount }).map((_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>

        {/* 2. EDITOR WORKSPACE */}
        <div className="flex-1 relative overflow-hidden">
          {/* Layer: Highlighting */}
          <div 
            ref={highlightRef}
            className="editor-highlight pointer-events-none absolute inset-0 p-4 font-mono text-[13px] whitespace-pre overflow-hidden"
            style={{ lineHeight: '1.6', zIndex: 1 }}
            dangerouslySetInnerHTML={{ __html: highlightCode(code) + "\n" }}
          />
          
          {/* Layer: Native Input (The Real Caret) */}
          <textarea
            ref={textareaRef}
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              onChange(e.target.value);
            }}
            onScroll={handleScroll}
            spellCheck={false}
            autoCapitalize="off"
            className="editor-input absolute inset-0 w-full h-full p-4 font-mono text-[13px] bg-transparent text-transparent caret-blue-500 outline-none resize-none whitespace-pre overflow-auto"
            style={{ 
              lineHeight: '1.6', 
              zIndex: 2,
              WebkitTextFillColor: 'transparent' // Penting agar teks asli gak tumpukan sama highlight
            }}
          />
        </div>
      </div>

      {/* TOMBOL FLOATING TERMINAL */}
      <button 
        onClick={toggleConsole}
        className={`fixed bottom-6 right-6 w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 z-[50] shadow-2xl active:scale-90 ${
          isConsoleOpen 
            ? 'bg-blue-600 text-white rotate-180' 
            : 'bg-[#161b22] border border-[#30363d] text-gray-400'
        }`}
      >
        {!isConsoleOpen && hasNewLogs && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-[#0d1117] animate-pulse" />
        )}
        <span className="text-xl font-mono">{isConsoleOpen ? '✕' : '❯_'}</span>
      </button>
    </div>
  );
};

export default Editor;
