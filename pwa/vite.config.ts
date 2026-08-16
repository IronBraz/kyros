import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
  // Read .env from the repo root (one level up), so a single .env file
  // configures both the PWA and the PowerShell DB scripts.
  return {
    envDir: path.resolve(__dirname, '..'),
    server: {
      port: 5173,
      host: '0.0.0.0',
      // In production the SPA and the API share one origin on Vercel, so API_BASE stays ''
      // and requests go to /api/v1/* relative. In dev the SPA is on 5173 and the backend on
      // 3000, so without this proxy `npm run dev` alone cannot reach the API at all.
      // Run `vercel dev` on port 3000 in a second terminal.
      proxy: {
        '/api': { target: 'http://localhost:3000', changeOrigin: true },
      },
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      }
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-charts': ['recharts'],
            'vendor-qr': ['html5-qrcode', 'qrcode'],
            'vendor-icons': ['lucide-react'],
            'vendor-state': ['zustand']
          }
        }
      }
    }
  };
});
