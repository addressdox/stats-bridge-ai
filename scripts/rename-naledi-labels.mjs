/**
 * Rename current display labels only. Dry-run by default.
 * Run from the app root with Node's --env-file=.env; never prints credentials.
 * --apply requires --snapshot=/absolute/private/path.json outside this repository.
 * A retry uses that same snapshot and appends at most one completion audit event.
 */
import { createClient } from "@supabase/supabase-js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const OLD_DESK = "StatBridge — Statistics South Africa information desk";
const NEW_DESK = "Naledi by AddressDox — Statistics South Africa information desk";
const OLD_GUIDELINE = "StatBridge demonstration house style";
const NEW_GUIDELINE = "Naledi demonstration house style";
const AUDIT_ID = "8877fcad-a404-4683-bbef-c710737bfc1f";
const PROJECT = "ybxltcxmxmygypkbbxbz";
const apply = process.argv.includes("--apply");
const snapshotPath = process.argv.find((arg) => arg.startsWith("--snapshot="))?.slice(11);
const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key || new URL(url).hostname !== `${PROJECT}.supabase.co`) {
  throw new Error("Expected app Supabase URL and service credential are required.");
}
const db = createClient(url, key, { auth: { persistSession: false } });
const must = (result, label) => {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
};
const current = async () => {
  const [desk, guideline] = await Promise.all([
    db.from("desk_settings").select("*").eq("id", true).single(),
    db.from("guidelines").select("*").eq("status", "active").single(),
  ]);
  return { desk: must(desk, "Read desk"), guideline: must(guideline, "Read guideline") };
};
const state = await current();
if (![OLD_DESK, NEW_DESK].includes(state.desk.desk_name)) {
  throw new Error("Desk has a different customised name; no changes made.");
}
if (![OLD_GUIDELINE, NEW_GUIDELINE].includes(state.guideline.title)) {
  throw new Error("Active guideline has a different title; no changes made.");
}
const summary = {
  mode: apply ? "apply" : "dry-run",
  desk: { from: state.desk.desk_name, to: NEW_DESK },
  guideline: { id: state.guideline.id, version: state.guideline.version_number, from: state.guideline.title, to: NEW_GUIDELINE },
  scope: "Display labels only; preserve rule content, approvals, history and timestamps.",
};
console.log(JSON.stringify(summary, null, 2));
if (!apply) process.exit(0);
if (!snapshotPath || !isAbsolute(snapshotPath)) {
  throw new Error("Apply requires --snapshot=/absolute/private/path.json.");
}
const fromRepo = relative(appRoot, resolve(snapshotPath));
if (!fromRepo.startsWith("..") && !isAbsolute(fromRepo)) {
  throw new Error("Save the private snapshot outside the app repository.");
}
await mkdir(dirname(snapshotPath), { recursive: true, mode: 0o700 });
const before = { project: PROJECT, savedAt: new Date().toISOString(), ...state };
let snapshot = before;
try {
  await writeFile(snapshotPath, JSON.stringify(before, null, 2), { flag: "wx", mode: 0o600 });
} catch (error) {
  if (error.code !== "EEXIST") throw error;
  snapshot = JSON.parse(await readFile(snapshotPath, "utf8"));
  if (snapshot.project !== PROJECT || snapshot.guideline?.id !== state.guideline.id || snapshot.guideline?.version_number !== state.guideline.version_number) {
    throw new Error("Existing snapshot does not describe this active guideline.");
  }
}
const previousAudit = must(await db.from("audit_events").select("id,detail").eq("id", AUDIT_ID).maybeSingle(), "Read rename audit");
if (previousAudit) {
  if (state.desk.desk_name !== NEW_DESK || state.guideline.title !== NEW_GUIDELINE || previousAudit.detail?.guideline_id !== state.guideline.id) {
    throw new Error("Rename audit exists but current labels differ; manual review required.");
  }
  console.log("Already renamed and audited; no changes needed.");
  process.exit(0);
}

const changes = [];
try {
  if (state.desk.desk_name === OLD_DESK) {
    const changed = must(await db.from("desk_settings").update({ desk_name: NEW_DESK }).eq("id", true).eq("desk_name", OLD_DESK).select("id"), "Rename desk");
    if (changed.length !== 1) throw new Error("Desk changed concurrently; rename stopped.");
    changes.push("desk");
  }
  if (state.guideline.title === OLD_GUIDELINE) {
    const changed = must(await db.from("guidelines").update({ title: NEW_GUIDELINE }).eq("id", state.guideline.id).eq("status", "active").eq("version_number", state.guideline.version_number).eq("title", OLD_GUIDELINE).select("id"), "Rename guideline title");
    if (changed.length !== 1) throw new Error("Guideline changed concurrently; rename stopped.");
    changes.push("guideline");
  }
  const after = await current();
  if (after.desk.desk_name !== NEW_DESK || after.guideline.id !== state.guideline.id || after.guideline.title !== NEW_GUIDELINE) {
    throw new Error("Renamed labels failed read-back verification.");
  }
  for (const [name, label] of [["desk", "desk_name"], ["guideline", "title"]]) {
    for (const field of Object.keys(state[name])) {
      if (field !== label && JSON.stringify(after[name][field]) !== JSON.stringify(state[name][field])) {
        throw new Error(`${name}.${field} changed concurrently; stop for review.`);
      }
    }
  }
  must(await db.from("audit_events").insert({
    id: AUDIT_ID,
    actor_role: "system",
    action: "application_display_labels_renamed",
    entity_kind: "application_branding",
    origin: "system",
    from_state: "StatBridge",
    to_state: "Naledi by AddressDox",
    detail: {
      requested_by: "project_owner",
      desk_name: { before: snapshot.desk.desk_name, after: NEW_DESK },
      guideline_title: { before: snapshot.guideline.title, after: NEW_GUIDELINE },
      guideline_id: state.guideline.id,
      guideline_version: state.guideline.version_number,
      scope: "Display labels only; guideline rules, version, activation, approvals and historical answers unchanged.",
    },
  }), "Append rename audit");
  console.log("Verified: current labels renamed and audited; all other fields unchanged.");
} catch (error) {
  // Do not overwrite a concurrent edit or undo a possibly committed audit.
  const audit = await db.from("audit_events").select("id").eq("id", AUDIT_ID).maybeSingle();
  if (audit.error || audit.data) {
    throw new Error(`${error.message} Completion status uncertain; retain snapshot and retry for verification.`);
  }
  for (const name of changes.reverse()) {
    const result = name === "desk"
      ? await db.from("desk_settings").update({ desk_name: OLD_DESK }).eq("id", true).eq("desk_name", NEW_DESK).select("id")
      : await db.from("guidelines").update({ title: OLD_GUIDELINE }).eq("id", state.guideline.id).eq("status", "active").eq("version_number", state.guideline.version_number).eq("title", NEW_GUIDELINE).select("id");
    if (result.error || result.data?.length !== 1) {
      throw new Error(`${error.message} ${name} rollback needs review; retain the snapshot.`);
    }
  }
  throw new Error(`${error.message} This attempt's label changes were rolled back.`);
}
