/**
 * Meaning-based search support.
 *
 * Every approved passage and verified observation gets one embedding row so a
 * differently worded question still reaches the right publication. Embeddings
 * are generated server-side only and never leave the server.
 */
const EMBEDDING_MODEL = "gemini-embedding-2";
const EMBEDDING_DIMENSIONS = 1536;

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

/** Google's own embedding API, on the project-owned key. */
async function embedWithGoogle(key: string, inputs: string[]): Promise<number[][]> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:batchEmbedContents`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        requests: inputs.map((text) => ({
          model: `models/${EMBEDDING_MODEL}`,
          content: { parts: [{ text }] },
          outputDimensionality: EMBEDDING_DIMENSIONS,
        })),
      }),
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Embedding request failed [${response.status}]: ${detail}`);
  }

  const body = (await response.json()) as { embeddings?: Array<{ values?: number[] }> };
  return inputs.map((_, i) => body.embeddings?.[i]?.values ?? []);
}

/** Managed gateway fallback, used only when no project key is configured. */
async function embedWithGateway(key: string, inputs: string[]): Promise<number[][]> {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: `google/${EMBEDDING_MODEL}`,
      input: inputs,
      dimensions: EMBEDDING_DIMENSIONS,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Embedding request failed [${response.status}]: ${detail}`);
  }

  const body = (await response.json()) as { data?: Array<{ embedding: number[]; index?: number }> };
  const rows = body.data ?? [];
  return inputs.map((_, i) => rows[i]?.embedding ?? rows.find((r) => r.index === i)?.embedding ?? []);
}

export async function embedTexts(inputs: string[]): Promise<number[][]> {
  if (inputs.length === 0) return [];
  const own = process.env["GEMINI_API_KEY"];
  if (own) return embedWithGoogle(own, inputs);
  const gateway = process.env["LOVABLE_API_KEY"];
  if (gateway) return embedWithGateway(gateway, inputs);
  throw new Error("No embedding provider is configured on the server.");
}

export async function embedOne(text: string): Promise<number[] | null> {
  try {
    const [first] = await embedTexts([text]);
    return first && first.length > 0 ? first : null;
  } catch {
    return null;
  }
}

type PendingRow = {
  owner_kind: "passage" | "observation";
  owner_id: string;
  source_version_id: string;
  content: string;
};

async function collectPending(db: Admin, limit: number): Promise<PendingRow[]> {
  const [passages, observations, existing] = await Promise.all([
    db
      .from("passages")
      .select("id, content, section_label, source_version_id, source_versions!inner(status)")
      .eq("source_versions.status", "approved")
      .limit(500),
    db
      .from("observations")
      .select(
        "id, measure, unit, geography, population, reference_period, display_value, source_version_id, source_versions!inner(status)",
      )
      .eq("source_versions.status", "approved")
      .limit(500),
    db.from("kb_embeddings").select("owner_kind, owner_id").limit(2000),
  ]);

  const done = new Set((existing.data ?? []).map((r) => `${r.owner_kind}:${r.owner_id}`));
  const pending: PendingRow[] = [];

  for (const p of passages.data ?? []) {
    if (done.has(`passage:${p.id}`)) continue;
    pending.push({
      owner_kind: "passage",
      owner_id: p.id,
      source_version_id: p.source_version_id,
      content: `${p.section_label ?? ""}\n${p.content}`.trim().slice(0, 4000),
    });
  }
  for (const o of observations.data ?? []) {
    if (done.has(`observation:${o.id}`)) continue;
    pending.push({
      owner_kind: "observation",
      owner_id: o.id,
      source_version_id: o.source_version_id,
      content:
        `${o.measure} for ${o.geography}${o.population ? ` (${o.population})` : ""}, ${o.reference_period}: ${o.display_value} ${o.unit}`.slice(
          0,
          2000,
        ),
    });
  }

  return pending.slice(0, limit);
}

/** Generates any missing embeddings. Safe to run repeatedly. */
export async function backfillEmbeddings(db: Admin, limit = 120) {
  const pending = await collectPending(db, limit);
  if (pending.length === 0) return { created: 0, remaining: 0 };

  let created = 0;
  for (let i = 0; i < pending.length; i += 32) {
    const batch = pending.slice(i, i + 32);
    const vectors = await embedTexts(batch.map((row) => row.content));
    const rows = batch
      .map((row, index) => ({ row, vector: vectors[index] }))
      .filter((entry): entry is { row: PendingRow; vector: number[] } => Boolean(entry.vector?.length))
      .map(({ row, vector }) => ({
        owner_kind: row.owner_kind,
        owner_id: row.owner_id,
        source_version_id: row.source_version_id,
        content: row.content,
        embedding: JSON.stringify(vector),
        model: EMBEDDING_MODEL,
      }));

    if (rows.length === 0) continue;
    const { error } = await db.from("kb_embeddings").upsert(rows, { onConflict: "owner_kind,owner_id" });
    if (error) throw new Error(error.message);
    created += rows.length;
  }

  const remaining = (await collectPending(db, 1)).length;
  return { created, remaining };
}

export type SemanticHit = {
  owner_kind: "passage" | "observation" | "memory_item";
  owner_id: string;
  source_version_id: string | null;
  content: string;
  similarity: number;
};

/** Meaning-based lookup, restricted to approved publications inside the database. */
export async function semanticSearch(db: Admin, question: string, limit = 12): Promise<SemanticHit[]> {
  const vector = await embedOne(question);
  if (!vector) return [];
  const { data, error } = await db.rpc("search_knowledge_semantic", {
    _embedding: JSON.stringify(vector),
    _limit: limit,
  });
  if (error) return [];
  return (data ?? []) as SemanticHit[];
}
