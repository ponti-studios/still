import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Served through the portless proxy as https://still.lvh.me, so accept that host.
export default defineConfig({
  plugins: [react()],
  server: { allowedHosts: ['.lvh.me'] },
});
