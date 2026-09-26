import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true, // expose on the local network (accessible from tablet/phone)
    port: 5174,
    strictPort: true,
    // API calls go through this same origin (/api) and Vite forwards them to the
    // backend — no CORS, no mixed content. For Web Bluetooth on the tablet, mark
    // this origin as secure in Chrome (chrome://flags → "Insecure origins treated
    // as secure" → add http://192.168.0.107:5174).
    proxy: {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
    },
  },
});
