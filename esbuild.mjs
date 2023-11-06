import * as esbuild from 'esbuild'
import fs from 'fs'

const excludeVendorFromSourceMapPlugin = {
  name: 'excludeVendorFromSourceMap',
  setup(build) {
    build.onLoad({ filter: /node_modules/ }, args => {
      return {
        contents: fs.readFileSync(args.path, 'utf8')
          + '\n//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIiJdLCJtYXBwaW5ncyI6IkEifQ==',
        loader: 'default',
      }
    })
  },
}

await esbuild.build({
  entryPoints: ['src/main.ts', 'src/post.ts'],
  bundle: true,
  outdir: 'dist',
  platform: 'node',
  target: ['node20'],
  plugins: [excludeVendorFromSourceMapPlugin],
  sourcemap: true,
  format: 'esm',
  splitting: true,
  logLevel: 'info',
  outExtension: { '.js': '.mjs' }
});
