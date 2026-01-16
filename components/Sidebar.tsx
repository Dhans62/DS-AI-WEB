import React from 'react';
import { Project, FileNode, Theme } from '../types';

interface SidebarProps {
  theme: Theme;
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  activeProjectId: string;
  setActiveProjectId: (id: string) => void;
  activeFilePath: string | null;
  setActiveFilePath: (p: string | null) => void;
  onDownload: () => void;
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ theme, projects, setProjects, activeProjectId, setActiveProjectId, activeFilePath, setActiveFilePath, onDownload, onClose }) => {
  const isDark = theme === 'dark';
  const activeProject = projects.find(p => p.id === activeProjectId) || projects[0];

  // LOGIK RECURSIVE: Menemukan dan mengubah node
  const updateTree = (callback: (newRoot: FileNode) => void) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== activeProjectId) return p;
      const newP = JSON.parse(JSON.stringify(p));
      callback(newP.root);
      return newP;
    }));
  };

  const toggleFolder = (path: string) => {
    updateTree((root) => {
      const toggle = (node: FileNode) => {
        if (node.path === path) { node.isExpanded = !node.isExpanded; return true; }
        if (node.children) { for (let n of node.children) if (toggle(n)) return true; }
        return false;
      };
      toggle(root);
    });
  };

  const createItem = (parentPath: string, type: 'file' | 'folder') => {
    const name = prompt(`Enter ${type} name:`);
    if (!name) return;
    updateTree((root) => {
      const add = (node: FileNode) => {
        if (node.path === parentPath) {
          node.children = node.children || [];
          const newPath = parentPath === '/' ? `/${name}` : `${parentPath}/${name}`;
          node.children.push({ 
            name, path: newPath, type, isExpanded: true, 
            children: type === 'folder' ? [] : undefined, 
            content: type === 'file' ? '// Write code here...' : undefined 
          });
          return true;
        }
        if (node.children) { for (let c of node.children) if (add(c)) return true; }
        return false;
      };
      add(root);
    });
  };

  const renderTree = (nodes: FileNode[], depth = 0) => {
    return nodes.map((node) => (
      <div key={node.path} className="select-none">
        <div 
          onClick={() => node.type === 'folder' ? toggleFolder(node.path) : setActiveFilePath(node.path)}
          className={`group flex items-center justify-between py-1.5 px-3 cursor-pointer transition-colors ${
            activeFilePath === node.path ? 'bg-[#21262d] text-[#58a6ff]' : 'hover:bg-[#161b22] text-gray-400'
          }`}
          style={{ paddingLeft: `${depth * 12 + 12}px` }}
        >
          <div className="flex items-center gap-2 truncate">
            <span className="text-sm opacity-80">{node.type === 'folder' ? (node.isExpanded ? '📂' : '📁') : '📄'}</span>
            <span className={`text-xs font-mono truncate ${activeFilePath === node.path ? 'font-bold' : ''}`}>
              {node.name}
            </span>
          </div>
          
          {/* Action Buttons (Hanya muncul saat hover/aktif) */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
            {node.type === 'folder' && (
              <button onClick={(e) => { e.stopPropagation(); createItem(node.path, 'file'); }} className="p-1 hover:text-green-500 text-[10px]">✚</button>
            )}
            {node.path !== '/' && (
              <button onClick={(e) => { e.stopPropagation(); if(confirm("Hapus?")) { /* logic delete */ } }} className="p-1 hover:text-red-500 text-[10px]">✕</button>
            )}
          </div>
        </div>
        {node.type === 'folder' && node.isExpanded && node.children && renderTree(node.children, depth + 1)}
      </div>
    ));
  };

  return (
    <div className={`w-full h-full flex flex-col ${isDark ? 'bg-[#0d1117] border-r border-[#30363d]' : 'bg-slate-100'}`}>
      
      {/* HEADER: Proyek & Download */}
      <div className="p-4 space-y-4 shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-tighter text-[#8b949e]">DS-AI Explorer</span>
          <button onClick={() => {/* logic new project */}} className="text-[#238636] text-[10px] font-bold hover:underline">+ PROJECT</button>
        </div>

        <button 
          onClick={onDownload}
          className="w-full flex items-center justify-center gap-2 bg-[#238636] hover:bg-[#2ea043] text-white text-[11px] font-bold py-2 rounded shadow-lg transition-transform active:scale-95"
        >
          📦 EXPORT TO .ZIP
        </button>
      </div>

      {/* FILE TREE AREA */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="px-4 py-2 flex items-center justify-between bg-[#161b22] border-y border-[#30363d]">
          <span className="text-[10px] font-bold text-gray-500 uppercase">Project Root</span>
          <button onClick={() => createItem('/', 'folder')} className="text-[10px] text-[#58a6ff] hover:underline">NEW FOLDER</button>
        </div>
        <div className="py-2">
          {renderTree([activeProject.root])}
        </div>
      </div>

      {/* FOOTER: Status Sandbox */}
      <div className="p-2 border-t border-[#30363d] bg-[#0d1117]">
         <div className="flex items-center gap-2 px-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-[9px] text-gray-500 font-mono uppercase">Sandbox Protected</span>
         </div>
      </div>
    </div>
  );
};

export default Sidebar;
