/**
 * Resolves Stitch HTML + image download URLs for a project/screen.
 * Requires STITCH_API_KEY (same value as X-Goog-Api-Key for Stitch MCP).
 */
import { stitch } from "@google/stitch-sdk";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const projectId = process.argv[2];
const screenId = process.argv[3];
const outDir = process.argv[4] ?? join(__dirname, "output");

if (!process.env.STITCH_API_KEY) {
  console.error("Set STITCH_API_KEY to your Stitch / X-Goog-Api-Key value.");
  process.exit(1);
}
if (!projectId || !screenId) {
  console.error("Usage: node fetch-screen.mjs <projectId> <screenId> [outDir]");
  process.exit(1);
}

const project = stitch.project(projectId);
const screen = await project.getScreen(screenId);
const htmlUrl = await screen.getHtml();
const imageUrl = await screen.getImage();

await mkdir(outDir, { recursive: true });
const meta = {
  projectId,
  screenId,
  screenTitle: screen.title ?? null,
  htmlUrl,
  imageUrl,
};
const base = "settings-profile";
await writeFile(
  join(outDir, `${base}-urls.json`),
  JSON.stringify(meta, null, 2),
  "utf8"
);
console.log(JSON.stringify(meta, null, 2));
console.log(`\nWrote ${join(outDir, `${base}-urls.json`)}`);
console.log("Next: curl -L -o ... (see commands printed by shell step)");
