import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Read .env from the repo root (one level up), so a single .env file
  // configures both the PWA and the PowerShell DB scripts.
  const env = loadEnv(mode, path.resolve(__dirname, '..'), '');
  return {
    envDir: path.resolve(__dirname, '..'),
    server: {
      port: 5173,
      host: '0.0.0.0',
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
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
