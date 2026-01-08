
import { defineConfig } from 'vite';

export default defineConfig({
  define: {
    // This bridges the Vercel API_KEY environment variable to the client side.
    // It ensures that 'process.env.API_KEY' is replaced with your actual key during the build.
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY)
  },
  build: {
    rollupOptions: {
      // We mark these as external so Vite doesn't try to bundle them.
      // They will be resolved at runtime by the browser via the importmap in index.html.
      external: ['@google/genai', 'react', 'react-dom', 'recharts'],
    },
  },
});
