import express, { type Request, type Response } from "express";
import { setupAuth } from "./auth.ts";
import { deleteLink, listLinks, saveLink, setupDatabase, useLink } from "./db.ts";
import { adminPage } from "./page.ts";

const PORT = Number(process.env.PORT ?? 3000);
const BASE_PATH = process.env.BASE_PATH ?? "/go"; // links live at eehshack.club/go/{slug}
const FALLBACK_URL = process.env.FALLBACK_URL ?? "https://eehshack.club/"; // bare /go lands here
const NOT_FOUND_URL = process.env.NOT_FOUND_URL ?? "https://eehshack.club/404"; // unknown slugs land here
const PUBLIC_URL = process.env.PUBLIC_URL ?? `https://eehshack.club${BASE_PATH}/`; // shown in the admin portal

const RESERVED = new Set(["admin", "ping", "login", "logout", "auth"]);
const SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

const router = express.Router();
router.use(express.urlencoded({ extended: false }));

// The admin portal: log in with Hack Club, admins are listed by email.
const auth = setupAuth(BASE_PATH, PUBLIC_URL);
router.use(auth.router);

router.get("/ping", (_req, res) => {
  res.send("pong");
});

async function renderAdmin(req: Request, res: Response, message?: { error?: string; ok?: string }) {
  const links = await listLinks();
  res.send(adminPage({ links, linkBase: PUBLIC_URL, admin: req.adminEmail ?? "", ...message }));
}

router.get("/admin", auth.requireAdmin, async (req, res) => {
  await renderAdmin(req, res);
});

router.post("/admin", auth.requireAdmin, async (req, res) => {
  const slug = String(req.body.slug ?? "").trim().toLowerCase();

  if (req.body.action === "delete") {
    await deleteLink(slug);
    return renderAdmin(req, res, { ok: `Deleted ${slug}.` });
  }

  const destination = String(req.body.destination ?? "").trim();
  if (!SLUG_PATTERN.test(slug) || RESERVED.has(slug)) {
    return renderAdmin(req, res, {
      error: "Slugs can only use lowercase letters, numbers, - and _ (and can't be a reserved word like \"admin\").",
    });
  }
  if (!isWebUrl(destination)) {
    return renderAdmin(req, res, { error: "The destination must start with http:// or https://." });
  }

  await saveLink(slug, destination);
  renderAdmin(req, res, { ok: `Saved ${BASE_PATH}/${slug}.` });
});

// The redirects themselves.
router.get("/", (_req, res) => {
  res.redirect(302, FALLBACK_URL);
});

router.get("/:slug", async (req, res) => {
  const destination = await useLink(req.params.slug.toLowerCase());
  res.redirect(302, destination ?? NOT_FOUND_URL);
});

function isWebUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

const app = express();
app.set("trust proxy", true);
app.use(BASE_PATH, router);
app.use((_req, res) => {
  res.redirect(302, FALLBACK_URL);
});

await setupDatabase();
app.listen(PORT, () => {
  console.log(`Shortlinks running on port ${PORT}, serving ${BASE_PATH}/{slug}`);
});
