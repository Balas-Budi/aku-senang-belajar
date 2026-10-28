import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    plugins: [react(), tailwindcss()],
    server: { port: 4200, proxy: { '/api': 'http://127.0.0.1:3000' } },
    build: { outDir: '../../dist/frontend', emptyOutDir: true },
});
