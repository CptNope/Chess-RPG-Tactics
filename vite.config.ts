import { defineConfig } from 'vite';

// https://vitejs.dev/config/
import pkg from './package.json';

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  base: './', // Ensures assets load correctly on GitHub Pages under any subpath
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three']
        }
      }
    }
  }
});
