// vite.config.ts
import { resolve } from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

/**
 * Serve demo/index.html at "/" so `npm run preview` lands straight on the demo
 * editor instead of a directory listing. The demo still imports /src/index.ts,
 * so the project root stays the vite root.
 */
const demoAtRoot = {
  name: 'flyo-demo-at-root',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      if (req.url === '/' || req.url === '/index.html') {
        req.url = '/demo/index.html';
      }
      next();
    });
  },
};

// https://vitejs.dev/guide/build.html#library-mode
export default defineConfig({
  // vitest only owns the unit tests; /e2e belongs to playwright.
  test: {
    include: ['src/**/*.test.ts'],
  },
  server: {
    port: 5174,
    strictPort: true,
    host: true,
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'nitroJsBridge',
      fileName: 'nitro-js-bridge',
    },
  },
  plugins: [demoAtRoot, dts()],
});
