import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
const passes = [];

function pass(message) {
  passes.push(message);
}

function fail(message) {
  failures.push(message);
}

async function fileExists(relativePath) {
  try {
    return (await stat(path.join(ROOT, relativePath))).isFile();
  } catch {
    return false;
  }
}

function parsePngSize(buffer) {
  const signature = "89504e470d0a1a0a";
  if (buffer.subarray(0, 8).toString("hex") !== signature) return null;

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    colorType: buffer[25],
  };
}

const requiredFiles = [
  "index.html",
  "manifest.webmanifest",
  "sw.js",
  "assets/app.js",
  "assets/date.js",
  "assets/styles.css",
  "icons/icon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "icons/apple-touch-icon.png",
  "icons/favicon-32.png",
];

for (const relativePath of requiredFiles) {
  if (await fileExists(relativePath)) {
    pass(`文件存在：${relativePath}`);
  } else {
    fail(`缺少文件：${relativePath}`);
  }
}

const html = await readFile(path.join(ROOT, "index.html"), "utf8");
const requiredHtmlFragments = [
  ['rel="manifest" href="./manifest.webmanifest"', "manifest 链接"],
  ['rel="apple-touch-icon"', "Apple 主屏幕图标"],
  ['name="apple-mobile-web-app-capable" content="yes"', "iOS 全屏标记"],
  ['name="apple-mobile-web-app-title" content="小满"', "iOS 名称"],
  ["viewport-fit=cover", "安全区适配"],
  ['name="theme-color"', "主题色"],
  ['http-equiv="Content-Security-Policy"', "内容安全策略"],
];

for (const [fragment, label] of requiredHtmlFragments) {
  if (html.includes(fragment)) pass(`HTML 包含${label}`);
  else fail(`HTML 缺少${label}`);
}

if (!/<script\s+type="module"\s+src="\.\/assets\/app\.js"/.test(html)) {
  fail("入口脚本不是本地 module");
} else {
  pass("入口脚本为本地 module");
}

const externalAssets = [...html.matchAll(/(?:src|href)="(https?:\/\/[^"]+)"/g)];
if (externalAssets.length > 0) {
  fail(`存在外部资源依赖：${externalAssets.map((match) => match[1]).join(", ")}`);
} else {
  pass("无外部资源依赖，可完全离线");
}

const startupLinks = [...html.matchAll(/rel="apple-touch-startup-image" href="\.\/([^"]+)"/g)].map(
  (match) => match[1],
);

if (startupLinks.length >= 10) {
  pass(`已配置 ${startupLinks.length} 张 iPhone 启动图`);
} else {
  fail("iPhone 启动图数量不足");
}

for (const relativePath of startupLinks) {
  if (!(await fileExists(relativePath))) {
    fail(`启动图不存在：${relativePath}`);
  }
}

let manifest = null;

try {
  manifest = JSON.parse(
    await readFile(path.join(ROOT, "manifest.webmanifest"), "utf8"),
  );
  pass("manifest 是有效 JSON");
} catch (error) {
  fail(`manifest 无法解析：${error.message}`);
}

if (manifest) {
  const checks = [
    [manifest.name?.includes("小满"), "manifest 应用名"],
    [manifest.start_url === "./", "manifest start_url"],
    [manifest.scope === "./", "manifest scope"],
    [manifest.display === "standalone", "manifest standalone 显示"],
    [manifest.orientation === "portrait-primary", "manifest 竖屏方向"],
    [manifest.lang === "zh-CN", "manifest 语言"],
    [Array.isArray(manifest.icons) && manifest.icons.length >= 3, "manifest 图标数量"],
    [Boolean(manifest.theme_color), "manifest 主题色"],
    [Boolean(manifest.background_color), "manifest 背景色"],
  ];

  for (const [ok, label] of checks) {
    if (ok) pass(label);
    else fail(`${label} 不符合要求`);
  }

  for (const icon of manifest.icons || []) {
    const iconPath = icon.src.replace(/^\.\//, "");

    if (!(await fileExists(iconPath))) {
      fail(`manifest 图标不存在：${icon.src}`);
      continue;
    }

    if (icon.sizes === "any" || !icon.type?.includes("png")) continue;

    const buffer = await readFile(path.join(ROOT, iconPath));
    const info = parsePngSize(buffer);
    const [width, height] = icon.sizes.split("x").map(Number);

    if (!info || info.width !== width || info.height !== height) {
      fail(`图标尺寸不符：${icon.src} 应为 ${icon.sizes}`);
    } else {
      pass(`图标尺寸正确：${icon.src}`);
    }
  }
}

for (const [relativePath, expectedSize] of [
  ["icons/apple-touch-icon.png", 180],
  ["icons/icon-192.png", 192],
  ["icons/icon-512.png", 512],
  ["icons/icon-maskable-512.png", 512],
  ["icons/favicon-32.png", 32],
]) {
  if (!(await fileExists(relativePath))) continue;

  const info = parsePngSize(await readFile(path.join(ROOT, relativePath)));

  if (!info || info.width !== expectedSize || info.height !== expectedSize) {
    fail(`${relativePath} 应为 ${expectedSize}×${expectedSize} PNG`);
  } else if (info.colorType === 4 || info.colorType === 6) {
    fail(`${relativePath} 不应带透明通道（iOS 主屏幕图标会变黑）`);
  } else {
    pass(`${relativePath} 为 ${expectedSize}px 不透明 PNG`);
  }
}

const serviceWorker = await readFile(path.join(ROOT, "sw.js"), "utf8");
const shellMatch = serviceWorker.match(/const APP_SHELL = \[([\s\S]*?)\];/);

if (!shellMatch) {
  fail("无法读取 service worker 的 APP_SHELL");
} else {
  const shellPaths = [...shellMatch[1].matchAll(/"\.\/(.*?)"/g)].map(
    (match) => match[1] || "index.html",
  );
  const uniqueShellPaths = new Set(shellPaths);

  if (uniqueShellPaths.size < requiredFiles.length - 1) {
    fail("离线缓存文件少于核心文件数量");
  } else {
    pass(`离线缓存声明 ${uniqueShellPaths.size} 个不重复资源`);
  }

  for (const relativePath of shellPaths) {
    if (!(await fileExists(relativePath))) {
      fail(`离线缓存中的文件不存在：${relativePath}`);
    }
  }
}

if (/const CACHE_VERSION = "[^"]+";/.test(serviceWorker)) {
  pass("service worker 版本号存在");
} else {
  fail("service worker 缺少版本号");
}

console.log(`\n小满工程检查：${passes.length} 项通过，${failures.length} 项失败\n`);

for (const failure of failures) {
  console.error(`✗ ${failure}`);
}

if (failures.length > 0) {
  process.exitCode = 1;
} else {
  console.log("✓ 所有静态工程检查通过");
}
