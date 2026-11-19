import pg from "pg";

export const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });

export type Link = { slug: string; destination: string; clicks: number; created_at: Date };

export async function setupDatabase() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS links (
      slug        TEXT PRIMARY KEY,
      destination TEXT NOT NULL,
      clicks      INTEGER NOT NULL DEFAULT 0,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
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

// Creates the link, or points an existing slug at a new destination.
export async function saveLink(slug: string, destination: string) {
  await db.query(
    `INSERT INTO links (slug, destination) VALUES ($1, $2)
     ON CONFLICT (slug) DO UPDATE SET destination = EXCLUDED.destination`,
    [slug, destination],
  );
}

export async function deleteLink(slug: string) {
  await db.query("DELETE FROM links WHERE slug = $1", [slug]);
}
