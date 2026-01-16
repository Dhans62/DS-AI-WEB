
import React from 'react';
import { FileNode, Theme } from '../types';

interface EditorProps {
  theme: Theme;
  file: FileNode | null;
  onChange: (content: string) => void;
}

const Editor: React.FC<EditorProps> = ({ theme, file, onChange }) => {
  const isDark = theme === 'dark';
  
  if (!file) {
    return (
      <div className={`w-full h-full flex flex-col items-center justify-center text-center p-6 ${isDark ? 'bg-slate-950' : 'bg-white'}`}>
        <div className="text-6xl mb-6 opacity-20">📝</div>
        <h3 className="text-sm font-bold uppercase tracking-widest opacity-40">Ready to Code</h3>
        <p className="text-[11px] opacity-30 mt-2 max-w-[200px]">Select a file from the explorer to begin development.</p>
      </div>
    );
  }

  return (
    <div className={`w-full h-full flex font-mono text-sm overflow-hidden ${isDark ? 'bg-slate-950 text-blue-50' : 'bg-white text-slate-900'}`}>
      <div className={`w-12 text-right pr-3 pt-6 select-none opacity-20 border-r shrink-0 overflow-hidden ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
        {file.content?.split('\n').map((_, i) => <div key={i} className="h-6 leading-6">{i + 1}</div>)}
      </div>
      <textarea
        className="flex-1 bg-transparent p-6 pt-6 outline-none resize-none leading-6 caret-blue-500 whitespace-pre overflow-auto min-h-full"
        value={file.content || ''}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        autoCapitalize="none"
        autoCorrect="off"
      />
    </div>
  );
};

export default Editor;
