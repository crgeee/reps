import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const pkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf-8'));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-router': ['react-router'],
          'vendor-dnd': ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
          'vendor-icons': ['lucide-react'],
        },
      },
    },
  },
  server: {
    proxy: {
      '/tasks': 'http://localhost:3000',
      '/agent': 'http://localhost:3000',
      '/sync': 'http://localhost:3000',
      '/auth': 'http://localhost:3000',
      '/collections': 'http://localhost:3000',
      '/templates': 'http://localhost:3000',
      '/tags': 'http://localhost:3000',
      '/stats': 'http://localhost:3000',
      '/users': 'http://localhost:3000',
      '/export': 'http://localhost:3000',
      '/health': 'http://localhost:3000',
    },
  },
});
