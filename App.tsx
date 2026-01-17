import React, { useState, useEffect, useCallback } from 'react';
import { Project, Message, Theme, ActivePanel, LogEntry } from './types';
import Sidebar from './components/Sidebar';
import Editor from './components/Editor';
import ChatPanel from './components/ChatPanel';
import Settings from './components/Settings';
import Console from './components/Console';
import { chatWithAgent } from './services/geminiService';
import { scanDirectory, readNativeFile, writeNativeFile, deleteNativeNode } from './services/fsService';
import { Preferences } from '@capacitor/preferences';
import { Filesystem } from '@capacitor/filesystem'; // Tambahkan ini jika belum ada

export default function App(): React.JSX.Element {
  const [theme, setTheme] = useState<Theme>('dark');
  const [activePanel, setActivePanel] = useState<ActivePanel>('editor');
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState('root');
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [activeFileContent, setActiveFileContent] = useState<string>("");
  
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [hasNewLogs, setHasNewLogs] = useState(false);

  const [isProcessing, setIsProcessing] = useState(false);
  const [activeThought, setActiveThought] = useState<string>("");
  const [pendingToolCall, setPendingToolCall] = useState<{name: string, args: any, resolve: (val: any) => void} | null>(null);
  const [lastImageData, setLastImageData] = useState<{ data: string, mimeType: string } | null>(null);

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [...prev, {
      id: Date.now().toString(),
      message,
      type,
      timestamp: Date.now()
    }]);
    if (!isConsoleOpen) setHasNewLogs(true);
  }, [isConsoleOpen]);

  const triggerFSRefresh = useCallback(() => {
    window.dispatchEvent(new CustomEvent('refresh-fs'));
    addLog("Filesystem Synchronized", "info");
  }, [addLog]);

  const clearLogs = () => {
    setLogs([]);
    setHasNewLogs(false);
  };

  const refreshExplorer = async () => {
    const tree = await scanDirectory('root');
    setProjects([{ 
      id: 'root', 
      name: 'Main Workspace', 
      createdAt: Date.now(), 
      root: { name: 'root', path: 'root', type: 'folder', children: tree || [] } 
    }]);
    triggerFSRefresh();
  };

  // 1. INITIAL LOAD (Sinkronisasi State & Storage)
  useEffect(() => {
    const init = async () => {
      const { value: t } = await Preferences.get({ key: 'ds-ai-theme' });
      if (t) setTheme(t as Theme);
      
      const tree = await scanDirectory('root');
      setProjects([{ 
        id: 'root', 
        name: 'Main Workspace', 
        createdAt: Date.now(), 
        root: { name: 'root', path: 'root', type: 'folder', children: tree || [] } 
      }]);

      const { value: savedMsgs } = await Preferences.get({ key: `chat_log_${activeProjectId}` });
      setMessages(savedMsgs ? JSON.parse(savedMsgs) : []);

      addLog("System initialized. Native FS Active.", "info");
    };
    init();
  }, [activeProjectId, addLog]);

   // --- TAMBAHKAN INI (1.5 ANDROID PERMISSION) ---
  useEffect(() => {
    const checkAndroidPermissions = async () => {
      try {
        const status = await Filesystem.checkPermissions();
        if (status.publicStorage !== 'granted') {
          await Filesystem.requestPermissions();
        }
      } catch (err) {
        addLog("Gagal sinkronisasi izin sistem.", "error");
      }
    };
    checkAndroidPermissions();
  }, [addLog]);

  // 2. FILE CONTENT SYNC (Guard terhadap file yang dihapus)
  useEffect(() => {
    let isMounted = true;
    if (activeFilePath) {
      readNativeFile(activeFilePath)
        .then(content => {
          if (isMounted) setActiveFileContent(content);
        })
        .catch(() => {
          if (isMounted) {
            setActiveFilePath(null);
            setActiveFileContent("");
            addLog(`File tidak ditemukan: ${activeFilePath}`, 'error');
          }
        });
    } else {
      setActiveFileContent("");
    }
    return () => { isMounted = false; };
  }, [activeFilePath, addLog]);

  const handleEditorChange = useCallback(async (content: string) => {
    if (activeFilePath) {
      setActiveFileContent(content);
      await writeNativeFile(activeFilePath, content);
    }
  }, [activeFilePath]);

      // 4. TOOL EXECUTION CORE (Keamanan, Normalisasi Path & Android Permission Guard)
  const executeTool = async (name: string, args: any) => {
    // Normalisasi path agar AI tidak bingung antara 'ds/tes.txt' dan 'root/ds/tes.txt'
    let finalPath = args.path;
    if (finalPath && !finalPath.startsWith('root')) {
      finalPath = finalPath.startsWith('/') ? `root${finalPath}` : `root/${finalPath}`;
    }

    if (finalPath && !finalPath.startsWith('root')) {
      const securityError = `Akses Ditolak: Path '${finalPath}' di luar root.`;
      addLog(securityError, 'error');
      return securityError;
    }

    addLog(`Executing: ${name} on ${finalPath}`, 'ai');
    
    try {
      let result = "";
      switch (name) {
        case 'writeFile':
          try {
            await writeNativeFile(finalPath, args.content);
            addLog(`File saved: ${finalPath}`, 'info');
            result = `Success: File ${finalPath} written.`;
          } catch (e: any) {
            // Memberikan feedback spesifik ke AI jika terkena blokade Android
            result = `Error: Gagal menulis. Sistem Android menolak akses (EACCES). Pastikan izin 'Allow management of all files' aktif di Settings HP. Detail: ${e.message}`;
            addLog(`Write Failed: ${e.message}`, 'error');
          }
          break;

        case 'readFile':
          try {
            result = await readNativeFile(finalPath);
            addLog(`File read: ${finalPath}`, 'info');
          } catch (e: any) {
            result = `Error: Gagal membaca file. Izin akses ditolak sistem (EACCES). Detail: ${e.message}`;
            addLog(`Read Failed: ${e.message}`, 'error');
          }
          break;

        case 'deleteFile':
          try {
            await deleteNativeNode(finalPath);
            addLog(`Node deleted: ${finalPath}`, 'warn');
            result = `Success: ${finalPath} deleted.`;
          } catch (e: any) {
            result = `Error: Gagal menghapus. Sistem memblokir aksi. Detail: ${e.message}`;
            addLog(`Delete Failed: ${e.message}`, 'error');
          }
          break;

        case 'listDirectory':
          try {
            const nodes = await scanDirectory(finalPath || 'root');
            result = JSON.stringify(nodes);
            addLog(`Directory listed: ${finalPath || 'root'}`, 'info');
          } catch (e: any) {
            result = `Error: Gagal melihat folder. Izin sistem diperlukan. Detail: ${e.message}`;
            addLog(`Scan Failed: ${e.message}`, 'error');
          }
          break;

        default: 
          addLog(`Unknown tool: ${name}`, 'error');
          return "Error: Tool not found.";
      }

      // Refresh Explorer jika ada perubahan struktur
      if (['writeFile', 'deleteFile'].includes(name)) await refreshExplorer();
      return result;

    } catch (e: any) {
      const fatalError = `System Error Fatal: ${e.message}`;
      addLog(fatalError, 'error');
      return fatalError;
    }
  };

    const handleToolCall = async (name: string, args: any) => {
    // Tool baca-saja otomatis dieksekusi, tool modifikasi butuh izin (Confirm Action)
    if (name === 'readFile' || name === 'listDirectory') return await executeTool(name, args);
    return new Promise((resolve) => {
      setPendingToolCall({ name, args, resolve });
    });
  };

  // 5. AI MESSAGE HANDLER (Disiplin Model 3.0 & 2.5)
  const onSendMessage = async (text: string, imageData?: { data: string, mimeType: string }) => {
    if (isProcessing || (!text.trim() && !imageData)) return;
    if (imageData) setLastImageData(imageData);

    const { value: rawKeys } = await Preferences.get({ key: 'gemini_api_key' });
    if (!rawKeys) return setActivePanel('settings');
    const apiKeys = rawKeys.split(',').map(k => k.trim()).filter(k => k !== "");
    
    const userMsg: Message = { 
      id: Date.now().toString(), 
      projectId: activeProjectId, 
      role: 'user', 
      content: text || (imageData ? "[Image Sent]" : ""), 
      timestamp: Date.now() 
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setIsProcessing(true);

    const currentFileContext = activeFilePath ? `User sedang membuka file: ${activeFilePath}` : "Belum ada file yang dibuka.";
    const agentIdentity = `IDENTITAS: Senior Software Engineer. LINGKUNGAN: Android Native (root). KONTEKS: ${currentFileContext}
ATURAN: 1. Berbicaralah seperti rekan kerja manusia. 2. Gunakan 'listDirectory' jika ragu. 3. Batasan: Jalur 'root/'. 4. Baca file sebelum edit.`;

    const availableModels = ['gemini-3-flash-preview', 'gemini-2.5-flash'];
    let success = false;

    for (const modelName of availableModels) {
      if (success) break;
      for (const key of apiKeys) {
        try {
          // Pertama, panggil dengan isConfirmed = false
          const response = await chatWithAgent(updatedMessages, agentIdentity, handleToolCall, false, key, modelName, imageData);

          const aiMsg: Message = { 
            id: (Date.now() + 1).toString(), 
            projectId: activeProjectId, 
            role: 'model', 
            content: response.text, 
            thought: response.thought,
            pendingActions: response.pendingActions,
            timestamp: Date.now() 
          };

          const finalMsgs = [...updatedMessages, aiMsg];
          setMessages(finalMsgs);
          await Preferences.set({ key: `chat_log_${activeProjectId}`, value: JSON.stringify(finalMsgs) });
          success = true;
          break; 
        } catch (err) {
          addLog(`Model ${modelName} gagal: ${err}`, 'warn');
        }
      }
    }
    setIsProcessing(false);
  };

  // 6. PERMISSION HANDLER (Re-Chat Trigger)
  const handlePermission = async (approved: boolean) => {
    if (!pendingToolCall) return;
    const { name, args, resolve } = pendingToolCall;
    setPendingToolCall(null);
    
    if (!approved) {
      addLog(`Tindakan ${name} ditolak.`, 'warn');
      resolve("Error: User menolak akses.");
      return;
    }

    setIsProcessing(true);
    const result = await executeTool(name, args);
    resolve(result); // Teruskan hasil ke tool call

    // SETELAH TOOL SELESAI, MINTA AI MEMBERIKAN JAWABAN AKHIR
    const { value: rawKeys } = await Preferences.get({ key: 'gemini_api_key' });
    const key = rawKeys?.split(',')[0].trim();
    if (key) {
      try {
        const response = await chatWithAgent(messages, "", handleToolCall, true, key, 'gemini-3-flash-preview');
        const finalAiMsg: Message = {
          id: Date.now().toString(),
          projectId: activeProjectId,
          role: 'model',
          content: response.text,
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, finalAiMsg]);
        await Preferences.set({ key: `chat_log_${activeProjectId}`, value: JSON.stringify([...messages, finalAiMsg]) });
      } catch (e) {
        addLog("Gagal memproses respon final AI.", "error");
      }
    }
    setIsProcessing(false);
  };

  return (
    <div className={`fixed inset-0 flex flex-col overflow-hidden pt-[var(--safe-area-top,20px)] ${theme === 'dark' ? 'bg-[#0d1117] text-gray-200' : 'bg-slate-50'}`}>
      <div className="flex-1 flex overflow-hidden relative">
         {activePanel === 'explorer' && (
           <Sidebar 
             theme={theme} projects={projects} setProjects={setProjects} 
             activeProjectId={activeProjectId} setActiveProjectId={setActiveProjectId} 
             activeFilePath={activeFilePath} setActiveFilePath={setActiveFilePath} 
             onDownload={() => {}} 
           />
         )}
         
         <div className={`flex-1 relative ${activePanel === 'editor' ? 'block' : 'hidden'}`}>
            <Editor 
              theme={theme} 
              file={activeFilePath ? { path: activeFilePath, content: activeFileContent } : null} 
              onChange={handleEditorChange} 
              isConsoleOpen={isConsoleOpen}
              toggleConsole={() => { setIsConsoleOpen(!isConsoleOpen); setHasNewLogs(false); }}
              hasNewLogs={hasNewLogs}
            />
            <Console logs={logs} onClear={clearLogs} isOpen={isConsoleOpen} />
         </div>

         <div className={`flex-1 ${activePanel === 'chat' ? 'flex' : 'hidden'}`}>
            <ChatPanel 
              theme={theme} 
              messages={messages} 
              onSendMessage={onSendMessage} 
              isProcessing={isProcessing} 
              activeThought={activeThought}
              pendingToolCall={pendingToolCall} 
              onAction={handlePermission}
            />
         </div>

         {activePanel === 'settings' && <Settings theme={theme} onClose={() => setActivePanel('editor')} />}
      </div>

      <div className="h-20 flex border-t border-[#30363d] bg-[#0d1117] px-4 pb-safe">
        <NavButton icon="📁" label="Files" active={activePanel === 'explorer'} onClick={() => setActivePanel('explorer')} />
        <NavButton icon="📝" label="Code" active={activePanel === 'editor'} onClick={() => setActivePanel('editor')} />
        <NavButton icon="💬" label="AI" active={activePanel === 'chat'} onClick={() => setActivePanel('chat')} />
        <NavButton icon="⚙️" label="Config" active={activePanel === 'settings'} onClick={() => setActivePanel('settings')} />
      </div>
    </div>
  );
}

function NavButton({ 
  icon, 
  label, 
  active, 
  onClick 
}: { 
  icon: string, 
  label: string, 
  active: boolean, 
  onClick: () => void 
}) {
  return (
    <button 
      onClick={onClick} 
      className={`flex flex-col items-center justify-center flex-1 gap-1 transition-all duration-300 ${
        active ? 'text-blue-400 scale-110' : 'text-gray-500 hover:text-gray-400'
      }`}
    >
      <span className="text-xl" role="img" aria-label={label}>{icon}</span>
      <span className="text-[10px] font-black uppercase tracking-[0.15em]">{label}</span>
      
      {/* Indikator Aktif dengan efek Glow */}
      <div className={`transition-all duration-300 rounded-full ${
        active 
          ? 'w-1.5 h-1.5 bg-blue-400 mt-1 shadow-[0_0_10px_#60a5fa]' 
          : 'w-0 h-0 mt-0 opacity-0'
      }`} />
    </button>
  );
}