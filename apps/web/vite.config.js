import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      // Imports limpios: import { Button } from '@/components/ui/Button'
      '@':          path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages':     path.resolve(__dirname, './src/pages'),
      '@hooks':     path.resolve(__dirname, './src/hooks'),
      '@services':  path.resolve(__dirname, './src/services'),
      '@store':     path.resolve(__dirname, './src/store'),
      '@utils':     path.resolve(__dirname, './src/utils'),
      '@routes':    path.resolve(__dirname, './src/routes'),
    },
  },

  server: {
    port: 5173,
    host: true, // Escuchar en todas las interfaces (necesario para tunnel)
    proxy: {
      // Redirige /api/* → Node backend local
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },

  build: {
    outDir:    'dist',
    sourcemap: false, // true en desarrollo
    rollupOptions: {
      output: {
        // Code splitting por ruta para lazy loading
        manualChunks: {
          'vendor-react':  ['react', 'react-dom', 'react-router-dom'],
          'vendor-three':  ['three', '@react-three/fiber', '@react-three/drei'],
          'vendor-icons':  ['@phosphor-icons/react'],
        },
      },
    },
  },
})
