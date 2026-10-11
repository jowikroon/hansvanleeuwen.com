import { copyFileSync, existsSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const dest = resolve(repoRoot, "src/content/master-workflow.html");

const defaultSource = resolve(
  process.env.USERPROFILE || process.env.HOME || "",
  "Downloads/Workflows & Automation/master_workflow_v2 (1).html",
);

const source = process.env.MASTER_WORKFLOW_SOURCE || defaultSource;

if (!existsSync(source)) {
  console.error(`Source not found: ${source}`);
  console.error("Set MASTER_WORKFLOW_SOURCE to your master_workflow_v2 HTML file.");
  process.exit(1);
}

copyFileSync(source, dest);
console.log(`Synced master workflow:\n  from ${source}\n  to   ${dest}`);
