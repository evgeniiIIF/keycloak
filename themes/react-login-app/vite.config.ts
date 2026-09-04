import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    // Выходная папка – resources/js темы
    outDir: path.resolve(__dirname, '../react-login/resources'),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: 'js/login-bundle.js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return 'js/login.css';
          }
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
  },
});
