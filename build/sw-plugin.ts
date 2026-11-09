import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { Plugin } from 'vite';

/** iOS reads splash images only at install time, so they are not worth precaching. */
const EXCLUDE = [/^sw\.js$/, /^splash\//, /\.map$/, /\.DS_Store$/];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

/**
 * Generates dist/sw.js from src/sw.template.js after the bundle is written,
 * so the precache list and the cache version always match the real output.
 */
export function serviceWorker(): Plugin {
  let outDir = 'dist';
  return {
    name: 'tally-service-worker',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    writeBundle() {
      const files = walk(outDir)
        .map((file) => ({ file, url: relative(outDir, file).split(sep).join('/') }))
        .filter(({ url }) => !EXCLUDE.some((re) => re.test(url)))
        .sort((a, b) => a.url.localeCompare(b.url));

      const hash = createHash('sha256');
      for (const { file, url } of files) hash.update(url).update(readFileSync(file));
      const version = hash.digest('hex').slice(0, 12);

      const source = readFileSync('src/sw.template.js', 'utf8')
        .replace('__VERSION__', version)
        .replace('__ASSETS__', JSON.stringify(['./', ...files.map((f) => f.url)]));
      writeFileSync(join(outDir, 'sw.js'), source);
    },
  };
}
