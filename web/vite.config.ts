import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/tasks': 'http://localhost:3000',
      '/agent': 'http://localhost:3000',
      '/sync': 'http://localhost:3000',
    },
  },
});
