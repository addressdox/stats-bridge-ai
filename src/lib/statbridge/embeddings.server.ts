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
  return validateVectors(
    body.embeddings?.map((row) => row.values),
    inputs.length,
  );
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
  if (rows.some((row) => row.index !== undefined)) {
    if (
      rows.length !== inputs.length ||
      rows.some(
        (row) => !Number.isInteger(row.index) || row.index! < 0 || row.index! >= inputs.length,
      ) ||
      new Set(rows.map((row) => row.index)).size !== inputs.length
    ) {
      throw new Error("Embedding provider returned invalid response indices.");
    }
    return validateVectors(
      [...rows].sort((a, b) => a.index! - b.index!).map((row) => row.embedding),
      inputs.length,
    );
  }
  return validateVectors(
    rows.map((row) => row.embedding),
    inputs.length,
  );
}

function validateVectors(vectors: unknown, expectedCount: number): number[][] {
  if (
    !Array.isArray(vectors) ||
    vectors.length !== expectedCount ||
    vectors.some(
      (vector) =>
        !Array.isArray(vector) ||
        vector.length !== EMBEDDING_DIMENSIONS ||
        vector.some((value) => typeof value !== "number" || !Number.isFinite(value)),
    )
  ) {
    throw new Error(
      `Embedding provider must return ${expectedCount} finite ${EMBEDDING_DIMENSIONS}-dimensional vectors.`,
    );
  }
  return vectors as number[][];
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

async function collectPending(db: Admin, limit: number, sourceVersionId?: string): Promise<PendingRow[]> {
  if (!Number.isSafeInteger(limit) || limit < 0)
    throw new Error("Embedding limit must be a non-negative integer.");
  const pending: PendingRow[] = [];
  if (limit === 0) return pending;

  // Scope each existence lookup to one source page; never truncate a global
  // embedding list. Keyset traversal remains stable as completed rows accumulate.
  async function existingIds(kind: PendingRow["owner_kind"], ids: string[]) {
    // UUID filters travel in a URL; a 500-ID filter can exceed gateway limits.
    const done = new Set<string>();
    for (let start = 0; start < ids.length; start += 100) {
      const { data, error } = await db
        .from("kb_embeddings")
        .select("owner_id")
        .eq("owner_kind", kind)
        .in("owner_id", ids.slice(start, start + 100));
      if (error) throw new Error(`Reading ${kind} embeddings failed: ${error.message}`);
      for (const row of data ?? []) done.add(row.owner_id);
    }
    return done;
  }

  let after: string | undefined;
  while (pending.length < limit) {
    let query = db
      .from("passages")
      .select("id, content, section_label, source_version_id, source_versions!inner(status)")
      .eq("source_versions.status", "approved")
      .order("id", { ascending: true })
      .limit(500);
    if (sourceVersionId) query = query.eq("source_version_id", sourceVersionId);
    if (after) query = query.gt("id", after);
    const { data, error } = await query;
    if (error) throw new Error(`Reading passages for embeddings failed: ${error.message}`);
    if (!data?.length) break;
    const done = await existingIds(
      "passage",
      data.map((row) => row.id),
    );
    for (const p of data) {
      if (done.has(p.id)) continue;
      pending.push({
        owner_kind: "passage",
        owner_id: p.id,
        source_version_id: p.source_version_id,
        content: `${p.section_label ?? ""}\n${p.content}`.trim().slice(0, 4000),
      });
      if (pending.length === limit) return pending;
    }
    after = data[data.length - 1]!.id;
  }

  after = undefined;
  while (pending.length < limit) {
    let query = db
      .from("observations")
      .select(
        "id, measure, unit, geography, population, reference_period, display_value, source_version_id, source_versions!inner(status)",
      )
      .eq("source_versions.status", "approved")
      .not("verified_at", "is", null)
      .not("verified_by", "is", null)
      .order("id", { ascending: true })
      .limit(500);
    if (sourceVersionId) query = query.eq("source_version_id", sourceVersionId);
    if (after) query = query.gt("id", after);
    const { data, error } = await query;
    if (error) throw new Error(`Reading observations for embeddings failed: ${error.message}`);
    if (!data?.length) break;
    const done = await existingIds(
      "observation",
      data.map((row) => row.id),
    );
    for (const o of data) {
      if (done.has(o.id)) continue;
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
      if (pending.length === limit) return pending;
    }
    after = data[data.length - 1]!.id;
  }
  return pending;
}

/** Generates any missing embeddings. Safe to run repeatedly. */
export async function backfillEmbeddings(db: Admin, limit = 120, sourceVersionId?: string) {
  const pending = await collectPending(db, limit, sourceVersionId);
  if (pending.length === 0) return { created: 0, remaining: 0 };

  let created = 0;
  for (let i = 0; i < pending.length; i += 32) {
    const batch = pending.slice(i, i + 32);
    const vectors = await embedTexts(batch.map((row) => row.content));
    const rows = batch.map((row, index) => ({
      owner_kind: row.owner_kind,
      owner_id: row.owner_id,
      source_version_id: row.source_version_id,
      content: row.content,
      embedding: JSON.stringify(vectors[index]),
      model: EMBEDDING_MODEL,
    }));

    const { error } = await db
      .from("kb_embeddings")
      .upsert(rows, { onConflict: "owner_kind,owner_id" });
    if (error) throw new Error(error.message);
    created += rows.length;
  }

  const remaining = (await collectPending(db, 1, sourceVersionId)).length;
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
export async function semanticSearch(
  db: Admin,
  question: string,
  limit = 12,
): Promise<SemanticHit[]> {
  // An unavailable provider is not an empty knowledge base. Callers may still
  // use successful lexical retrieval, but must not label a failed search a gap.
  const [vector] = await embedTexts([question]);
  const { data, error } = await db.rpc("search_knowledge_semantic", {
    _embedding: JSON.stringify(vector),
    _limit: limit,
  });
  if (error) throw new Error("The approved meaning index could not be searched.");
  return (data ?? []) as SemanticHit[];
}
