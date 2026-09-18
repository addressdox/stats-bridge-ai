# Moving StatBridge to your own Supabase project and Vercel

Everything you need is in this repository:

| File | What it is |
| --- | --- |
| `migrate/00_extensions.sql` | Database add-ons the app needs (including the search/embedding one) |
| `migrate/01_schema.sql` | Every table, view, function, trigger, access rule and permission grant |
| `migrate/02a_defer_constraints.sql` | Lets the records load despite circular links between records |
| `migrate/02_data.sql` | All current records (publications, passages, figures, answers, cases, roles, settings) |
| `migrate/04_storage.sql` | Creates the two private file stores and their access rules |
| `migrate/03_relink_admin.sql` | Attaches the imported staff profile to your new sign-in account |
| `migrate/import.sh` | Runs steps 0–2 in the right order |
| `scripts/copy-storage.ts` | Copies the two private file buckets and their contents |
| `.env.example` | Every setting the app expects |
| `vercel.json` | Build settings plus the daily crawl and daily insight snapshot schedules |

---

## 1. Create the new Supabase project

1. Create a project in your own Supabase account (choose a region close to your users).
2. Under **Database > Connection string**, copy the **session** string (port 5432) and fill in your database password.

## 2. Load the database

```bash
export TARGET_DB_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres"
bash migrate/import.sh
```

This creates the structure, the access rules, the permission grants and loads all current records.

## 3. Recreate the staff sign-in account

Sign-in accounts live in Supabase's own account store and cannot be exported, so create yours again:

1. In your Supabase project, **Authentication > Users > Add user**: `adm@statsbridge.com`, set a password, mark the email confirmed.
2. Copy the new user's ID, then attach the imported profile to it:

```bash
psql "$TARGET_DB_URL" \
  -v old_id="'5276c2c5-ac56-44d1-b8c7-cd94fa60e21e'" \
  -v new_id="'<the new user id>'" \
  -f migrate/03_relink_admin.sql
```

Then in **Authentication > Providers**: turn off open sign-ups if you want staff-only access, turn on leaked-password protection, and enable Google sign-in if you use it.

## 4. Copy the stored files

```bash
SOURCE_URL=<old project url> SOURCE_SERVICE_KEY=<old service key> \
TARGET_URL=<new project url> TARGET_SERVICE_KEY=<new service key> \
bun scripts/copy-storage.ts
```

This creates the two private buckets (`sources`, `knowledge-files`) and copies any uploaded documents.

## 5. Deploy on Vercel

1. Push this repository to GitHub and import it into Vercel.
2. Framework preset: **Other**. Build command `npm run build` (already in `vercel.json`).
3. Add the environment variables from `.env.example`, including **`NITRO_PRESET=vercel`** — that switch is what makes the build produce a Vercel-ready server.
4. Deploy. The daily crawl and daily insight snapshot are already scheduled in `vercel.json`; Vercel calls them with its own cron secret, and your own scheduler can still call them with the `x-crawl-token` header.

## 6. After the first deploy

- Add the deployed domain under **Authentication > URL configuration** in Supabase (site URL and redirect URLs).
- In the app, open **Websites and widget** and add the domains allowed to show the assistant.
- If you use the voice assistant, point your ElevenLabs agent's tool URLs at the new domain and keep `AGENT_TOOL_TOKEN` the same on both sides.
- Check **Knowledge base > Sources** — publications, passages and checked figures should all be present, and the assistant should answer with citations.

## Notes

- The export was taken from the live database at the time of the migration; if work continues here afterwards, re-run the export before switching over.
- Service role keys and database passwords belong only in Vercel's environment variables and your own machine, never in the repository.
