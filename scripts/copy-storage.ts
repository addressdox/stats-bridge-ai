/**
 * Copies the Naledi storage buckets and their files from the old backend to
 * the new Supabase project. Both buckets stay private.
 *
 * Run with bun (or `npx tsx`):
 *   SOURCE_URL=... SOURCE_SERVICE_KEY=... TARGET_URL=... TARGET_SERVICE_KEY=... \
 *   bun scripts/copy-storage.ts
 */
import { createClient } from "@supabase/supabase-js";

const BUCKETS = ["sources", "knowledge-files"] as const;

const need = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};

const source = createClient(need("SOURCE_URL"), need("SOURCE_SERVICE_KEY"), {
  auth: { persistSession: false },
});
const target = createClient(need("TARGET_URL"), need("TARGET_SERVICE_KEY"), {
  auth: { persistSession: false },
});

const walk = async (bucket: string, prefix: string): Promise<string[]> => {
  const { data, error } = await source.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error) throw error;
  const paths: string[] = [];
  for (const entry of data ?? []) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.id) paths.push(path);
    else paths.push(...(await walk(bucket, path)));
  }
  return paths;
};

for (const bucket of BUCKETS) {
  const created = await target.storage.createBucket(bucket, { public: false });
  if (created.error && !/exists/i.test(created.error.message)) throw created.error;

  const paths = await walk(bucket, "");
  for (const path of paths) {
    const file = await source.storage.from(bucket).download(path);
    if (file.error) throw file.error;
    const upload = await target.storage
      .from(bucket)
      .upload(path, file.data, { upsert: true, contentType: file.data.type || undefined });
    if (upload.error) throw upload.error;
  }
  // eslint-disable-next-line no-console
  console.info(`${bucket}: ${paths.length} file(s) copied`);
}
