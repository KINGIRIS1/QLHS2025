import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],
  // Dùng './' để hỗ trợ đường dẫn con và giao thức file của Electron.
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      buffer: 'buffer',
    },
  },
  define: {
    global: 'window',
    'process.env': {},
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalized = id.replace(/\\/g, '/');
          if (!normalized.includes('/node_modules/')) {
            if (normalized.includes('/components/report/')) return 'feature-reports';
            if (normalized.includes('/components/utilities/')) return 'feature-utilities';
            if (normalized.includes('/components/receive-record/')) return 'feature-receive-record';
            if (normalized.includes('/components/receive-contract/')) return 'feature-contracts';
            return undefined;
          }

          if (/\/(react|react-dom)\//.test(normalized)) return 'vendor-react';
          if (normalized.includes('/lucide-react/')) return 'vendor-icons';
          if (normalized.includes('/xlsx-js-style/')) return 'vendor-xlsx';
          if (/\/(docx|docxtemplater|docx-preview|pizzip|jszip)\//.test(normalized)) return 'vendor-documents';
          if (normalized.includes('/recharts/')) return 'vendor-charts';
          if (normalized.includes('/html2canvas/')) return 'vendor-capture';
          if (normalized.includes('/@supabase/')) return 'vendor-supabase';
          if (normalized.includes('/@google/genai/')) return 'vendor-ai';
          return undefined;
        },
      },
    },
    // Các phân hệ xuất biểu mẫu được tải theo nhu cầu; ngưỡng này chỉ áp dụng cho chunk lazy.
    chunkSizeWarningLimit: 1200,
  },
  server: {
    port: 5173,
  },
});
