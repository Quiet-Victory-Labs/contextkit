import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import path from 'node:path';

const preactDir = path.resolve(__dirname, 'node_modules/preact');

export default defineConfig({
  plugins: [preact({ reactAliasesEnabled: false })],
  root: path.resolve(__dirname, 'src/client'),
  build: {
    outDir: path.resolve(__dirname, 'static'),
    emptyOutDir: false,
    rollupOptions: {
      input: path.resolve(__dirname, 'src/client/main.tsx'),
      output: {
        entryFileNames: 'app.js',
        format: 'iife',
      },
    },
  },
  resolve: {
    alias: {
      'react/jsx-runtime': path.join(preactDir, 'jsx-runtime'),
      'react/jsx-dev-runtime': path.join(preactDir, 'jsx-runtime'),
      'react-dom/test-utils': path.join(preactDir, 'test-utils'),
      'react-dom': path.join(preactDir, 'compat'),
      'react': path.join(preactDir, 'compat'),
    },
  },
});
