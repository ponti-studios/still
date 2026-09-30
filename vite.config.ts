import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Served through the portless proxy as https://still.lvh.me, so accept that host.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { allowedHosts: ['.lvh.me'] },
});
