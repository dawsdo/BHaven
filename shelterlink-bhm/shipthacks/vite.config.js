import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The React dev server forwards /api calls to the Express server on port 3001.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': 'http://localhost:3001' }
  }
});
