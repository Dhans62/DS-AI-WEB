export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  content?: string;
  children?: FileNode[];
  isExpanded?: boolean;
}

export interface Project {
  id: string;
  name: string;
  root: FileNode;
  createdAt: number;
}

export interface MessagePart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
  functionCall?: {
    name: string;
    args: any;
  };
  functionResponse?: {
    name: string;
    response: any;
  };
}

export interface Message {
  id: string;
  projectId: string; 
  role: 'user' | 'model' | 'system';
  content: string | MessagePart[];
  thought?: string; 
  // TAMBAHAN: Agar ChatPanel tahu pesan model ini punya aksi yang butuh izin
  pendingActions?: PendingAction[]; 
  timestamp: number;
}

export interface AgentResponse {
  text: string;
  thought?: string; 
  needsConfirmation: boolean;
  pendingActions?: PendingAction[];
}

export interface PendingAction {
  name: string;
  args: any;
  id?: string;
}

export type Theme = 'light' | 'dark';

export type ActivePanel = 'explorer' | 'editor' | 'chat' | 'settings';

// MODUL D: Log Entry untuk Console
export interface LogEntry {
  id: string;
  message: string;
  type: 'info' | 'warn' | 'error' | 'ai';
  timestamp: number;
}
