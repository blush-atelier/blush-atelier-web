import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    plugins: [react()],
    define: {
      __API_BASE_URL__: JSON.stringify(env.VITE_API_BASE_URL || ''),
      __WOMPI_WIDGET_URL__: JSON.stringify(env.VITE_WOMPI_WIDGET_URL || ''),
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': { target: 'http://127.0.0.1:3000', changeOrigin: true },
      },
    },
    preview: { port: 4173, strictPort: true },
  };
});
