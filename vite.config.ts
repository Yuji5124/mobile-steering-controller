import { defineConfig } from 'vite';
export default defineConfig(({ command }) => ({
  base: process.env.VITE_BASE_PATH || (command === 'build' ? '/mobile-steering-controller/' : '/'),
  server: { host: '0.0.0.0', port: 5174, strictPort: true },
}));
