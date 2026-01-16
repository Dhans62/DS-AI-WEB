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
}

export interface Message {
  id: string;
  role: 'user' | 'model' | 'system';
  content: string | MessagePart[];
  timestamp: number;
}

// TAMBAHKAN INI: Untuk menangkap respon dari Gemini Service
export interface AgentResponse {
  text: string;
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
