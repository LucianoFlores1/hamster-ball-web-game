import { defineConfig } from 'vite';

// SDK de cada plataforma: se inyecta como PRIMER <script> solo en su build.
// El build por defecto (local/itch.io/CrazyGames básico) no hace ninguna llamada externa.
const SDKS = {
  youtube: 'https://www.youtube.com/game_api/v1',
  crazygames: 'https://sdk.crazygames.com/crazygames-sdk-v3.js',
};

export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [
    {
      name: 'platform-sdk',
      transformIndexHtml(html) {
        const src = SDKS[mode];
        if (!src) return html;
        return { html, tags: [{ tag: 'script', attrs: { src }, injectTo: 'head-prepend' }] };
      },
    },
  ],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 800,
  },
}));
