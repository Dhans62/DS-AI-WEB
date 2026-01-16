import React, { useState, useRef, useEffect } from 'react';
import { Message, Theme } from '../types';
import { Send, Bot, User, Sparkles, BrainCircuit, ChevronDown, ChevronUp, Image as ImageIcon, X } from 'lucide-react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

interface ChatPanelProps {
  theme: Theme;
  messages: Message[];
  onSendMessage: (text: string, imageData?: { data: string; mimeType: string }) => void;
  isProcessing: boolean;
  activeThought?: string;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ theme, messages, onSendMessage, isProcessing, activeThought }) => {
  const [input, setInput] = useState('');
  const [showThought, setShowThought] = useState(true);
  const [selectedImage, setSelectedImage] = useState<{ data: string; mimeType: string } | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isDark = theme === 'dark';

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isProcessing, activeThought]);

  const handlePickImage = async () => {
    try {
      const image = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Photos
      });

      if (image.base64String) {
        setSelectedImage({
          data: image.base64String,
          mimeType: `image/${image.format}`
        });
        setImagePreview(`data:image/${image.format};base64,${image.base64String}`);
      }
    } catch (error) {
      console.log('User cancelled image picking');
    }
  };

  const clearImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((input.trim() || selectedImage) && !isProcessing) {
      onSendMessage(input.trim(), selectedImage || undefined);
      setInput('');
      clearImage();
    }
  };

  return (
    <div className={`flex flex-col h-full ${isDark ? 'bg-[#0d1117]' : 'bg-white'}`}>
      {/* Header */}
      <div className={`px-4 py-3 border-b flex items-center justify-between ${isDark ? 'border-[#30363d]' : 'border-slate-200'}`}>
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-500" />
          <span className="text-[10px] font-black uppercase tracking-widest text-blue-500">DS-AI Agent Core</span>
        </div>
      </div>

      {/* Messages Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'model' && (
              <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center shrink-0 shadow-lg shadow-blue-900/40 mt-1">
                <Bot className="w-3.5 h-3.5 text-white" />
              </div>
            )}
            
            <div className="max-w-[90%] space-y-1">
              <div className={`p-3 rounded-2xl text-[12.5px] leading-relaxed ${
                msg.role === 'user' 
                ? 'bg-blue-600 text-white rounded-tr-none shadow-md' 
                : (isDark ? 'bg-[#161b22] text-gray-300 border border-[#30363d]' : 'bg-slate-100 text-slate-800')
              }`}>
                <div className="whitespace-pre-wrap break-words">
                  {typeof msg.content === 'string' ? msg.content : 'File Action Performed'}
                </div>
              </div>
            </div>

            {msg.role === 'user' && (
              <div className="w-6 h-6 rounded bg-gray-700 flex items-center justify-center shrink-0 mt-1">
                <User className="w-3.5 h-3.5 text-white" />
              </div>
            )}
          </div>
        ))}

        {/* Thinking State */}
        {isProcessing && (
          <div className="flex gap-2 justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="w-6 h-6 rounded bg-[#238636] flex items-center justify-center shrink-0">
              <BrainCircuit className="w-3.5 h-3.5 text-white animate-pulse" />
            </div>
            <div className="max-w-[90%] w-full">
              <div className={`rounded-xl border ${isDark ? 'bg-[#0d1117] border-[#30363d]' : 'bg-gray-50 border-gray-200'} overflow-hidden shadow-sm`}>
                <div 
                  onClick={() => setShowThought(!showThought)}
                  className="px-3 py-1.5 flex items-center justify-between cursor-pointer bg-black/5 hover:bg-black/10 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex gap-0.5">
                      <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce"></span>
                      <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                      <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                    </span>
                    <span className="text-[9px] font-bold text-blue-500 uppercase tracking-widest">DS-AI Analysing</span>
                  </div>
                  {showThought ? <ChevronDown className="w-3 h-3 opacity-50" /> : <ChevronUp className="w-3 h-3 opacity-50" />}
                </div>
                {showThought && (
                  <div className="p-3 text-[10px] font-mono leading-relaxed text-gray-500 italic border-t border-[#30363d]/30 max-h-32 overflow-y-auto bg-black/5">
                    {activeThought || "Menganalisis permintaan koding lu..."}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className={`border-t ${isDark ? 'border-[#30363d] bg-[#0d1117]' : 'border-slate-200'} p-3 pb-safe`}>
        {imagePreview && (
          <div className="mb-2 relative inline-block">
            <img src={imagePreview} alt="upload" className="w-16 h-16 object-cover rounded-lg border-2 border-blue-500 shadow-md" />
            <button 
              onClick={clearImage}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg border border-white"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="relative flex items-end gap-2">
          <button
            type="button"
            onClick={handlePickImage}
            className={`p-2 rounded-xl border ${isDark ? 'bg-[#161b22] border-[#30363d] text-gray-400' : 'bg-slate-50 border-gray-200'} hover:text-blue-500 active:scale-95 transition-all`}
          >
            <ImageIcon className="w-5 h-5" />
          </button>
          
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } }}
            placeholder="Ketik atau screenshot..."
            className={`flex-1 p-2.5 rounded-xl text-[13px] outline-none transition-all resize-none max-h-28 ${
              isDark ? 'bg-[#161b22] border-[#30363d] text-white focus:border-blue-500' : 'bg-slate-50 border-gray-200'
            } border`}
            rows={1}
          />
          <button
            type="submit"
            disabled={isProcessing || (!input.trim() && !selectedImage)}
            className={`p-2.5 rounded-xl bg-blue-600 text-white disabled:opacity-30 disabled:grayscale active:scale-95 transition-all shadow-lg shadow-blue-900/20`}
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatPanel;