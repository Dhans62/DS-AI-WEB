import React, { useState, useRef, useEffect } from 'react';
import { Message, Theme } from '../types';
import { Send, Bot, User, Sparkles, BrainCircuit, ChevronDown, ChevronUp } from 'lucide-react';

interface ChatPanelProps {
  theme: Theme;
  messages: Message[];
  onSendMessage: (text: string) => void;
  isProcessing: boolean;
  activeThought?: string; // Tambahkan ini di interface props App.tsx nanti
}

const ChatPanel: React.FC<ChatPanelProps> = ({ theme, messages, onSendMessage, isProcessing, activeThought }) => {
  const [input, setInput] = useState('');
  const [showThought, setShowThought] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isDark = theme === 'dark';

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isProcessing, activeThought]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isProcessing) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  return (
    <div className={`flex flex-col h-full ${isDark ? 'bg-[#0d1117]' : 'bg-white'}`}>
      {/* Header */}
      <div className={`p-4 border-b flex items-center justify-between ${isDark ? 'border-[#30363d]' : 'border-slate-200'}`}>
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-500" />
          <span className="text-[10px] font-black uppercase tracking-tighter text-blue-500">Gemini 3 Flash Agent</span>
        </div>
      </div>

      {/* Messages Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'model' && (
              <div className="w-7 h-7 rounded bg-blue-600 flex items-center justify-center shrink-0 shadow-lg shadow-blue-900/40">
                <Bot className="w-4 h-4 text-white" />
              </div>
            )}
            
            <div className="max-w-[88%] space-y-2">
              <div className={`p-3 rounded-2xl text-[13px] leading-relaxed ${
                msg.role === 'user' 
                ? 'bg-blue-600 text-white rounded-tr-none' 
                : (isDark ? 'bg-[#161b22] text-gray-300 border border-[#30363d]' : 'bg-slate-100 text-slate-800')
              }`}>
                <div className="whitespace-pre-wrap break-words">{typeof msg.content === 'string' ? msg.content : 'File Action Performed'}</div>
              </div>
            </div>

            {msg.role === 'user' && (
              <div className="w-7 h-7 rounded bg-gray-700 flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-white" />
              </div>
            )}
          </div>
        ))}

        {/* Real-time Thinking Animation & Content */}
        {isProcessing && (
          <div className="flex gap-3 justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="w-7 h-7 rounded bg-[#238636] flex items-center justify-center shrink-0">
              <BrainCircuit className="w-4 h-4 text-white animate-pulse" />
            </div>
            <div className="max-w-[88%] w-full">
              <div className={`rounded-xl border ${isDark ? 'bg-[#0d1117] border-[#30363d]' : 'bg-gray-50 border-gray-200'} overflow-hidden`}>
                <div 
                  onClick={() => setShowThought(!showThought)}
                  className="px-3 py-2 flex items-center justify-between cursor-pointer bg-black/10 hover:bg-black/20 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce"></span>
                      <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                      <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                    </div>
                    <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">DS-AI is Thinking</span>
                  </div>
                  {showThought ? <ChevronDown className="w-3 h-3 opacity-50" /> : <ChevronUp className="w-3 h-3 opacity-50" />}
                </div>
                
                {showThought && (
                  <div className="p-3 text-[11px] font-mono leading-relaxed text-gray-500 italic border-t border-[#30363d]/50 max-h-40 overflow-y-auto bg-black/5">
                    {activeThought || "Menganalisis permintaan koding lu..."}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <form onSubmit={handleSubmit} className={`p-3 border-t ${isDark ? 'border-[#30363d] bg-[#0d1117]' : 'border-slate-200'}`}>
        <div className="relative flex items-center gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } }}
            placeholder="Tanya koding..."
            className={`flex-1 p-2.5 rounded-xl text-sm outline-none transition-all resize-none max-h-32 ${
              isDark ? 'bg-[#161b22] border-[#30363d] text-white focus:border-blue-500' : 'bg-slate-50 border-gray-200'
            } border`}
            rows={1}
          />
          <button
            type="submit"
            disabled={isProcessing || !input.trim()}
            className={`p-2.5 rounded-xl bg-blue-600 text-white disabled:opacity-30 disabled:grayscale transition-all`}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChatPanel;
