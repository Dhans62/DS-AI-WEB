import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Project, FileNode, Message, Theme, ActivePanel, LogEntry } from './types';
import Sidebar from './components/Sidebar';
import Editor from './components/Editor';
import ChatPanel from './components/ChatPanel';
import Settings from './components/Settings';
import Console from './components/Console';
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
  
  // MODUL D: Terminal States
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [hasNewLogs, setHasNewLogs] = useState(false);

  // AI Processing States
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeThought, setActiveThought] = useState<string>("");
  const [pendingToolCall, setPendingToolCall] = useState<{name: string, args: any, resolve: (val: any) => void} | null>(null);

  // MODUL D: Logger Function
  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [...prev, {
      id: Date.now().toString(),
      message,
      type,
      timestamp: Date.now()
    }]);
    if (!isConsoleOpen) setHasNewLogs(true);
  }, [isConsoleOpen]);

  const clearLogs = () => {
    setLogs([]);
    setHasNewLogs(false);
  };

  // 1. INITIAL LOAD
  useEffect(() => {
    const init = async () => {
      const { value: t } = await Preferences.get({ key: 'ds-ai-theme' });
      if (t) setTheme(t as Theme);
      
      const tree = await scanDirectory('root');
      setProjects([{ id: 'root', name: 'Main Workspace', createdAt: Date.now(), root: { name: 'root', path: 'root', type: 'folder', children: tree } }]);
      addLog("System initialized. Native FS Active.", "info");
    };
    init();
  }, []);

  // 2. ISOLATED CHAT MEMORY
  useEffect(() => {
    const loadMessages = async () => {
      const { value } = await Preferences.get({ key: `chat_log_${activeProjectId}` });
      setMessages(value ? JSON.parse(value) : []);
    };
    loadMessages();
  }, [activeProjectId]);

  // 3. FILE SYNC
  useEffect(() => {
    if (activeFilePath) {
      readNativeFile(activeFilePath).then(setActiveFileContent);
    }
  }, [activeFilePath]);

  const handleEditorChange = useCallback(async (content: string) => {
    if (activeFilePath) {
      setActiveFileContent(content);
      await writeNativeFile(activeFilePath, content);
    }
  }, [activeFilePath]);

  const executeTool = async (name: string, args: any) => {
    addLog(`Running ${name}...`, 'ai');
    try {
      switch (name) {
        case 'writeFile':
          await writeNativeFile(args.path, args.content);
          addLog(`Success write: ${args.path}`, 'info');
          return `Success: File ${args.path} updated.`;
        case 'readFile':
          const content = await readNativeFile(args.path);
          addLog(`Success read: ${args.path}`, 'info');
          return content;
        case 'deleteFile':
          await deleteNativeNode(args.path);
          addLog(`Deleted: ${args.path}`, 'warn');
          return `Success: ${args.path} deleted.`;
        default: 
          addLog(`Unknown tool: ${name}`, 'error');
          return "Error: Tool not found.";
      }
    } catch (e: any) {
      addLog(`Tool Error: ${e.message}`, 'error');
      setIsConsoleOpen(true);
      return `Error: ${e.message}`;
    }
  };

  const handleToolCall = async (name: string, args: any) => {
    if (name === 'readFile' || name === 'listDirectory') return await executeTool(name, args);
    return new Promise((resolve) => {
      setPendingToolCall({ name, args, resolve });
    });
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
    addLog(`User message sent.`, 'info');

    try {
      const tree = await scanDirectory('root');
      const systemPrompt = `Kamu DS-AI, IDE Agent Berintegritas. Tugas: Bantu user mengelola file secara strategis.`;
      const response = await chatWithAgent(updatedMessages, systemPrompt, handleToolCall, false, userApiKey);
      const aiMsg: Message = { id: (Date.now() + 1).toString(), projectId: activeProjectId, role: 'model', content: response.text, thought: response.thought, timestamp: Date.now() };
      const finalMessages = [...updatedMessages, aiMsg];
      setMessages(finalMessages);
      await Preferences.set({ key: `chat_log_${activeProjectId}`, value: JSON.stringify(finalMessages) });
    } catch (err: any) {
      addLog(`AI Error: ${err.message}`, 'error');
      setIsConsoleOpen(true);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePermission = async (approved: boolean) => {
    if (!pendingToolCall) return;
    const { name, args, resolve } = pendingToolCall;
    setPendingToolCall(null);
    if (!approved) addLog(`Denied: ${name}`, 'warn');
    const result = approved ? await executeTool(name, args) : "Error: Denied by user.";
    resolve(result);
  };

  return (
    // Tambah pt-[env(safe-area-inset-top)] agar tidak tertutup Status Bar HP
    <div className={`fixed inset-0 flex flex-col overflow-hidden pt-[var(--safe-area-top,20px)] ${theme === 'dark' ? 'bg-[#0d1117] text-gray-200' : 'bg-slate-50'}`}>
      
      {/* SECURITY MODAL */}
      {pendingToolCall && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-sm bg-[#161b22] border border-yellow-500/30 rounded-3xl p-8 shadow-2xl">
            <h3 className="font-black text-xl mb-4 text-yellow-500 text-center">🛡️ PERMISSION</h3>
            <p className="text-sm opacity-80 mb-6 text-center">AI meminta izin: <span className="text-blue-400 font-mono underline">{pendingToolCall.name}</span></p>
            <div className="flex gap-4">
              <button onClick={() => handlePermission(false)} className="flex-1 py-4 rounded-2xl bg-white/5 font-bold">TOLAK</button>
              <button onClick={() => handlePermission(true)} className="flex-1 py-4 rounded-2xl bg-yellow-600 text-black font-black">IZINKAN</button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN VIEWPORT */}
      <div className="flex-1 flex overflow-hidden relative">
         {activePanel === 'explorer' && (
           <Sidebar 
             theme={theme} projects={projects} setProjects={setProjects} 
             activeProjectId={activeProjectId} setActiveProjectId={setActiveProjectId} 
             activeFilePath={activeFilePath} setActiveFilePath={setActiveFilePath} 
             onDownload={() => {}} 
           />
         )}
         
         {/* EDITOR & CONSOLE LAYER */}
         <div className={`flex-1 relative ${activePanel === 'editor' ? 'block' : 'hidden'}`}>
            <Editor 
              theme={theme} 
              file={activeFilePath ? { path: activeFilePath, content: activeFileContent } : null} 
              onChange={handleEditorChange} 
              isConsoleOpen={isConsoleOpen}
              toggleConsole={() => {
                setIsConsoleOpen(!isConsoleOpen);
                setHasNewLogs(false);
              }}
              hasNewLogs={hasNewLogs}
            />
            {/* Console harus di dalam container yang sama dengan Editor & punya Z-index tinggi */}
            <Console 
              logs={logs} 
              onClear={clearLogs} 
              isOpen={isConsoleOpen} 
            />
         </div>

         <div className={`flex-1 ${activePanel === 'chat' ? 'flex' : 'hidden'}`}>
            <ChatPanel theme={theme} messages={messages} onSendMessage={onSendMessage} isProcessing={isProcessing} activeThought={activeThought} />
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