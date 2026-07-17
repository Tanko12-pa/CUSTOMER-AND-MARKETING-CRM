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
      hmr: {
        // Force the HMR client to map directly to the secure client port/protocol
        protocol: 'ws',
        host: 'localhost',
      },
      // Alternative if sandbox blocks it completely: turn off or catch client connection errors safely
      watch: {
        usePolling: true,
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
