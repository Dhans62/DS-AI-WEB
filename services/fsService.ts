import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  content?: string;
  children?: FileNode[];
}

/**
 * UTILITY INTERNAL: Membersihkan path dari AI
 * Menghilangkan 'root/', leading slashes, dan merapikan double slashes.
 * Ini memastikan perintah AI mendarat di Directory.Documents yang tepat.
 */
const sanitizePath = (path: string): string => {
  return path
    .replace(/^root\//i, '') // Hapus 'root/' di awal (case insensitive)
    .replace(/^\/+/, '')     // Hapus / di awal string
    .replace(/\/+/g, '/');    // Bersihkan // jadi /
};

/**
 * Scan folder proyek secara rekursif
 */
export const scanDirectory = async (path: string): Promise<FileNode[]> => {
  const cleanPath = sanitizePath(path);
  try {
    const result = await Filesystem.readdir({
      path: cleanPath,
      directory: Directory.Documents,
    });

    const nodes: FileNode[] = [];

    for (const file of result.files) {
      // Konsistensi fullPath menggunakan path yang sudah bersih
      const fullPath = `${cleanPath}/${file.name}`.replace(/\/+/g, '/');
      
      if (file.type === 'directory') {
        nodes.push({
          name: file.name,
          path: fullPath,
          type: 'folder',
          children: await scanDirectory(fullPath)
        });
      } else {
        nodes.push({
          name: file.name,
          path: fullPath,
          type: 'file'
        });
      }
    }
    return nodes;
  } catch (e) {
    console.error("Gagal scan direktori:", e);
    return [];
  }
};

/**
 * Membaca isi file secara native
 */
export const readNativeFile = async (path: string): Promise<string> => {
  const cleanPath = sanitizePath(path);
  const result = await Filesystem.readFile({
    path: cleanPath,
    directory: Directory.Documents,
    encoding: Encoding.UTF8,
  });
  return result.data as string;
};

/**
 * Menulis/Menyimpan file secara native
 */
export const writeNativeFile = async (path: string, content: string): Promise<void> => {
  const cleanPath = sanitizePath(path);
  await Filesystem.writeFile({
    path: cleanPath,
    data: content,
    directory: Directory.Documents,
    encoding: Encoding.UTF8,
    recursive: true // Krusial agar AI bisa bikin folder otomatis
  });
};

/**
 * Menghapus File atau Folder secara permanen
 */
export const deleteNativeNode = async (path: string): Promise<void> => {
  const cleanPath = sanitizePath(path);
  try {
    await Filesystem.deleteFile({
      path: cleanPath,
      directory: Directory.Documents,
    });
  } catch (e) {
    await Filesystem.rmdir({
      path: cleanPath,
      directory: Directory.Documents,
      recursive: true
    });
  }
};

/** * Membuat Node Baru (File atau Folder)
 */
export const createNativeNode = async (path: string, type: 'file' | 'folder'): Promise<void> => {
  const cleanPath = sanitizePath(path);
  if (type === 'folder') {
    await Filesystem.mkdir({
      path: cleanPath,
      directory: Directory.Documents,
      recursive: true
    });
  } else {
    await writeNativeFile(cleanPath, "");
  }
};

/**
 * Mengganti Nama File atau Folder
 */
export const renameNativeNode = async (oldPath: string, newName: string): Promise<void> => {
  const cleanOldPath = sanitizePath(oldPath);
  const pathParts = cleanOldPath.split('/');
  pathParts.pop(); 
  const parentPath = pathParts.join('/');
  const cleanNewPath = `${parentPath}/${newName}`.replace(/\/+/g, '/');

  await Filesystem.rename({
    from: cleanOldPath,
    to: cleanNewPath,
    directory: Directory.Documents
  });
};
