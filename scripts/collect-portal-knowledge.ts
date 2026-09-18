/** Download public Stats SA portal pages and their published methodology files.
 * No unit-record microdata, sign-in pages, unpublished/commented links or external publishers.
 * Writes a local review corpus only; does not approve or change database records.
 * Run: bun scripts/collect-portal-knowledge.ts <output-directory>
 */
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { extractText } from "unpdf";

const root = resolve(process.argv[2] ?? "../output/knowledge-base");
await mkdir(`${root}/portal`, { recursive: true });
const base = "https://isibaloweb.statssa.gov.za";
const seeds = [
  "/", "/pages/faq.php", "/pages/dataapps.php", "/pages/policies.php",
  "/pages/surveys/pss/qlfs/2026/qlfs2026.php",
  "/pages/surveys/pss/qlfs/2025/qlfs2025.php",
  "/pages/surveys/pss/ghs/2025/ghs2025.php",
  "/pages/surveys/pss/ies/2023/ies2023.php",
  "/pages/surveys/pss/gpsjs/2025/gpsjs2025.php",
  "/pages/surveys/pss/lmd/2024/lmd2024.php",
  "/pages/surveys/pss/censuses/censusp.php",
  "/pages/surveys/ets/monthly/mseries.php",
  "/pages/surveys/ets/quarterly/qseries.php",
  "/pages/surveys/ets/annual/aseries.php",
];
const index: any[] = [];
const failures: any[] = [];
const documents = new Map<string, { title: string; parentUrl: string }>();

async function download(url: string, redirects = 0): Promise<{ bytes: Uint8Array; mime: string }> {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.hostname !== "isibaloweb.statssa.gov.za") throw new Error("Outside portal boundary");
  const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(30_000), headers: { "User-Agent": "Naledi-Knowledge/1.0 (public statistical source curation)" } });
  if ([301,302,303,307,308].includes(response.status)) {
    if (redirects >= 4) throw new Error("Too many redirects");
    return download(new URL(response.headers.get("location")!, url).href, redirects + 1);
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (Number(response.headers.get("content-length")) > 25_000_000) throw new Error("Larger than existing 25 MB limit");
  const parts: Uint8Array[] = []; let length = 0;
  for await (const part of response.body!) {
    length += part.length;
    if (length > 25_000_000) throw new Error("Larger than existing 25 MB limit");
    parts.push(part);
  }
  return { bytes: new Uint8Array(Buffer.concat(parts)), mime: response.headers.get("content-type") ?? "application/octet-stream" };
}

for (const path of seeds) {
  const url = base + path;
  try {
    const { bytes } = await download(url);
    const html = new TextDecoder().decode(bytes).replace(/<!--[\s\S]*?-->/g, "");
    let text = ""; let title = ""; let mainFound = false;
    const links: { url: string; text: string }[] = [];
    const rewriter = new HTMLRewriter()
      .on("script, style, nav", { element(e) { e.remove(); } })
      .on(".page-contents", { element() { mainFound = true; }, text(t) { text += t.text; } })
      .on(".page-contents p, .page-contents h3, .page-contents h4, .page-contents summary, .page-contents li, .page-contents tr", { element(e) { e.onEndTag(() => { text += "\n\n"; }); } })
      .on(".page-contents h3", { text(t) { title += t.text; } })
      .on(".page-contents a[href]", { element(e) {
        const target = new URL(e.getAttribute("href")!, url);
        if (target.protocol !== "https:" || target.hostname !== "isibaloweb.statssa.gov.za") return;
        links.push({ url: target.href, text: "" });
        if (/\.pdf$/i.test(target.pathname) && /\/(metadata|frameworks)\//i.test(target.pathname) && !/Qtr0[34]/i.test(target.pathname) && !/questionn?aires?/i.test(target.pathname)) {
          documents.set(target.href, { title: decodeURIComponent(target.pathname.split("/").pop()!.replace(/\.pdf$/i,"")), parentUrl: url });
        }
      } });
    await rewriter.transform(new Response(html)).text();
    text = text.replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n\s*\n/g, "\n\n").trim();
    if (!mainFound || text.length < 100) throw new Error("No public main content; possible website protection");
    const key = createHash("sha256").update(url).digest("hex").slice(0,16);
    await writeFile(`${root}/portal/${key}.html`, bytes);
    await writeFile(`${root}/portal/${key}.json`, JSON.stringify({ url, title: title.trim() || "ISIbalo Data Portal", text, links, retrievedAt: new Date().toISOString(), sourceMethod: "direct HTTPS; main content only" }, null, 2));
    index.push({ key, url, title: title.trim(), kind: "html", file: `portal/${key}.json`, originalFile: `portal/${key}.html` });
    console.log(`Page: ${title.trim()} (${text.length} characters)`);
  } catch(e) { failures.push({url,error:String(e)}); console.log(`Unavailable: ${url}: ${String(e)}`); }
  await new Promise(r => setTimeout(r, 250));
}

for (const [url, meta] of [...documents].slice(0,24)) {
  try {
    const { bytes } = await download(url);
    if (new TextDecoder().decode(bytes.slice(0,5)) !== "%PDF-") throw new Error("Response is not a PDF");
    const extracted = await extractText(bytes.slice(), { mergePages: false });
    const pages = Array.isArray(extracted.text) ? extracted.text : [extracted.text];
    if (pages.join("").trim().length < 100) throw new Error("No readable PDF text; needs manual OCR");
    const key = createHash("sha256").update(url).digest("hex").slice(0,16);
    await writeFile(`${root}/portal/${key}.pdf`, bytes);
    await writeFile(`${root}/portal/${key}.json`, JSON.stringify({ url, ...meta, pages, pageCount: extracted.totalPages, retrievedAt: new Date().toISOString(), sourceMethod: "direct HTTPS PDF; unpdf page-preserving extraction" }, null, 2));
    index.push({ key, url, ...meta, kind: "pdf", file: `portal/${key}.json`, originalFile: `portal/${key}.pdf` });
    console.log(`PDF: ${meta.title} (${pages.length} pages)`);
  } catch(e) { failures.push({url,error:String(e)}); console.log(`Unavailable: ${meta.title}: ${String(e)}`); }
  await new Promise(r => setTimeout(r, 250));
}
await writeFile(`${root}/portal-index.json`, JSON.stringify({ retrievedAt: new Date().toISOString(), sources: index, failures }, null, 2));
console.log(JSON.stringify({ sources: index.length, failures: failures.length }));
