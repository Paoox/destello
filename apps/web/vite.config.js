import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  // Carga variables de .env (incluye las que NO empiezan con VITE_)
  const env = loadEnv(mode, process.cwd(), '')

  // URL del backend: prioridad .env > variable de entorno del sistema > localhost
  const apiTarget = env.VITE_API_URL || env.API_URL || 'http://localhost:3001'

  return {
    plugins: [react()],

    resolve: {
      alias: {
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
      host: true,
      proxy: {
        '/api': {
          target: apiTarget,
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
  } // cierra return
})