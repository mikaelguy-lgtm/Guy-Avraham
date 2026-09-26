// בונה את האתר הציבורי (syncash.co.il) לקבצים סטטיים ב-marketing/dist.
// ללא framework: תבניות JS פשוטות -> HTML, CSS ו-JS מינימליים עם hash לשם הקובץ,
// robots.txt, sitemap.xml, 404 ו-manifest. הרצה: node marketing/build.mjs
/* global console */
import {createHash} from "node:crypto";
import {cp, mkdir, readdir, readFile, rm, writeFile} from "node:fs/promises";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";
import {pages, siteConfig} from "./src/pages.mjs";
import {renderPage} from "./src/layout.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const source = join(root, "src");
const dist = join(root, "dist");

function hashed(name, content) {
  const hash = createHash("sha256").update(content).digest("hex").slice(0, 10);
  const dot = name.lastIndexOf(".");
  return `${name.slice(0, dot)}.${hash}${name.slice(dot)}`;
}

await rm(dist, {recursive: true, force: true});
await mkdir(dist, {recursive: true});

// נכסים סטטיים (favicon, לוגו) וגופנים
await cp(join(source, "static"), dist, {recursive: true});
await mkdir(join(dist, "fonts"), {recursive: true});
for (const file of await readdir(join(source, "fonts"))) {
  if (file.endsWith(".woff2") || file === "OFL-NOTE.txt") await cp(join(source, "fonts", file), join(dist, "fonts", file));
}

// CSS/JS עם hash בשם הקובץ (nginx מגיש css/js כ-immutable לשנה)
const fontsCss = await readFile(join(source, "fonts", "fonts.css"), "utf8");
const siteCss = `${fontsCss}\n${await readFile(join(source, "site.css"), "utf8")}`;
const cssName = hashed("site.css", siteCss);
await writeFile(join(dist, cssName), siteCss);
const siteJs = await readFile(join(source, "site.js"), "utf8");
const jsName = hashed("site.js", siteJs);
await writeFile(join(dist, jsName), siteJs);

const assets = {css: `/${cssName}`, js: `/${jsName}`};

// עמודים
const urls = [];
for (const page of pages) {
  const html = renderPage(page, assets, siteConfig);
  const target = page.path === "/" ? join(dist, "index.html") : join(dist, page.path.replace(/^\/|\/$/g, ""), "index.html");
  await mkdir(dirname(target), {recursive: true});
  await writeFile(target, html);
  if (!page.noindex) urls.push({loc: `${siteConfig.baseUrl}${page.path}`, changefreq: page.changefreq ?? "monthly", priority: page.priority ?? "0.6", lastmod: page.lastmod ?? siteConfig.buildDate});
}

// 404 (מוגש על ידי nginx עם קוד 404 אמיתי)
const notFound = pages.find((page) => page.path === "/404/");
if (notFound) await writeFile(join(dist, "404.html"), renderPage({...notFound, path: "/404.html"}, assets, siteConfig));

await writeFile(join(dist, "robots.txt"), `# syncash.co.il — האתר הציבורי בלבד. האפליקציה (app.syncash.co.il) אינה מאונדקסת (X-Robots-Tag בשרת).
User-agent: *
Allow: /
Disallow: /404/

Sitemap: ${siteConfig.baseUrl}/sitemap.xml
`);

await writeFile(join(dist, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url><loc>${url.loc}</loc><lastmod>${url.lastmod}</lastmod><changefreq>${url.changefreq}</changefreq><priority>${url.priority}</priority></url>`).join("\n")}
</urlset>
`);

await writeFile(join(dist, "site.webmanifest"), JSON.stringify({
  name: "SynCash", short_name: "SynCash", description: siteConfig.description, lang: "he", dir: "rtl", start_url: "/", display: "browser",
  background_color: "#061128", theme_color: "#061128",
  icons: [{src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any"}, {src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable"}]
}, null, 2));

// שכבת הגנה: אין סקריפטים/פיקסלים של צד שלישי, אין כתובות פיתוח, אין ניסוח אסור
const forbidden = ["googletagmanager", "google-analytics", "gtag(", "facebook.net", "fbq(", "hotjar", "clarity.ms", "localhost", "127.0.0.1", "כל חברות המימון בישראל"];
for (const file of await readdir(dist, {recursive: true})) {
  if (!/\.(html|js|css|xml|txt)$/.test(file)) continue;
  const content = await readFile(join(dist, file), "utf8");
  for (const marker of forbidden) if (content.includes(marker)) throw new Error(`Forbidden marker "${marker}" in ${file}`);
}

console.log(`marketing site built: ${pages.length} pages, ${urls.length} in sitemap, css=${cssName}, js=${jsName}`);
