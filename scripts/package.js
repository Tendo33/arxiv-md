// {{RIPER-7 Action}}
// Role: LD | Task_ID: #8 | Time: 2025-12-01T21:18:25+08:00
// Logic: 打包脚本 - 将 dist 目录打包成 .zip 文件用于发布
// Principle: SOLID-S (Single Responsibility - 打包管理)

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const archiver = require("archiver");
const manifest = require("../src/manifest.json");

const DIST_DIR = path.join(__dirname, "../dist");
const OUTPUT_DIR = path.join(__dirname, "../build");
const OUTPUT_FILE = `arxiv-md-v${manifest.version}.zip`;

console.log("📦 Starting package process...");

// 确保 dist 目录存在
if (!fs.existsSync(DIST_DIR)) {
  console.error(
    "❌ Error: dist directory not found. Run `npm run build` first.",
  );
  process.exit(1);
}

// 创建 build 目录
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// 创建 ZIP 文件
const output = fs.createWriteStream(path.join(OUTPUT_DIR, OUTPUT_FILE));
const archive = archiver("zip", {
  zlib: { level: 9 },
});

output.on("close", () => {
  const sizeInMB = (archive.pointer() / 1024 / 1024).toFixed(2);
  console.log(`✅ Package created: ${OUTPUT_FILE}`);
  console.log(`📊 Size: ${sizeInMB} MB`);
  console.log(`📁 Location: ${path.join(OUTPUT_DIR, OUTPUT_FILE)}`);
});

archive.on("error", (err) => {
  console.error("❌ Error creating package:", err);
  process.exit(1);
});

archive.pipe(output);
archive.directory(DIST_DIR, false);
archive.finalize();
