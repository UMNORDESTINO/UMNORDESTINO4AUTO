import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'fs-extra';
import JavaScriptObfuscator from 'javascript-obfuscator';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIST = path.join(ROOT, 'dist');

// Own source files to obfuscate. Third-party libs (jquery, socket.io client)
// are copied as-is: obfuscating them adds no value and risks breaking them.
const JS_TO_OBFUSCATE = [
  'background.js',
  'content.js',
  'content-script.js',
  'inject.js',
  'lib/tools-notifications.js',
  'lib/bot-logic.js',
  'lib/license-config.mjs',
  'lib/update-service.js',
  'lib/settimeout-hook.js',
  'lib/gold-farm.js',
  'lib/update-feed.mjs',
  'lib/tools-text.js',
  'lib/replayer.js',
  'lib/tools-controller.js',
  'lib/license-client.js',
  'popup/tools.js',
  'popup/updates.js',
  'popup/i18n.js',
  'popup/nav.js',
  'popup/gold.js',
  'popup/home.js',
  'popup/settings.js',
  'popup/shared.js',
];

const OBFUSCATOR_OPTIONS = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.75,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.4,
  identifierNamesGenerator: 'hexadecimal',
  numbersToExpressions: true,
  simplify: true,
  splitStrings: true,
  splitStringsChunkLength: 8,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.75,
  transformObjectKeys: true,
  unicodeEscapeSequence: false,
};

const SKIP_TOP_LEVEL = ['dist', 'node_modules', 'scripts', 'tests', '.git', 'package.json', 'package-lock.json'];

async function main() {
  await fs.remove(DIST);
  await fs.ensureDir(DIST);

  const entries = await fs.readdir(ROOT);
  for (const entry of entries) {
    if (SKIP_TOP_LEVEL.includes(entry)) continue;
    await fs.copy(path.join(ROOT, entry), path.join(DIST, entry));
  }

  for (const relPath of JS_TO_OBFUSCATE) {
    const srcFile = path.join(ROOT, relPath);
    const outFile = path.join(DIST, relPath);
    if (!(await fs.pathExists(srcFile))) {
      console.warn(`skip (not found): ${relPath}`);
      continue;
    }
    const code = await fs.readFile(srcFile, 'utf8');
    const obfuscated = JavaScriptObfuscator.obfuscate(code, OBFUSCATOR_OPTIONS).getObfuscatedCode();
    await fs.outputFile(outFile, obfuscated, 'utf8');
    console.log(`obfuscated: ${relPath}`);
  }

  console.log(`\nBuild pronto em ${path.relative(ROOT, DIST)}/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
