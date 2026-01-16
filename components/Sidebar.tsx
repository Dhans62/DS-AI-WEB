import React, { useState, useEffect } from 'react';
import { Project, Theme } from '../types';
import { 
  FileNode, 
  scanDirectory, 
  deleteNativeNode, 
  createNativeNode, 
  renameNativeNode 
} from '../services/fsService';

interface SidebarProps {
  theme: Theme;
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  activeProjectId: string;
  setActiveProjectId: (id: string) => void;
  activeFilePath: string | null;
  setActiveFilePath: (p: string | null) => void;
  onDownload: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ theme, activeProjectId, activeFilePath, setActiveFilePath, onDownload }) => {
  const isDark = theme === 'dark';
  const [tree, setTree] = useState<FileNode[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['root']));
  
  // State untuk UI Manajemen
  const [activeNode, setActiveNode] = useState<FileNode | null>(null);
  const [showSheet, setShowSheet] = useState(false);
  const [dialog, setDialog] = useState<{show: boolean, type: 'rename' | 'newFile' | 'newFolder', val: string}>({
    show: false, type: 'rename', val: ''
  });
  
  const timerRef = React.useRef<any>(null);

  const refreshTree = async () => {
    const nodes = await scanDirectory('root');
    setTree(nodes);
  };

  useEffect(() => {
    refreshTree();
  }, [activeProjectId]);

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  // LONG PRESS LOGIC
  const handleTouchStart = (node: FileNode) => {
    timerRef.current = setTimeout(() => {
      setActiveNode(node);
      setShowSheet(true);
      if ('vibrate' in navigator) navigator.vibrate(50);
    }, 600);
  };

  const handleTouchEnd = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  // CRUD ACTIONS
  const handleDelete = async () => {
    if (activeNode && confirm(`Hapus permanen ${activeNode.name}?`)) {
      await deleteNativeNode(activeNode.path);
      setShowSheet(false);
      refreshTree();
    }
  };

  const handleActionSubmit = async () => {
    if (!dialog.val || !activeNode) return;

    try {
      if (dialog.type === 'rename') {
        await renameNativeNode(activeNode.path, dialog.val);
      } else {
        const type = dialog.type === 'newFile' ? 'file' : 'folder';
        const newPath = `${activeNode.path}/${dialog.val}`.replace(/\/+/g, '/');
        await createNativeNode(newPath, type);
      }
      setDialog({ ...dialog, show: false });
      setShowSheet(false);
      refreshTree();
    } catch (e: any) {
      alert("Gagal: " + e.message);
    }
  };

  const renderTree = (nodes: FileNode[], depth = 0) => {
    return nodes.map((node) => {
      const isExpanded = expandedFolders.has(node.path);
      const isActive = activeFilePath === node.path;

      return (
        <div key={node.path} className="select-none">
          <div 
            onTouchStart={() => handleTouchStart(node)}
            onTouchEnd={handleTouchEnd}
            onClick={() => node.type === 'folder' ? toggleFolder(node.path) : setActiveFilePath(node.path)}
            className={`flex items-center justify-between py-2.5 px-4 cursor-pointer transition-all active:bg-blue-500/10 ${
              isActive ? 'bg-blue-500/10 border-l-2 border-blue-500 text-blue-400' : 'text-gray-400'
            }`}
            style={{ paddingLeft: `${depth * 16 + 16}px` }}
          >
            <div className="flex items-center gap-3 truncate">
              <span className="text-lg leading-none">
                {node.type === 'folder' ? (isExpanded ? '📂' : '📁') : '📄'}
              </span>
              <span className={`text-sm font-medium truncate ${isActive ? 'text-blue-100' : ''}`}>
                {node.name}
              </span>
            </div>
          </div>
          {node.type === 'folder' && isExpanded && node.children && renderTree(node.children, depth + 1)}
        </div>
      );
    });
  };

  return (
    <div className={`w-full h-full flex flex-col ${isDark ? 'bg-[#0d1117]' : 'bg-slate-100'}`}>
      
      {/* HEADER */}
      <div className="p-6 space-y-4 shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-widest text-blue-500">DS-AI Explorer</span>
    
     <button 
        onClick={() => { 
       // Jika belum ada file, arahkan ke 'root' sebagai parent
         const fallbackNode: FileNode = { name: 'root', path: 'root', type: 'folder' };
         setActiveNode(tree.length > 0 ? tree[0] : fallbackNode); 
        setDialog({show: true, type: 'newFolder', val: ''}); 
          }}
     className="bg-blue-500/10 text-blue-500 px-3 py-1 rounded-full text-[10px] font-bold"
>
  NEW +
      </button>
    
        </div>
        <button 
          onClick={onDownload}
          className="w-full flex items-center justify-center gap-2 bg-[#238636] hover:bg-[#2ea043] text-white text-xs font-bold py-3 rounded-xl shadow-lg active:scale-95 transition-all"
        >
          📦 EXPORT TO .ZIP
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-2 mb-2">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Active Workspace</span>
        </div>
        {renderTree(tree)}
      </div>

      {/* DIALOG INPUT (MODAL TENGAH) */}
      {dialog.show && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-xs bg-[#161b22] border border-[#30363d] rounded-2xl p-6 shadow-2xl animate-in zoom-in-95">
            <h4 className="text-xs font-bold text-blue-500 uppercase mb-4">{dialog.type.replace(/([A-Z])/g, ' $1')}</h4>
            <input 
              autoFocus
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg p-3 text-sm outline-none focus:border-blue-500 mb-4"
              value={dialog.val}
              onChange={(e) => setDialog({...dialog, val: e.target.value})}
              placeholder="Enter name..."
              onKeyDown={(e) => e.key === 'Enter' && handleActionSubmit()}
            />
            <div className="flex gap-2">
              <button onClick={() => setDialog({...dialog, show: false})} className="flex-1 py-2 text-xs font-bold opacity-50">Cancel</button>
              <button onClick={handleActionSubmit} className="flex-1 py-2 bg-blue-600 rounded-lg text-xs font-bold">Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM SHEET */}
      {showSheet && (
        <>
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100]" onClick={() => setShowSheet(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-[101] bg-[#161b22] border-t border-[#30363d] rounded-t-[2.5rem] p-8 bottom-sheet-active">
            <div className="w-12 h-1.5 bg-gray-700 rounded-full mx-auto mb-8" />
            
            <div className="mb-6">
              <p className="text-[10px] font-bold text-blue-500 uppercase mb-1">{activeNode?.type}</p>
              <h3 className="text-xl font-bold text-gray-100 truncate">{activeNode?.name}</h3>
            </div>
            
            <div className="grid grid-cols-1 gap-2">
              {activeNode?.type === 'folder' && (
                <>
                  <button onClick={() => setDialog({show: true, type: 'newFile', val: ''})} className="w-full p-4 bg-[#21262d] rounded-2xl flex items-center gap-4 text-sm font-semibold">📄 New File</button>
                  <button onClick={() => setDialog({show: true, type: 'newFolder', val: ''})} className="w-full p-4 bg-[#21262d] rounded-2xl flex items-center gap-4 text-sm font-semibold">📁 New Folder</button>
                </>
              )}
              <button onClick={() => setDialog({show: true, type: 'rename', val: activeNode?.name || ''})} className="w-full p-4 bg-[#21262d] rounded-2xl flex items-center gap-4 text-sm font-semibold">✏️ Rename</button>
              <button onClick={handleDelete} className="w-full p-4 bg-red-500/10 text-red-500 rounded-2xl flex items-center gap-4 text-sm font-semibold">🗑️ Delete</button>
            </div>
          </div>
        </>
      )}

      {/* FOOTER */}
      <div className="p-4 border-t border-[#30363d] bg-[#0d1117] flex items-center justify-between">
         <div className="flex items-center gap-2 px-2">
            <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
            <span className="text-[9px] text-gray-500 font-bold uppercase">Native FS Active</span>
         </div>
         <span className="text-[9px] text-gray-600 font-mono">v3.1</span>
      </div>
    </div>
  );
};

export default Sidebar;
