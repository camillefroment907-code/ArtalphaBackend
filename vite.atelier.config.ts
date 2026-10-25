import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({plugins:[react()],build:{outDir:'dist-atelier',rollupOptions:{input:'atelier.html'}},server:{host:'0.0.0.0'}});
