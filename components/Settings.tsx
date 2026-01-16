import React, { useState, useEffect } from 'react';
import { Theme } from '../types';
import { testGeminiConnection } from '../services/geminiService';

interface SettingsProps {
  theme: Theme;
  onClose: () => void;
}

const Settings: React.FC<SettingsProps> = ({ theme, onClose }) => {
  const isDark = theme === 'dark';
  const [apiKey, setApiKey] = useState('');
  const [saveStatus, setSaveStatus] = useState(false);
  const [testStatus, setTestStatus] = useState<{msg: string, color: string} | null>(null);

  useEffect(() => {
    const savedKey = localStorage.getItem('DS_AI_API_KEY');
    if (savedKey) setApiKey(savedKey);
  }, []);

  const handleSave = () => {
    localStorage.setItem('DS_AI_API_KEY', apiKey);
    (window as any).GEMINI_API_KEY = apiKey;
    setSaveStatus(true);
    setTimeout(() => setSaveStatus(false), 2000);
  };

  const runTest = async () => {
    if (!apiKey) {
      setTestStatus({ msg: "❌ Masukkan API Key dulu!", color: "text-red-500" });
      return;
    }
    setTestStatus({ msg: "⏳ Menghubungi Google AI Server...", color: "text-blue-400" });
    
    const result = await testGeminiConnection(apiKey);
    
    if (result.success) {
      setTestStatus({ msg: "✅ " + result.message, color: "text-green-500" });
    } else {
      // Menampilkan pesan error detail dari Google
      setTestStatus({ 
        msg: `❌ FAILED: ${result.message}`, 
        color: "text-red-500" 
      });
    }
  };

  return (
    <div className={`w-full h-full p-6 overflow-y-auto ${isDark ? 'bg-[#0d1117] text-gray-200' : 'bg-slate-50 text-slate-900'}`}>
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold tracking-tight">DS-AI Config</h2>
          <button onClick={onClose} className="p-2 hover:bg-red-500/10 rounded-full text-red-500">✕</button>
        </div>

        <div className="space-y-6">
          {/* Model Info */}
          <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
            <h4 className="text-[10px] font-bold text-green-500 uppercase mb-1">Active Engine</h4>
            <p className="text-sm font-mono text-green-400">gemini-3-flash-preview</p>
          </div>

          {/* API Key Input */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase opacity-60">Master API Key</h3>
            <input 
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Paste AI Studio API Key..."
              className={`w-full p-3 rounded-lg border font-mono text-sm outline-none transition-all ${
                isDark ? 'bg-[#161b22] border-[#30363d] focus:border-blue-500' : 'bg-white border-slate-300'
              }`}
            />
            
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={handleSave}
                className="py-3 rounded-lg font-bold bg-[#238636] hover:bg-[#2ea043] text-white text-xs transition-all"
              >
                {saveStatus ? '✅ SAVED' : 'SAVE KEY'}
              </button>
              <button 
                onClick={runTest}
                className="py-3 rounded-lg font-bold border border-blue-500 text-blue-500 text-xs hover:bg-blue-500/10 transition-all"
              >
                DEBUG TEST
              </button>
            </div>

            {testStatus && (
              <div className={`p-3 rounded bg-black/40 text-[10px] font-mono leading-relaxed break-words border border-[#30363d] ${testStatus.color}`}>
                {testStatus.msg}
              </div>
            )}
          </div>

          <div className="pt-6 border-t border-[#30363d]">
            <p className="text-[10px] text-center opacity-30">
              DS-AI WEB IDE • VERSION 3.0.0-PREVIEW
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;