import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  content?: string;
  children?: FileNode[];
}

/**
 * UTILITY INTERNAL: Proteksi dan Standarisasi Path
 * Memastikan semua operasi AI dipaksa masuk ke subfolder 'root' di Documents.
 */
const sanitizePath = (path: string): string => {
  let clean = path
    .replace(/\\/g, '/')       
    .replace(/\/+/g, '/');      

  if (!clean.toLowerCase().startsWith('root')) {
    clean = 'root/' + clean;
  }

  return clean.replace(/^\/+/, '');
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
 * UPDATE: Menambahkan pengecekan folder root agar tidak error pada installasi baru.
 */
export const writeNativeFile = async (path: string, content: string): Promise<void> => {
  const cleanPath = sanitizePath(path);
  
  // Pastikan folder root/ selalu tersedia di Documents HP
  try {
    await Filesystem.mkdir({
      path: 'root',
      directory: Directory.Documents,
      recursive: true
    });
  } catch (e) {
    // Folder sudah ada, lanjut
  }

  await Filesystem.writeFile({
    path: cleanPath,
    data: content,
    directory: Directory.Documents,
    encoding: Encoding.UTF8,
    recursive: true 
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

/**
 * Membuat Node Baru (File atau Folder)
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
    // Memanggil writeNativeFile yang sudah memiliki pengecekan root
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