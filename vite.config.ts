
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      // Externalize React and React-DOM to use from CDN via importmap
      external: [
        'react',
        'react-dom',
        'react-dom/client'
      ],
    },
  },
});
