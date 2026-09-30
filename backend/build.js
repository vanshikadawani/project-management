import * as esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const entryPoint = path.resolve(__dirname, 'src/server.ts');
const distOutput = path.resolve(__dirname, 'dist/server.js');
const apiOutput = path.resolve(__dirname, 'api/index.js');

async function build() {
  console.log('[Build] Compiling backend from:', entryPoint);

  const commonOptions = {
    entryPoints: [entryPoint],
    bundle: true,
    platform: 'node',
    format: 'esm',
    packages: 'external',
    sourcemap: true,
  };

  // Build for standalone dist/server.js
  await esbuild.build({
    ...commonOptions,
    outfile: distOutput,
  });
  console.log('  ✔ Created:', distOutput);

  // Build for Vercel serverless api/index.js
  await esbuild.build({
    ...commonOptions,
    outfile: apiOutput,
  });
  console.log('  ✔ Created:', apiOutput);

  console.log('[Build] Backend compilation finished successfully.\n');
}

build().catch((err) => {
  console.error('[Build] Failed to build backend:', err);
  process.exit(1);
});
