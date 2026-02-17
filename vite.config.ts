
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      // These match the importmap in index.html exactly to ensure the browser handles resolution
      external: [
        'recharts'
      ],
    },
  },
});
