import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/tasks': 'http://localhost:3000',
      '/agent': 'http://localhost:3000',
      '/sync': 'http://localhost:3000',
    },
  },
});
