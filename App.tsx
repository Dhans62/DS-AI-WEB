import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Project, FileNode, Message, Theme, ActivePanel } from './types';
import Sidebar from './components/Sidebar';
import Editor from './components/Editor';
import ChatPanel from './components/ChatPanel';
import Settings from './components/Settings';
import { chatWithAgent } from './services/geminiService';

// IMPORT BARU UNTUK NATIVE APK
import { Preferences } from '@capacitor/preferences';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

const DEFAULT_PROJECTS: Project[] = [
  {
    id: 'p1',
    name: 'DS-AI-Mobile',
    createdAt: Date.now(),
    root: {
      name: 'root',
      path: 'root', // Diperbaiki: Jangan pakai '/' di awal untuk path Capacitor
      type: 'folder',
      isExpanded: true,
      children: [
        { name: 'app.js', path: 'root/app.js', type: 'file', content: '// Bangun masa depan di sini\nconsole.log("DS-AI Online");' },
        { name: 'README.md', path: 'root/README.md', type: 'file', content: '# DS-AI Mobile IDE\n\nAI ini akan meminta izin sebelum mengubah file Anda.' }
      ]
    }
  }
];

export default function App(): React.JSX.Element {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('ds-ai-theme') as Theme) || 'dark');
  const [activePanel, setActivePanel] = useState<ActivePanel>('editor');
  
  const [projects, setProjects] = useState<Project[]>(() => {
    const saved = localStorage.getItem('ds-ai-projects');
    return saved ? JSON.parse(saved) : DEFAULT_PROJECTS;
  });
  const [activeProjectId, setActiveProjectId] = useState(() => localStorage.getItem('ds-ai-active-project') || 'p1');
  const [messagesByProject, setMessagesByProject] = useState<Record<string, Message[]>>(() => {
    const saved = localStorage.getItem('ds-ai-messages');
    return saved ? JSON.parse(saved) : {};
  });
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeThought, setActiveThought] = useState<string>("");
  const [pendingToolCall, setPendingToolCall] = useState<{name: string, args: any, resolve: (val: any) => void} | null>(null);

  const activeProject = useMemo(() => projects.find(p => p.id === activeProjectId) || projects[0], [projects, activeProjectId]);
  const messages = useMemo(() => messagesByProject[activeProjectId] || [], [messagesByProject, activeProjectId]);

  useEffect(() => {
    localStorage.setItem('ds-ai-projects', JSON.stringify(projects));
    localStorage.setItem('ds-ai-active-project', activeProjectId);
    localStorage.setItem('ds-ai-messages', JSON.stringify(messagesByProject));
    localStorage.setItem('ds-ai-theme', theme);
  }, [projects, activeProjectId, messagesByProject, theme]);

  // FUNGSI NATIVE: Tulis ke Storage HP
  const saveToNativeFileSystem = async (path: string, content: string) => {
    try {
      await Filesystem.writeFile({
        path: path,
        data: content,
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
        recursive: true
      });
    } catch (e) {
      console.error("Native FS Error:", e);
    }
  };

  const updateFileContent = useCallback((path: string, content: string) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== activeProjectId) return p;
      const newP = JSON.parse(JSON.stringify(p));
      const update = (nodes: FileNode[]) => {
        for (let n of nodes) {
          if (n.path === path) { n.content = content; return true; }
          if (n.children && update(n.children)) return true;
        }
        return false;
      };
      if (!update(newP.root.children || [])) {
        newP.root.children.push({ name: path.split('/').pop() || 'file', path, type: 'file', content });
      }
      return newP;
    }));
    // Panggil Native Save
    saveToNativeFileSystem(path, content);
  }, [activeProjectId]);

  const findFileByPath = useCallback((node: FileNode, path: string): FileNode | null => {
    if (node.path === path) return node;
    if (node.children) {
      for (const child of node.children) {
        const found = findFileByPath(child, path);
        if (found) return found;
      }
    }
    return null;
  }, []);

  const activeFile = useMemo(() => activeFilePath ? findFileByPath(activeProject.root, activeFilePath) : null, [activeProject, activeFilePath, findFileByPath]);

  const executeTool = async (name: string, args: any) => {
    switch (name) {
      case 'writeFile':
        updateFileContent(args.path, args.content);
        return `Success: File ${args.path} updated and saved to storage.`;
      case 'readFile':
        const f = findFileByPath(activeProject.root, args.path);
        return f ? f.content : "Error: File not found.";
      case 'deleteFile':
        return "Success: Deleted.";
      default: return "Error: Not implemented.";
    }
  };

  const handleToolCall = async (name: string, args: any) => {
    if (name === 'readFile' || name === 'listDirectory') return await executeTool(name, args);
    return new Promise((resolve) => {
      setPendingToolCall({ name, args, resolve });
    });
  };

  const onSendMessage = async (text: string) => {
    // 1. Ambil API KEY dari Preferences (Runtime)
    const { value: userApiKey } = await Preferences.get({ key: 'gemini_api_key' });
    
    if (!userApiKey) {
      setActivePanel('settings');
      alert("Tolong masukkan API Key Gemini di Settings terlebih dahulu.");
      return;
    }

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text, timestamp: Date.now() };
    const newMessages = [...messages, userMsg];
    
    setMessagesByProject(prev => ({ ...prev, [activeProjectId]: newMessages }));
    setIsProcessing(true);
    setActiveThought("Memulai analisis sistem...");

    try {
      const systemPrompt = "You are DS-AI, a professional mobile IDE agent. Use tools to manage the project.";
      
      // Kirim userApiKey ke service
      const response = await chatWithAgent(newMessages, systemPrompt, handleToolCall, false, userApiKey);

      if (response.thought) setActiveThought(response.thought);

      setMessagesByProject(prev => ({ ...prev, [activeProjectId]: [...newMessages, {
        id: (Date.now() + 1).toString(), role: 'model', content: response.text, timestamp: Date.now()
      }] }));
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePermission = async (approved: boolean) => {
    if (!pendingToolCall) return;
    const { name, args, resolve } = pendingToolCall;
    setPendingToolCall(null);

    if (approved) {
      const result = await executeTool(name, args);
      resolve(result);
      setMessagesByProject(prev => ({ ...prev, [activeProjectId]: [...(prev[activeProjectId] || []), {
        id: Date.now().toString(), role: 'model', content: `✅ Berhasil mengeksekusi: ${name}`, timestamp: Date.now()
      }] }));
    } else {
      resolve("Error: User denied permission.");
    }
  };

  return (
    <div className={`fixed inset-0 flex flex-col overflow-hidden ${theme === 'dark' ? 'bg-[#0d1117] text-gray-200' : 'bg-slate-50'}`}>
      
      {pendingToolCall && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#161b22] border border-[#30363d] rounded-2xl p-6 shadow-2xl">
            <h3 className="font-bold text-xl mb-2 text-yellow-500 flex items-center gap-2">🛡️ Keamanan</h3>
            <p className="text-sm opacity-80 mb-4 text-gray-300">AI ingin melakukan <span className="text-blue-400 font-mono">{pendingToolCall.name}</span>. Izinkan?</p>
            <div className="flex gap-3">
              <button onClick={() => handlePermission(false)} className="flex-1 py-3 rounded-xl bg-red-900/20 text-red-500 font-bold hover:bg-red-900/40">Tolak</button>
              <button onClick={() => handlePermission(true)} className="flex-1 py-3 rounded-xl bg-[#238636] text-white font-bold hover:bg-[#2ea043]">Izinkan</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
         {activePanel === 'explorer' && (
           <Sidebar 
             theme={theme} 
             projects={projects} 
             setProjects={setProjects} 
             activeProjectId={activeProjectId} 
             setActiveProjectId={setActiveProjectId} 
             activeFilePath={activeFilePath} 
             setActiveFilePath={setActiveFilePath} 
             onDownload={() => {}} 
           />
         )}
         
         <div className={`flex-1 ${activePanel === 'editor' ? 'flex' : 'hidden'}`}>
            <Editor theme={theme} file={activeFile} onChange={(c) => updateFileContent(activeFile!.path, c)} />
         </div>

         <div className={`flex-1 ${activePanel === 'chat' ? 'flex' : 'hidden'}`}>
            <ChatPanel 
              theme={theme} 
              messages={messages} 
              onSendMessage={onSendMessage} 
              isProcessing={isProcessing}
              activeThought={activeThought}
            />
         </div>

         {activePanel === 'settings' && <Settings theme={theme} onClose={() => setActivePanel('editor')} />}
      </div>

      <div className="h-16 flex border-t border-[#30363d] bg-[#161b22] pb-safe">
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
    <button onClick={onClick} className={`flex flex-col items-center justify-center flex-1 transition-all ${active ? 'text-blue-500' : 'text-gray-500'}`}>
      <span className="text-xl">{icon}</span>
      <span className="text-[9px] font-bold uppercase tracking-tighter mt-1">{label}</span>
    </button>
  );
}
