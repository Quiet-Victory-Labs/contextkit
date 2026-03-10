import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import path from 'node:path';

export default defineConfig({
  plugins: [preact()],
  root: path.resolve(__dirname, 'src/client'),
  build: {
    outDir: path.resolve(__dirname, 'static'),
    emptyOutDir: false,
    rollupOptions: {
      input: path.resolve(__dirname, 'src/client/main.tsx'),
      output: {
        entryFileNames: 'setup.js',
        format: 'iife',
      },
    },
  },
  resolve: {
    alias: {
      'react': 'preact/compat',
      'react-dom': 'preact/compat',
      'react/jsx-runtime': 'preact/jsx-runtime',
    },
  },
});
