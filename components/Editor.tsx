import React, { useState, useEffect, useRef } from 'react';
import './Editor.css';

interface EditorProps {
  theme: 'dark' | 'light';
  file: { path: string; content?: string } | null;
  onChange: (content: string) => void;
  // MODUL D: State Terminal
  isConsoleOpen: boolean;
  toggleConsole: () => void;
  hasNewLogs?: boolean;
}

const Editor: React.FC<EditorProps> = ({ file, onChange, isConsoleOpen, toggleConsole, hasNewLogs }) => {
  const [code, setCode] = useState(file?.content || '');
  const [caretCoords, setCaretCoords] = useState({ top: 0, left: 0, height: 0 });
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (file) {
      setCode(file.content || '');
      setTimeout(updateCaretPosition, 10);
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

  const updateCaretPosition = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const selectionStart = textarea.selectionStart;
    const textBeforeCaret = textarea.value.substring(0, selectionStart);
    
    const lines = textBeforeCaret.split('\n');
    const currentLineNumber = lines.length - 1;
    const currentLineText = lines[currentLineNumber];

    const lineHeight = 1.6 * 14; 
    const charWidth = 8.4; 

    setCaretCoords({
      top: currentLineNumber * lineHeight,
      left: currentLineText.length * charWidth,
      height: lineHeight
    });
  };

  const handleScroll = () => {
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  if (!file) {
    return (
      <div className="editor-floating-canvas flex items-center justify-center opacity-20">
        <p className="font-mono text-sm uppercase tracking-widest">Select file to edit</p>
      </div>
    );
  }

  return (
    <div className="editor-floating-canvas relative">
      <div className="editor-container">
        
        {/* Layer 1: Highlighting */}
        <div 
          ref={highlightRef}
          className="editor-highlight"
          dangerouslySetInnerHTML={{ __html: highlightCode(code) + "\n" }}
        />
        
        {/* Layer 2: Penanda Baris (Living Caret) */}
        <div 
          className="custom-caret"
          style={{ 
            top: `${caretCoords.top - (textareaRef.current?.scrollTop || 0)}px`, 
            left: `${caretCoords.left - (textareaRef.current?.scrollLeft || 0)}px`,
            height: `${caretCoords.height}px`
          }}
        />

        {/* Layer 3: Invisible Input */}
        <textarea
          ref={textareaRef}
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            onChange(e.target.value);
            updateCaretPosition();
          }}
          onScroll={handleScroll}
          onSelect={updateCaretPosition}
          onKeyUp={updateCaretPosition}
          className="editor-input"
          spellCheck={false}
          autoCapitalize="off"
        />
      </div>

      {/* TOMBOL FLOATING TERMINAL (MODUL D) */}
      <button 
        onClick={toggleConsole}
        className={`absolute bottom-6 right-6 w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 z-[50] shadow-2xl active:scale-90 ${
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
