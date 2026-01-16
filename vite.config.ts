import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      // KRUSIAL UNTUK APK: Agar index.html nyari aset di ./assets bukan /assets
      base: './', 
      
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        // Gabungkan env agar tidak bentrok
        'process.env': env
      },
      resolve: {
        alias: {
          // Sesuaikan alias agar sesuai dengan struktur folder lu
          '@': path.resolve(__dirname, './src'), 
        }
      },
      build: {
        // Pastikan hasil build masuk ke folder dist untuk Capacitor
        outDir: 'dist',
        emptyOutDir: true
      }
    };
});
