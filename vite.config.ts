import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

// Fix for __dirname in ESM environment
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // QUAN TRỌNG: Đường dẫn tương đối để Electron tải được assets từ file://
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      // Đảm bảo buffer được resolve đúng về package cài đặt
      buffer: 'buffer',
    },
  },
  define: {
    // Polyfill global cho các thư viện cũ
    'global': 'window',
    // Polyfill process.env rỗng để tránh lỗi "process is not defined"
    'process.env': {}
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'esnext',
  },
  server: {
    port: 5173,
  }
});