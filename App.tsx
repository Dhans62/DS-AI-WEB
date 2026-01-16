import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Project, FileNode, Message, Theme, ActivePanel } from './types';
import Sidebar from './components/Sidebar';
import Editor from './components/Editor';
import ChatPanel from './components/ChatPanel';
import Settings from './components/Settings';
import { chatWithAgent } from './services/geminiService';
import { scanDirectory, readNativeFile, writeNativeFile, deleteNativeNode } from './services/fsService';

// NATIVE APK TOOLS
import { Preferences } from '@capacitor/preferences';

export default function App(): React.JSX.Element {
  const [theme, setTheme] = useState<Theme>('dark');
  const [activePanel, setActivePanel] = useState<ActivePanel>('editor');
  
  // States Utama
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState('root');
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [activeFileContent, setActiveFileContent] = useState<string>("");
  
  // AI Processing States
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeThought, setActiveThought] = useState<string>("");
  const [pendingToolCall, setPendingToolCall] = useState<{name: string, args: any, resolve: (val: any) => void} | null>(null);

  // 1. INITIAL LOAD: Ambil tema & proyek
  useEffect(() => {
    const init = async () => {
      const { value: t } = await Preferences.get({ key: 'ds-ai-theme' });
      if (t) setTheme(t as Theme);
      
      // Sync File System Native ke UI
      const tree = await scanDirectory('root');
      setProjects([{ id: 'root', name: 'Main Workspace', createdAt: Date.now(), root: { name: 'root', path: 'root', type: 'folder', children: tree } }]);
    };
    init();
  }, []);

  // 2. ISOLATED CHAT MEMORY: Load chat setiap kali ganti proyek
  useEffect(() => {
    const loadMessages = async () => {
      const { value } = await Preferences.get({ key: `chat_log_${activeProjectId}` });
      setMessages(value ? JSON.parse(value) : []);
    };
    loadMessages();
  }, [activeProjectId]);

  // 3. FILE SYNC: Ambil isi file saat diklik di sidebar
  useEffect(() => {
    if (activeFilePath) {
      readNativeFile(activeFilePath).then(setActiveFileContent);
    }
  }, [activeFilePath]);

  // Handler: Update Konten File
  const handleEditorChange = useCallback(async (content: string) => {
    if (activeFilePath) {
      setActiveFileContent(content);
      await writeNativeFile(activeFilePath, content);
    }
  }, [activeFilePath]);

  // AI TOOL EXECUTION (Modul A Integration)
  const executeTool = async (name: string, args: any) => {
    switch (name) {
      case 'writeFile':
        await writeNativeFile(args.path, args.content);
        return `Success: File ${args.path} updated.`;
      case 'readFile':
        const content = await readNativeFile(args.path);
        return content;
      case 'deleteFile':
        await deleteNativeNode(args.path);
        return `Success: ${args.path} deleted.`;
      default: return "Error: Tool not found.";
    }
  };

  const handleToolCall = async (name: string, args: any) => {
    // Read & List tidak butuh izin (Read-only)
    if (name === 'readFile' || name === 'listDirectory') return await executeTool(name, args);
    // Write & Delete butuh izin
    return new Promise((resolve) => {
      setPendingToolCall({ name, args, resolve });
    });
  };

  // FUNGSI ARSITEK: Ringkasan Denah Proyek (Tree-Only)
  const getProjectDenah = (nodes: FileNode[], indent = ""): string => {
    return nodes.map(n => `${indent}${n.type === 'folder' ? '📁' : '📄'} ${n.name}`).join('\n');
  };

  const onSendMessage = async (text: string) => {
    const { value: userApiKey } = await Preferences.get({ key: 'gemini_api_key' });
    if (!userApiKey) {
        setActivePanel('settings');
        return alert("Input API Key di Settings.");
    }

    const userMsg: Message = { id: Date.now().toString(), projectId: activeProjectId, role: 'user', content: text, timestamp: Date.now() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setIsProcessing(true);

    try {
      // INJEKSI KONTEKS STRATEGIS
      const tree = await scanDirectory('root');
      const denah = getProjectDenah(tree);
      const systemPrompt = `Kamu DS-AI, IDE Agent Berintegritas. 
      DENAH PROYEK:\n${denah}\n
      FILE AKTIF: ${activeFilePath || 'None'}\n
      Tugas: Bantu user mengelola file secara strategis.`;

      const response = await chatWithAgent(updatedMessages, systemPrompt, handleToolCall, false, userApiKey);

      const aiMsg: Message = { 
        id: (Date.now() + 1).toString(), 
        projectId: activeProjectId,
        role: 'model', 
        content: response.text, 
        thought: response.thought,
        timestamp: Date.now() 
      };

      const finalMessages = [...updatedMessages, aiMsg];
      setMessages(finalMessages);
      await Preferences.set({ key: `chat_log_${activeProjectId}`, value: JSON.stringify(finalMessages) });
      
      if (response.thought) setActiveThought(response.thought);
    } catch (err: any) {
      alert("AI Error: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePermission = async (approved: boolean) => {
    if (!pendingToolCall) return;
    const { name, args, resolve } = pendingToolCall;
    setPendingToolCall(null);
    const result = approved ? await executeTool(name, args) : "Error: Denied by user.";
    resolve(result);
  };

  return (
    <div className={`fixed inset-0 flex flex-col overflow-hidden ${theme === 'dark' ? 'bg-[#0d1117] text-gray-200' : 'bg-slate-50'}`}>
      
      {/* SECURITY MODAL */}
      {pendingToolCall && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-sm bg-[#161b22] border border-yellow-500/30 rounded-3xl p-8 shadow-2xl">
            <h3 className="font-black text-xl mb-4 text-yellow-500">🛡️ PERMISSION</h3>
            <p className="text-sm opacity-80 mb-6 leading-relaxed">AI meminta izin eksekusi: <span className="text-blue-400 font-mono font-bold">{pendingToolCall.name}</span> pada path <span className="text-white italic">{pendingToolCall.args.path}</span></p>
            <div className="flex gap-4">
              <button onClick={() => handlePermission(false)} className="flex-1 py-4 rounded-2xl bg-white/5 font-bold">TOLAK</button>
              <button onClick={() => handlePermission(true)} className="flex-1 py-4 rounded-2xl bg-yellow-600 text-black font-black">IZINKAN</button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN VIEWPORT */}
      <div className="flex-1 flex overflow-hidden">
         {activePanel === 'explorer' && (
           <Sidebar 
             theme={theme} projects={projects} setProjects={setProjects} 
             activeProjectId={activeProjectId} setActiveProjectId={setActiveProjectId} 
             activeFilePath={activeFilePath} setActiveFilePath={setActiveFilePath} 
             onDownload={() => {}} 
           />
         )}
         
         <div className={`flex-1 ${activePanel === 'editor' ? 'flex' : 'hidden'}`}>
            <Editor 
              theme={theme} 
              file={activeFilePath ? { path: activeFilePath, content: activeFileContent } : null} 
              onChange={handleEditorChange} 
            />
         </div>

         <div className={`flex-1 ${activePanel === 'chat' ? 'flex' : 'hidden'}`}>
            <ChatPanel 
              theme={theme} messages={messages} 
              onSendMessage={onSendMessage} isProcessing={isProcessing} 
              activeThought={activeThought}
            />
         </div>

         {activePanel === 'settings' && <Settings theme={theme} onClose={() => setActivePanel('editor')} />}
      </div>

      {/* NAVIGATION BAR */}
      <div className="h-20 flex border-t border-[#30363d] bg-[#0d1117] px-4 pb-safe">
        <NavButton icon="📁" label="Files" active={activePanel === 'explorer'} onClick={() => setActivePanel('explorer')} />
        <NavButton icon="📝" label="Code" active={activePanel === 'editor'} onClick={() => setActivePanel('editor')} />
        <NavButton icon="💬" label="AI" active={activePanel === 'chat'} onClick={() => setActivePanel('chat')} />
        <NavButton icon="⚙️" label="Config" active={activePanel === 'settings'} onClick={() => setActivePanel('settings')} />
      </div>
    </div>
  );
}

function NavButton({ icon, label, active, onClick }: { icon: string, label: string, active: boolean, onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center flex-1 gap-1 transition-all ${active ? 'text-blue-400 scale-110' : 'text-gray-500 opacity-50'}`}>
      <span className="text-xl">{icon}</span>
      <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
      {active && <div className="w-1 h-1 rounded-full bg-blue-400 mt-1 shadow-[0_0_8px_#60a5fa]" />}
    </button>
  );
}