import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.yourapp.id', // Pastikan ini sama dengan applicationId di android/app/build.gradle
  appName: 'DS-AI',
  webDir: 'dist', // Mengikuti folder output default Vite
  server: {
    androidScheme: 'https'
  },
  plugins: {
    Filesystem: {
      // Mengizinkan file sharing dan akses direktori publik
      allowSharing: true
    }
  }
};

export default config;
