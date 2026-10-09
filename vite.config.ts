import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command, isPreview }) => ({
  // O servidor publica o projeto em /MEJ-AI-INTERFACE/, não na raiz do domínio.
  // `vite preview` roda com command === 'serve'; sem incluir isPreview aqui ele
  // serviria em '/' enquanto o index.html gerado aponta para /MEJ-AI-INTERFACE/,
  // e o preview devolveria o fallback de SPA no lugar de cada asset — ou seja,
  // não serviria para conferir o subdiretório, que é justamente o seu papel.
  base: command === 'build' || isPreview ? '/MEJ-AI-INTERFACE/' : '/',
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'https://projetopdi.atlab.ufc.br/api',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
}))
