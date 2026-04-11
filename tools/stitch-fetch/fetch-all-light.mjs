/**
 * Fetch all light mode screens from Stitch project
 */
import { stitch } from "@google/stitch-sdk";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);
const __dirname = dirname(fileURLToPath(import.meta.url));

const projectId = "10221855655024718038";
const screens = [
  { id: "asset-stub-assets-4b25847b1abd493ea41aaa2d709bb918-1775929585383", name: "design-system" },
  { id: "3169489c3d624e2494116417928f5dc7", name: "global-dashboard-light" },
  { id: "ea212ab2d8584f0b96fc5399fae1b3d6", name: "resource-management-light" },
  { id: "7688ed8b58a245bb8d916b159166ae1d", name: "analytics-logs-light" },
  { id: "4274e04472b8468fbe6c8160b6aaa0f0", name: "settings-profile-light" },
];

if (!process.env.STITCH_API_KEY) {
  console.error("Set STITCH_API_KEY environment variable");
  process.exit(1);
}

const outDir = join(__dirname, "output", "light-mode");
await mkdir(outDir, { recursive: true });

const project = stitch.project(projectId);

for (const screenInfo of screens) {
  console.log(`\n📥 Fetching: ${screenInfo.name} (${screenInfo.id})`);
  
  try {
    const screen = await project.getScreen(screenInfo.id);
    const htmlUrl = await screen.getHtml();
    const imageUrl = await screen.getImage();
    
    const meta = {
      projectId,
      screenId: screenInfo.id,
      screenName: screenInfo.name,
      screenTitle: screen.title ?? null,
      htmlUrl,
      imageUrl,
    };
    
    // Save metadata
    const metaPath = join(outDir, `${screenInfo.name}-urls.json`);
    await writeFile(metaPath, JSON.stringify(meta, null, 2), "utf8");
    console.log(`✅ Metadata: ${metaPath}`);
    
    // Download HTML
    const htmlPath = join(outDir, `${screenInfo.name}.html`);
    console.log(`   Downloading HTML...`);
    await execAsync(`curl -L -o "${htmlPath}" "${htmlUrl}"`);
    console.log(`✅ HTML: ${htmlPath}`);
    
    // Download image
    const imagePath = join(outDir, `${screenInfo.name}.png`);
    console.log(`   Downloading image...`);
    await execAsync(`curl -L -o "${imagePath}" "${imageUrl}"`);
    console.log(`✅ Image: ${imagePath}`);
    
  } catch (error) {
    console.error(`❌ Failed to fetch ${screenInfo.name}:`, error.message);
  }
}

console.log("\n🎉 All light mode screens fetched!");
