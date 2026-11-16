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
  // Keep the shell and its hashed assets from the same build.
  event.waitUntil(caches.open(CACHE_NAME).then((cache) =>
    cache.addAll(APP_FILES.map((url) => new Request(url, { cache: "reload" })))
  ));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const oldCaches = (await caches.keys()).filter(
      (name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME
    );
    await Promise.all(oldCaches.map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (!APP_FILE_PATHS.has(url.pathname)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(url.pathname);
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
