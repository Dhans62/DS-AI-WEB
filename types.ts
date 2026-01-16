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
  projectId: string; // TAMBAHAN: Untuk memisahkan memori antar proyek
  role: 'user' | 'model' | 'system';
  content: string | MessagePart[];
  thought?: string; // TAMBAHAN: Menangkap proses berpikir Gemini 3 (Thinking Mode)
  timestamp: number;
}

export interface AgentResponse {
  text: string;
  thought?: string; // TAMBAHAN: Agar UI bisa menampilkan "Thinking..."
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
