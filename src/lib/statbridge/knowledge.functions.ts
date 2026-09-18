import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

type AuthContext = { userId: string; supabase: { rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> } };

async function requirePermission(context: AuthContext, permission: string) {
  const { data, error } = await context.supabase.rpc("has_permission", { _uid: context.userId, _permission: permission });
  if (error || data !== true) throw new Error(`Your account does not have ${permission} access.`);
  return context.userId;
}

async function readKnowledgeRows<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const result = await fetchPage(offset, offset + 499);
    if (result.error) throw new Error("Knowledge records could not be loaded.");
    rows.push(...(result.data ?? []));
    if ((result.data?.length ?? 0) < 500) return rows;
  }
}

const sourceType = z.enum(["statistical_release", "media_release", "methodology", "organisational_page", "faq_page", "other"]);
const sourceInput = z.object({
  title: z.string().trim().min(3).max(300),
  publisher: z.string().trim().min(2).max(200).default("Statistics South Africa"),
  sourceType: sourceType.default("other"),
  audience: z.enum(["public", "staff"]).default("public"),
  sourceId: z.string().uuid().optional(),
  versionLabel: z.string().trim().max(160).optional(),
  topic: z.string().trim().max(160).nullish(),
  publishedOn: z.string().trim().max(10).nullish(),
  referencePeriod: z.string().trim().max(120).nullish(),
});

function officialSouthAfricanUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("Use an HTTPS address.");
  const host = url.hostname.toLowerCase();
  const allowed = host.endsWith(".gov.za") || host === "gov.za" || host.endsWith(".statssa.gov.za") || host === "statssa.gov.za" || host.endsWith(".resbank.co.za") || host === "resbank.co.za";
  if (!allowed) throw new Error("Only official South African government, Stats SA or Reserve Bank URLs can be ingested.");
  return url.toString();
}

function cleanText(value: string) {
  return value.replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
}

function htmlToText(html: string) {
  return cleanText(html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
    .replace(/\s+/g, " "));
}

function chunks(text: string, max = 1800) {
  const paragraphs = cleanText(text).split(/\n\s*\n/).filter(Boolean);
  const out: string[] = [];
  let current = "";
  for (const paragraph of paragraphs) {
    if ((current + "\n\n" + paragraph).length > max && current) { out.push(current); current = ""; }
    if (paragraph.length > max) {
      for (let i = 0; i < paragraph.length; i += max) out.push(paragraph.slice(i, i + max));
    } else current = current ? `${current}\n\n${paragraph}` : paragraph;
  }
  if (current) out.push(current);
  return out.slice(0, 500);
}

async function extractFile(bytes: Uint8Array, name: string, mime: string) {
  const lower = name.toLowerCase();
  if (mime === "application/pdf" || lower.endsWith(".pdf")) {
    const { extractText } = await import("unpdf");
    const result = await extractText(bytes, { mergePages: false });
    const pages = Array.isArray(result.text) ? result.text : [result.text];
    return { text: pages.join("\n\n"), pageCount: result.totalPages, pages };
  }
  if (lower.endsWith(".docx") || mime.includes("wordprocessingml")) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    return { text: result.value, pageCount: null, pages: null };
  }
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || mime.includes("spreadsheet") || mime.includes("excel")) {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(bytes, { type: "array" });
    const text = workbook.SheetNames.map((sheet) => `## ${sheet}\n${XLSX.utils.sheet_to_csv(workbook.Sheets[sheet]!)}`).join("\n\n");
    return { text, pageCount: workbook.SheetNames.length, pages: null };
  }
  if (lower.endsWith(".csv") || mime === "text/csv") {
    const Papa = await import("papaparse");
    const raw = new TextDecoder().decode(bytes);
    const parsed = Papa.parse<string[]>(raw, { skipEmptyLines: true });
    return { text: parsed.data.map((row) => row.join(" | ")).join("\n"), pageCount: null, pages: null };
  }
  if (lower.endsWith(".md") || lower.endsWith(".txt") || mime.startsWith("text/")) {
    return { text: new TextDecoder().decode(bytes), pageCount: null, pages: null };
  }
  throw new Error("Unsupported file. Use PDF, DOCX, XLS/XLSX, CSV, Markdown or plain text.");
}

async function existingExtraction(db: any, meta: z.infer<typeof sourceInput>, bytes: Uint8Array) {
  const hash = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  const fingerprint = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
  let query = db.from("source_versions")
    .select("id,source_id,status,sources!source_versions_source_id_fkey!inner(title,audience)")
    .eq("file_fingerprint", fingerprint).eq("ingest_state", "done")
    .in("status", ["pending", "approved"]).eq("sources.audience", meta.audience);
  if (meta.sourceId) query = query.eq("source_id", meta.sourceId);
  const { data: versions, error } = await query.order("created_at", { ascending: false }).limit(1);
  if (error) throw new Error("Existing source versions could not be checked. No duplicate was created.");
  const version = versions?.[0];
  if (!version) return { fingerprint, duplicate: null };
  const { count, error: countError } = await db.from("passages").select("id", { count: "exact", head: true }).eq("source_version_id", version.id);
  if (countError) throw new Error("Existing source extracts could not be checked.");
  return { fingerprint, duplicate: { sourceId: version.source_id as string, versionId: version.id as string, jobId: null, passages: count ?? 0, characters: 0, duplicate: true, sourceTitle: version.sources?.title as string, status: version.status as string } };
}

async function createRecords(db: any, actor: string, meta: z.infer<typeof sourceInput>, location: { url?: string; path?: string }, fingerprint: string, file?: { name: string; mime: string; size: number }) {
  // A replacement belongs to the original source and inherits its audience.
  // Changing a source's audience is not an upload operation.
  const { data: source, error: sourceError } = meta.sourceId
    ? await db.from("sources").select("id,current_version_id,audience").eq("id", meta.sourceId).maybeSingle()
    : await db.from("sources").insert({
    title: meta.title, publisher: meta.publisher, source_type: meta.sourceType, topic: meta.topic || null,
    audience: meta.audience, canonical_url: location.url ?? null, created_by: actor,
  }).select("id,current_version_id,audience").single();
  if (sourceError) throw new Error(sourceError.message);
  if (!source) throw new Error("The source to replace could not be found. Refresh the register.");
  const { data: version, error: versionError } = await db.from("source_versions").insert({
    source_id: source.id, version_label: meta.versionLabel || meta.publishedOn || `Imported ${new Date().toISOString().slice(0, 10)}`,
    published_on: meta.publishedOn || null, reference_period: meta.referencePeriod || null,
    supersedes_version_id: meta.sourceId ? source.current_version_id : null,
    file_path: location.path ?? null, original_url: location.url ?? null, status: "pending", ingest_state: "waiting", created_by: actor,
    file_fingerprint: fingerprint,
  }).select("id").single();
  if (versionError) throw new Error(versionError.message);
  const { data: job, error: jobError } = await db.from("knowledge_ingestion_jobs").insert({
    source_version_id: version.id, kind: location.url ? "url" : "file", state: location.url ? "discovered" : "uploaded",
    file_name: file?.name ?? null, mime_type: file?.mime ?? null, file_size: file?.size ?? null,
    source_url: location.url ?? null, storage_path: location.path ?? null, created_by: actor,
    checksum: fingerprint,
  }).select("id").single();
  if (jobError) throw new Error(jobError.message);
  return { sourceId: source.id, versionId: version.id, jobId: job.id };
}

async function finishIngestion(db: any, actor: string, ids: { versionId: string; jobId: string }, extracted: { text: string; pageCount: number | null; pages: string[] | null }) {
  const text = cleanText(extracted.text).slice(0, 1_500_000);
  if (text.length < 40) throw new Error("No usable text could be extracted from this source.");
  const rows = extracted.pages
    ? extracted.pages.flatMap((page, pageIndex) => chunks(page).map((content, index) => ({ source_version_id: ids.versionId, position: pageIndex * 1000 + index, page_number: pageIndex + 1, section_label: `Page ${pageIndex + 1}`, content })))
    : chunks(text).map((content, position) => ({ source_version_id: ids.versionId, position, page_number: null, section_label: position === 0 ? "Extracted text" : null, content }));
  const { error: passageError } = await db.from("passages").insert(rows);
  if (passageError) throw new Error(passageError.message);
  const version = await db.from("source_versions").update({ ingest_state: "done", ingest_note: `${rows.length} extracts created; human verification and approval required before the AI can use them.`, page_count: extracted.pageCount }).eq("id", ids.versionId);
  if (version.error) throw new Error("Extracted text was saved, but the source status could not be updated.");
  const job = await db.from("knowledge_ingestion_jobs").update({ state: "needs_verification", progress: 100, completed_at: new Date().toISOString(), detected_metadata: { characters: text.length, passages: rows.length, pageCount: extracted.pageCount } }).eq("id", ids.jobId);
  if (job.error) throw new Error("Extracted text was saved, but the review job could not be updated.");
  const event = await db.from("knowledge_ingestion_events").insert({ job_id: ids.jobId, state: "needs_verification", message: "Text extracted. Awaiting human verification and approval.", actor_id: actor, detail: { passages: rows.length } });
  if (event.error) throw new Error("The ingestion review event could not be recorded.");
  return { ...ids, passages: rows.length, characters: text.length, duplicate: false, sourceTitle: null, status: "pending" };
}

export const ingestKnowledgeFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => sourceInput.extend({ storagePath: z.string().min(3).max(500), fileName: z.string().min(1).max(255), mimeType: z.string().max(150), fileSize: z.number().int().min(1).max(25_000_000) }).parse(input))
  .handler(async ({ context, data }) => {
    const actor = await requirePermission(context as never, "sources.upload");
    if (!data.storagePath.startsWith(`${actor}/`)) throw new Error("Invalid private file path.");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: blob, error } = await db.storage.from("knowledge-files").download(data.storagePath);
    if (error || !blob) throw new Error(error?.message ?? "The private file could not be read.");
    if (blob.size === 0 || blob.size > 25_000_000) throw new Error("The source must contain data and be no larger than 25 MB.");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const existing = await existingExtraction(db, data, bytes);
    if (existing.duplicate) return existing.duplicate;
    const ids = await createRecords(db, actor, data, { path: data.storagePath }, existing.fingerprint, { name: data.fileName, mime: data.mimeType, size: blob.size });
    try {
      await db.from("knowledge_ingestion_jobs").update({ state: "extracting", progress: 20, started_at: new Date().toISOString() }).eq("id", ids.jobId);
      return await finishIngestion(db, actor, ids, await extractFile(bytes, data.fileName, data.mimeType));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Extraction failed.";
      await db.from("knowledge_ingestion_jobs").update({ state: "failed", error_message: message }).eq("id", ids.jobId);
      await db.from("source_versions").update({ ingest_state: "failed", ingest_note: message }).eq("id", ids.versionId);
      throw new Error(message);
    }
  });

export const ingestKnowledgeUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => sourceInput.extend({ url: z.string().url().max(1000) }).parse(input))
  .handler(async ({ context, data }) => {
    const actor = await requirePermission(context as never, "sources.upload");
    const url = officialSouthAfricanUrl(data.url);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const response = await fetch(url, { redirect: "follow", headers: { "user-agent": "Naledi-Knowledge/1.0" }, signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error(`The official page returned HTTP ${response.status}.`);
    const finalUrl = officialSouthAfricanUrl(response.url);
    const contentType = response.headers.get("content-type")?.split(";")[0] ?? "text/html";
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > 25_000_000) throw new Error("The source must contain data and be no larger than 25 MB.");
    const existing = await existingExtraction(db, data, bytes);
    if (existing.duplicate) return existing.duplicate;
    const ids = await createRecords(db, actor, data, { url: finalUrl }, existing.fingerprint);
    try {
      await db.from("knowledge_ingestion_jobs").update({ state: "extracting", progress: 20, started_at: new Date().toISOString() }).eq("id", ids.jobId);
      const extracted = contentType === "text/html" ? { text: htmlToText(new TextDecoder().decode(bytes)), pageCount: null, pages: null } : await extractFile(bytes, new URL(finalUrl).pathname, contentType);
      return await finishIngestion(db, actor, ids, extracted);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Extraction failed.";
      await db.from("knowledge_ingestion_jobs").update({ state: "failed", error_message: message }).eq("id", ids.jobId);
      await db.from("source_versions").update({ ingest_state: "failed", ingest_note: message }).eq("id", ids.versionId);
      throw new Error(message);
    }
  });

export const listKnowledgeSources = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requirePermission(context as never, "sources.view");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const [versions, observations, passages, jobs] = await Promise.all([
      readKnowledgeRows((from, to) => db.from("source_versions").select("id,source_id,version_label,status,approval_basis,ingest_state,ingest_note,published_on,reference_period,page_count,original_url,file_path,supersedes_version_id,withdrawal_reason,created_at,sources!source_versions_source_id_fkey(title,publisher,source_type,audience,topic,current_version_id)").order("created_at", { ascending: false }).order("id").range(from, to)),
      readKnowledgeRows((from, to) => db.from("observations").select("source_version_id,verified_at,verified_by").order("id").range(from, to)),
      readKnowledgeRows((from, to) => db.from("passages").select("source_version_id").order("id").range(from, to)),
      readKnowledgeRows((from, to) => db.from("knowledge_ingestion_jobs").select("id,source_version_id,state,progress,error_message,file_name,kind,created_at").order("created_at", { ascending: false }).order("id").range(from, to)),
    ]);
    const counts = new Map<string, { passages: number; figures: number; verified: number }>();
    for (const p of passages) { const c=counts.get(p.source_version_id) ?? {passages:0,figures:0,verified:0}; c.passages++; counts.set(p.source_version_id,c); }
    for (const o of observations) { const c=counts.get(o.source_version_id) ?? {passages:0,figures:0,verified:0}; c.figures++; if(o.verified_at&&o.verified_by)c.verified++; counts.set(o.source_version_id,c); }
    const jobByVersion = new Map<string, (typeof jobs)[number]>();
    for (const job of jobs) if (job.source_version_id && !jobByVersion.has(job.source_version_id)) jobByVersion.set(job.source_version_id, job);
    return versions.map((v) => ({ ...v, counts: counts.get(v.id) ?? { passages: 0, figures: 0, verified: 0 }, job: jobByVersion.get(v.id) ?? null }));
  });

/** Originals are private; only an authorised reviewer can request a short-lived link. */
export const openKnowledgeOriginal = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ versionId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await requirePermission(context as never, "sources.view");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: version, error } = await db.from("source_versions").select("file_path,original_url").eq("id", data.versionId).maybeSingle();
    if (error || !version) throw new Error("The source original could not be found.");
    if (!version.file_path) {
      if (!version.original_url) throw new Error("This version has no original file or link.");
      return { url: version.original_url };
    }
    const signed = await db.storage.from("knowledge-files").createSignedUrl(version.file_path, 300);
    if (signed.error || !signed.data?.signedUrl) throw new Error("The private original could not be opened. Try again.");
    return { url: signed.data.signedUrl };
  });

/** Load evidence only when a staff member opens a version for review. */
export const reviewKnowledgeSource = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ versionId: z.string().uuid(), figurePage: z.number().int().min(0).default(0), passagePage: z.number().int().min(0).default(0) }).parse(input))
  .handler(async ({ context, data }) => {
    await requirePermission(context as never, "sources.view");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const size = 20;
    const [figures, passages] = await Promise.all([
      db.from("observations").select("id,measure,display_value,unit,population,geography,reference_period,adjustment,reported_change,comparability_note,page_number,table_label,verified_at,verified_by,passages(content,page_number,section_label)", { count: "exact" }).eq("source_version_id", data.versionId).order("id").range(data.figurePage * size, (data.figurePage + 1) * size - 1),
      db.from("passages").select("id,position,page_number,section_label,content", { count: "exact" }).eq("source_version_id", data.versionId).order("position").order("id").range(data.passagePage * size, (data.passagePage + 1) * size - 1),
    ]);
    if (figures.error || passages.error) throw new Error("Source evidence could not be loaded.");
    return { figures: figures.data ?? [], passages: passages.data ?? [], figureCount: figures.count ?? 0, passageCount: passages.count ?? 0, pageSize: size };
  });

export const decideKnowledgeSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ versionId: z.string().uuid(), action: z.enum(["approve","reject","withdraw"]), approval_basis: z.enum(["demonstration", "official"]).default("demonstration"), reason: z.string().trim().max(1000).nullish() }).parse(input))
  .handler(async ({ context, data }) => {
    await requirePermission(context as never, "sources.approve");
    if (data.action !== "approve" && (!data.reason || data.reason.length < 3)) throw new Error("A reason is required.");
    // These guarded database functions atomically check state, update dependants,
    // and write the audit event as the actual signed-in reviewer.
    const { error } = await (context as unknown as AuthContext).supabase.rpc(`${data.action}_source`, {
      _version_id: data.versionId,
      ...(data.action === "approve" ? { _basis: data.approval_basis } : { _reason: data.reason }),
    });
    if (error) throw new Error(typeof error === "object" && error && "message" in error ? String(error.message) : "The source decision could not be saved.");
    if (data.action === "approve") {
      try {
        const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
        const { backfillEmbeddings } = await import("@/lib/statbridge/embeddings.server");
        await backfillEmbeddings(db, 120);
      } catch {
        // Approval remains valid; keyword search is available while vector indexing retries later.
      }
    }
    return { ok: true };
  });
/** Bulk check of extracted figures. Only a person may mark a figure as checked. */
export const verifyFigures = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ observationIds: z.array(z.string().uuid()).min(1).max(500) }).parse(input))
  .handler(async ({ context, data }) => {
    await requirePermission(context as never, "sources.verify");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const ids = [...new Set(data.observationIds)];
    const { data: figures, error: figureError } = await db.from("observations").select("id,source_version_id,verified_at,verified_by,source_versions(status,approval_basis)").in("id", ids);
    if (figureError || figures?.length !== ids.length || figures.some(figure => figure.source_versions?.status !== "pending" && !(figure.source_versions?.status === "approved" && figure.source_versions.approval_basis === "demonstration" && (!figure.verified_at || !figure.verified_by)))) throw new Error("Only pending or unchecked demonstration figures can be verified here. Refresh the review.");
    const result = await (context as unknown as { supabase: { rpc: (n: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> } }).supabase.rpc("verify_observations", { _ids: ids });
    if (result.error) throw new Error("The figures could not be marked as checked.");
    return { verified: Number(result.data ?? 0) };
  });
