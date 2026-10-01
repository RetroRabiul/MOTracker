import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, "..");

const apkSource = path.join(
  projectRoot,
  "android",
  "app",
  "build",
  "outputs",
  "apk",
  "debug",
  "app-debug.apk",
);

/**
 * An APK published into `public/` is copied into `dist/` by the next
 * `vite build`, and from `dist/` into the Android assets by the next
 * `cap sync` - so the build after that embeds an APK inside an APK, and the
 * file grows on every cycle.
 *
 * Publishing and packaging are therefore separate steps:
 *   node scripts/copy-apk.js clean     (default, wired to `postbuild`)
 *     removes every published copy so nothing can be packaged back in
 *   node scripts/copy-apk.js publish   (wired to `android:publish`)
 *     copies the freshly built APK out for the web download link
 */
const mode = process.argv[2] ?? "clean";

const publishedCopies = [
  path.join(projectRoot, "public", "app.apk"),
  path.join(projectRoot, "public", "app-debug.apk"),
  path.join(projectRoot, "dist", "app.apk"),
  path.join(projectRoot, "android", "app", "src", "main", "assets", "public", "app.apk"),
  path.join(projectRoot, "android", "app", "src", "main", "assets", "public", "app-debug.apk"),
];

function relative(target) {
  return path.relative(projectRoot, target);
}

function removePublishedCopies() {
  let removed = 0;
  for (const target of publishedCopies) {
    if (!fs.existsSync(target)) continue;
    fs.rmSync(target);
    console.log(`Removed published APK: ${relative(target)}`);
    removed += 1;
  }
  return removed;
}

try {
  if (mode === "clean") {
    if (removePublishedCopies() === 0) {
      console.log("No published APK copies to clean.");
    }
    process.exit(0);
  }

  if (mode !== "publish") {
    console.error(`Unknown mode "${mode}". Use "clean" or "publish".`);
    process.exit(1);
  }

  if (!fs.existsSync(apkSource)) {
    console.log(`APK not found at ${relative(apkSource)}. Skipping publish.`);
    process.exit(0);
  }

  // Publish last, so the next build's `clean` step has something to remove and
  // the Android assets never contain an APK.
  for (const target of [
    path.join(projectRoot, "public", "app.apk"),
    path.join(projectRoot, "dist", "app.apk"),
  ]) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(apkSource, target);
    console.log(`Published APK to ${relative(target)}`);
  }
} catch (err) {
  console.error("Failed to handle APK:", err);
  process.exit(1);
}
