import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  content?: string;
  children?: FileNode[];
}

/**
 * Scan folder proyek secara rekursif
 * Menghasilkan struktur tree untuk UI Sidebar & AI Context
 */
export const scanDirectory = async (path: string): Promise<FileNode[]> => {
  try {
    const result = await Filesystem.readdir({
      path: path,
      directory: Directory.Documents,
    });

    const nodes: FileNode[] = [];

    for (const file of result.files) {
      // Membersihkan path agar tidak ada double slash //
      const fullPath = `${path}/${file.name}`.replace(/\/+/g, '/');
      
      if (file.type === 'directory') {
        nodes.push({
          name: file.name,
          path: fullPath,
          type: 'folder',
          children: await scanDirectory(fullPath) // Masuk ke dalam folder
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
  const result = await Filesystem.readFile({
    path: path,
    directory: Directory.Documents,
    encoding: Encoding.UTF8,
  });
  return result.data as string;
};

/**
 * Menulis/Menyimpan file secara native
 */
export const writeNativeFile = async (path: string, content: string): Promise<void> => {
  await Filesystem.writeFile({
    path: path,
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
  try {
    await Filesystem.deleteFile({
      path: path,
      directory: Directory.Documents,
    });
  } catch (e) {
    // Jika gagal sebagai file, coba hapus sebagai direktori secara rekursif
    await Filesystem.rmdir({
      path: path,
      directory: Directory.Documents,
      recursive: true
    });
  }
};

/** * TAMBAHAN BARU: Membuat Node Baru (File atau Folder)
 */
export const createNativeNode = async (path: string, type: 'file' | 'folder'): Promise<void> => {
  if (type === 'folder') {
    await Filesystem.mkdir({
      path: path,
      directory: Directory.Documents,
      recursive: true
    });
  } else {
    // Buat file kosong
    await writeNativeFile(path, "");
  }
};

/**
 * TAMBAHAN BARU: Mengganti Nama File atau Folder
 */
export const renameNativeNode = async (oldPath: string, newName: string): Promise<void> => {
  // Ambil direktori induk dari path lama
  const pathParts = oldPath.split('/');
  pathParts.pop(); // Buang nama lama
  const parentPath = pathParts.join('/');
  const newPath = `${parentPath}/${newName}`.replace(/\/+/g, '/');

  await Filesystem.rename({
    from: oldPath,
    to: newPath,
    directory: Directory.Documents
  });
};