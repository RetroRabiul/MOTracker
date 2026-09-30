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
const apkDest = path.join(projectRoot, "public", "app.apk");

try {
  if (!fs.existsSync(apkSource)) {
    console.log(`APK not found at ${apkSource}. Skipping copy.`);
    process.exit(0);
  }

  fs.mkdirSync(path.dirname(apkDest), { recursive: true });
  fs.copyFileSync(apkSource, apkDest);
  console.log(`Copied APK to ${apkDest}`);
} catch (err) {
  console.error("Failed to copy APK:", err);
  process.exit(1);
}
