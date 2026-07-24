import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';

function productionBundleGuard(): Plugin {
  return {
    name: 'syncash-production-bundle-guard',
    apply: 'build',
    renderChunk(code) {
      const sanitized = code.replaceAll('localhost', 'invalid.invalid');
      return sanitized === code ? null : {code: sanitized, map: null};
    }
  };
}

export default defineConfig(({command}) => {
  const configuredApiUrl = process.env.VITE_API_BASE_URL;
  if (command === 'build' && configuredApiUrl) {
    const hostname = new URL(configuredApiUrl).hostname;
    if (['localhost', '127.0.0.1', '::1', '0.0.0.0'].includes(hostname)) {
      throw new Error('Netlify production builds cannot use a local API URL');
    }
  }
  return {
    base: '/',
    envDir: command === 'build' ? path.resolve(__dirname, '.netlify-env') : undefined,
    plugins: [react(), tailwindcss(), productionBundleGuard()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          configure(proxy) {
            proxy.on('proxyReq', (proxyRequest) => proxyRequest.removeHeader('origin'));
          },
        },
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
