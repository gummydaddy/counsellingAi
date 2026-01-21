
import { defineConfig } from 'vite';

export default defineConfig({
  define: {
    // This strictly replaces the 'process.env.API_KEY' string in your code with the actual key value
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || ''),
    'process.env.NODE_ENV': JSON.stringify('production')
  },
  build: {
    rollupOptions: {
      // These match the importmap in index.html exactly to ensure the browser handles resolution
      external: [
        'react',
        'react-dom',
        'react-dom/client',
        'recharts'
      ],
    },
  },
});
