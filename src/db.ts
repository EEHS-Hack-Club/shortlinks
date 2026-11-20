import pg from "pg";

export const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });

export type Link = {
  slug: string;
  destination: string;
  clicks: number;
  created_at: Date;
  created_by: string | null;
  updated_at: Date | null;
  updated_by: string | null;
};

export async function setupDatabase() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS links (
      slug        TEXT PRIMARY KEY,
      destination TEXT NOT NULL,
      clicks      INTEGER NOT NULL DEFAULT 0,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ALTER TABLE links ADD COLUMN IF NOT EXISTS created_by TEXT;
    ALTER TABLE links ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
    ALTER TABLE links ADD COLUMN IF NOT EXISTS updated_by TEXT;

    -- Every create, edit and delete, kept even after a link is deleted.
    CREATE TABLE IF NOT EXISTS link_history (
      id          SERIAL PRIMARY KEY,
      slug        TEXT NOT NULL,
      action      TEXT NOT NULL,
      destination TEXT,
      changed_by  TEXT NOT NULL,
      changed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

export async function listLinks(): Promise<Link[]> {
  const res = await db.query("SELECT * FROM links ORDER BY created_at DESC");
  return res.rows;
}

// Counts the click and returns where to send the visitor, or null if the slug doesn't exist.
export async function useLink(slug: string): Promise<string | null> {
  const res = await db.query(
    "UPDATE links SET clicks = clicks + 1 WHERE slug = $1 RETURNING destination",
    [slug],
  );
  return res.rows[0]?.destination ?? null;
}

// Creates the link, or points an existing slug at a new destination, and records who did it.
export async function saveLink(slug: string, destination: string, by: string) {
  const res = await db.query(
    `INSERT INTO links (slug, destination, created_by) VALUES ($1, $2, $3)
     ON CONFLICT (slug) DO UPDATE
       SET destination = EXCLUDED.destination, updated_by = $3, updated_at = now()
     RETURNING (xmax = 0) AS created`,
    [slug, destination, by],
  );
  const action = res.rows[0]?.created ? "created" : "edited";
  await logChange(slug, action, destination, by);
}

export async function deleteLink(slug: string, by: string) {
  const res = await db.query("DELETE FROM links WHERE slug = $1 RETURNING destination", [slug]);
  const deleted = res.rows[0];
  if (deleted) await logChange(slug, "deleted", deleted.destination, by);
}

async function logChange(slug: string, action: string, destination: string, by: string) {
  await db.query(
    "INSERT INTO link_history (slug, action, destination, changed_by) VALUES ($1, $2, $3, $4)",
    [slug, action, destination, by],
  );
}
