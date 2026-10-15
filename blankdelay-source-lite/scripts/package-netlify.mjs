// Builds the drag-and-drop Netlify folder: dist/ plus self-contained functions, since Netlify Drop installs no packages.
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { build } from 'esbuild'

const root = resolve(import.meta.dirname, '..')
const out = resolve(process.argv[2] || join(root, 'netlify-upload'))
const functionsIn = join(root, 'netlify', 'functions')
const functionsOut = join(out, 'netlify', 'functions')

await rm(out, { recursive: true, force: true })
await cp(join(root, 'dist'), out, { recursive: true })
await mkdir(functionsOut, { recursive: true })

for (const name of await readdir(functionsIn)) {
  if (name.startsWith('_') || !/\.(m?js)$/.test(name)) continue
  const esm = name.endsWith('.mjs')
  await build({
    entryPoints: [join(functionsIn, name)],
    outfile: join(functionsOut, name),
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: esm ? 'esm' : 'cjs',
    banner: esm ? { js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);" } : undefined,
    logLevel: 'warning',
  })
}

const toml = await readFile(join(root, 'netlify.toml'), 'utf8')
await writeFile(join(out, 'netlify.toml'), toml.replace(/\[build\][\s\S]*?(?=\[\[redirects\]\])/, ''))
console.log(`Netlify upload folder: ${out}`)
