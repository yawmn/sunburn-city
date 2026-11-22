import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const ROOT_DIR = fileURLToPath(new URL('.', import.meta.url));
const SOURCE_GAME = join(ROOT_DIR, 'game');
const SOURCE_SCREENSHOTS = join(ROOT_DIR, 'screenshots');
const VENDOR_ENTRY = join(ROOT_DIR, 'vendor', 'makefun-game.ts');
const MAIN_HTML = join(SOURCE_GAME, 'index.html');

const GAME_FILES_LIMIT = 993;
const GAME_BYTES_LIMIT = 50331648;
const SCREENSHOT_BYTES_LIMIT = 262144;
const MIN_SCREENSHOT_COUNT = 3;
const MAX_SCREENSHOT_COUNT = 4;
const VALID_IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png']);

interface FileMeta {
  path: string;
  size: number;
}

function verifyPrerequisites(): void {
  if (!existsSync(MAIN_HTML)) {
    throw new Error(`Required file missing: ${MAIN_HTML} does not exist.`);
  }
  if (!existsSync(VENDOR_ENTRY)) {
    throw new Error(`Required vendor library missing: ${VENDOR_ENTRY} does not exist.`);
  }
  if (!existsSync(SOURCE_SCREENSHOTS)) {
    throw new Error(`Screenshot directory missing: ${SOURCE_SCREENSHOTS} does not exist.`);
  }
}

function inspectScreenshots(): FileMeta[] {
  const entries = readdirSync(SOURCE_SCREENSHOTS, { withFileTypes: true });
  const images: FileMeta[] = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const ext = extname(entry.name).toLowerCase();
    if (!VALID_IMAGE_EXTS.has(ext)) {
      throw new Error(`Invalid screenshot extension '${ext}' for ${entry.name}. Allowed: .jpg, .jpeg, .png`);
    }
    const fullPath = join(SOURCE_SCREENSHOTS, entry.name);
    const sz = statSync(fullPath).size;
    if (sz > SCREENSHOT_BYTES_LIMIT) {
      throw new Error(`Screenshot ${entry.name} exceeds size limit: ${sz} bytes > ${SCREENSHOT_BYTES_LIMIT} bytes.`);
    }
    images.push({ path: entry.name, size: sz });
  }

  if (images.length < MIN_SCREENSHOT_COUNT || images.length > MAX_SCREENSHOT_COUNT) {
    throw new Error(`Expected between ${MIN_SCREENSHOT_COUNT} and ${MAX_SCREENSHOT_COUNT} screenshots, but found ${images.length}.`);
  }

  return images;
}

function inspectGameTree(dir: string): { files: FileMeta[]; totalBytes: number; topFiles: FileMeta[] } {
  const files: FileMeta[] = [];
  let totalBytes = 0;

  function traverse(current: string): void {
    const items = readdirSync(current, { withFileTypes: true });
    for (const item of items) {
      const full = join(current, item.name);
      if (item.isDirectory()) {
        traverse(full);
      } else if (item.isFile()) {
        const sz = statSync(full).size;
        const rel = relative(SOURCE_GAME, full);
        files.push({ path: rel, size: sz });
        totalBytes += sz;
      }
    }
  }

  traverse(dir);

  if (files.length > GAME_FILES_LIMIT) {
    throw new Error(`Exceeded maximum game file count: ${files.length} > ${GAME_FILES_LIMIT}`);
  }
  if (totalBytes > GAME_BYTES_LIMIT) {
    throw new Error(`Exceeded maximum game byte size: ${totalBytes} > ${GAME_BYTES_LIMIT}`);
  }

  const topFiles = [...files].sort((a, b) => b.size - a.size).slice(0, 3);

  return { files, totalBytes, topFiles };
}

function run(): void {
  const checkOnly = process.argv.includes('--check-only');
  verifyPrerequisites();

  const screenshotItems = inspectScreenshots();
  const gameInfo = inspectGameTree(SOURCE_GAME);
  const topListFormatted = gameInfo.topFiles.map((f, i) => `#${i + 1} ${f.path} (${f.size} B)`).join(', ');

  if (checkOnly) {
    console.log(
      `Check passed (--check-only): ${gameInfo.files.length} game files (${gameInfo.totalBytes} bytes), ` +
      `${screenshotItems.length} screenshots. 3 largest files: ${topListFormatted}.`
    );
    return;
  }

  const destinationDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';
  const destGame = join(destinationDir, 'game');
  const destScreenshots = join(destinationDir, 'screenshots');
  const destDossier = join(destinationDir, 'dossier.json');

  mkdirSync(destinationDir, { recursive: true });
  cpSync(SOURCE_GAME, destGame, { recursive: true });
  cpSync(SOURCE_SCREENSHOTS, destScreenshots, { recursive: true });

  const dossierPayload = buildDossier(destinationDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: SCREENSHOT_BYTES_LIMIT },
    game_max_files: GAME_FILES_LIMIT,
    game_max_bytes: GAME_BYTES_LIMIT,
    game_path_max_bytes: 1000,
  });

  writeFileSync(destDossier, dossierPayload);

  console.log(
    `Package built successfully: ${gameInfo.files.length} game files (${gameInfo.totalBytes} bytes), ` +
    `${screenshotItems.length} screenshots, dossier ${dossierPayload.byteLength} bytes. ` +
    `3 largest files: ${topListFormatted}.`
  );
}

run();
