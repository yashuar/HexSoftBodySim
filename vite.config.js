import { defineConfig } from 'vite';
import { debugLoggerPlugin } from './vite-plugin-debug-logger.js';

export default defineConfig({
  plugins: [
    debugLoggerPlugin()
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    open: false,
  },
});
