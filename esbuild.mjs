import * as esbuild from 'esbuild'
import fs from 'fs'

await esbuild.build({
  entryPoints: ['src/main.ts', 'src/post.ts'],
  bundle: true,
  outdir: 'dist',
  platform: 'node',
  target: ['node20'],
  logLevel: 'info',
});
