import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // Force Vite to handle HMR connections explicitly
      hmr: process.env.DISABLE_HMR === 'true' ? false : {
        protocol: 'ws',
        host: 'localhost',
        port: 5173, // Matches standard port
        clientPort: 5173, // Forces the client to use the exact local port
      },
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {
        usePolling: true, // Forces file watching to work accurately in virtual environments
      },
      proxy: {
        '/api': {
          target: 'http://localhost:5000',
          changeOrigin: true,
          secure: false,
          // CRITICAL: Prevent the backend proxy from intercepting Vite's websockets
          ws: false, 
        },
      },
    },
  };
});
