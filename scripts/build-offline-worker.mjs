import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";

const out = resolve("out");
const staticAssets = await readdir(join(out, "_next/static"), {
  recursive: true,
  withFileTypes: true,
});
const shellFiles = [
  "index.html",
  "manifest.webmanifest",
  "brand/levelgrid-mark.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/maskable-512.png",
  ...staticAssets
    .filter((asset) => asset.isFile() && !asset.name.endsWith(".map"))
    .map((asset) => relative(out, join(asset.parentPath, asset.name)).split(sep).join("/")),
].sort();

const worker = String.raw`
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      await cache.addAll(APP_FILES.map((url) => new Request(url, { cache: "reload" })));
    } catch (error) {
      await caches.delete(CACHE_NAME);
      throw error;
    }
    // Activate only after the entire new shell can open offline.
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const oldCaches = (await caches.keys()).filter(
      (name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME
    );
    // Older open pages can still request their own hashed assets.
    await Promise.all(oldCaches.slice(0, -2).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  const currentAsset = APP_FILE_PATHS.has(url.pathname);
  if (!currentAsset && !url.pathname.startsWith("/_next/static/")) return;

  event.respondWith((async () => {
    const cached = currentAsset
      ? await caches.match(url.pathname, { cacheName: CACHE_NAME })
      : await caches.match(url.pathname);
    return cached ?? fetch(request);
  })());
});
`;

const revision = createHash("sha256").update(worker);
for (const file of shellFiles) {
  revision.update(file);
  revision.update(await readFile(join(out, file)));
}

const appFiles = shellFiles.map((file) => file === "index.html" ? "/" : "/" + file);
const source = [
  'const CACHE_PREFIX = "levelgrid-finance-";',
  "const CACHE_NAME = CACHE_PREFIX + " + JSON.stringify(revision.digest("hex").slice(0, 20)) + ";",
  "const APP_FILES = " + JSON.stringify(appFiles) + ";",
  "const APP_FILE_PATHS = new Set(APP_FILES);",
  worker,
].join("\n");

await writeFile(join(out, "sw.js"), source);
console.log("Prepared the offline shell with " + appFiles.length + " cached files.");
