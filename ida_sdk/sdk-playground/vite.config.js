import { defineConfig } from 'vite';
import { createRequire } from 'node:module';

// Stamp the SDK version into the bundle at build time. A deployed playground
// then says which SDK it was built against — without this the badge is a
// hand-edited literal that goes stale silently, which is exactly how a bundle
// built against 1.2.0 ended up claiming to be current.
const sdkVersion = createRequire(import.meta.url)('@myida/sdk/package.json').version;

export default defineConfig({
  server: { port: 5174 },
  // The SDK is a local file: dependency; let Vite pre-bundle it and ethers.
  optimizeDeps: { include: ['@myida/sdk', 'ethers'] },
  define: { __SDK_VERSION__: JSON.stringify(sdkVersion) },
});
