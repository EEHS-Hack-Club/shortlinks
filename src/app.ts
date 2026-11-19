import express, { type NextFunction, type Request, type Response } from "express";
import { timingSafeEqual } from "node:crypto";
import { deleteLink, listLinks, saveLink, setupDatabase, useLink } from "./db.ts";
import { adminPage } from "./page.ts";

const PORT = Number(process.env.PORT ?? 3000);
const BASE_PATH = process.env.BASE_PATH ?? "/go"; // links live at eehshack.club/go/{slug}
const FALLBACK_URL = process.env.FALLBACK_URL ?? "https://eehshack.club/"; // bare /go lands here
const NOT_FOUND_URL = process.env.NOT_FOUND_URL ?? "https://eehshack.club/404"; // unknown slugs land here
const PUBLIC_URL = process.env.PUBLIC_URL ?? `https://eehshack.club${BASE_PATH}/`; // shown in the admin portal
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";

const RESERVED = new Set(["admin", "ping"]);
const SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

const router = express.Router();
router.use(express.urlencoded({ extended: false }));

router.get("/ping", (_req, res) => {
  res.send("pong");
});

// The admin portal, protected by one shared password (any username works).
function requirePassword(req: Request, res: Response, next: NextFunction) {
  const [scheme, encoded] = (req.headers.authorization ?? "").split(" ");
  const password = Buffer.from(encoded ?? "", "base64").toString().split(":").slice(1).join(":");
  const given = Buffer.from(password);
  const expected = Buffer.from(ADMIN_PASSWORD);

  if (
    ADMIN_PASSWORD &&
    scheme === "Basic" &&
    given.length === expected.length &&
    timingSafeEqual(given, expected)
  ) {
    return next();
  }
  res.set("WWW-Authenticate", 'Basic realm="Shortlinks admin"');
  res.status(401).send("Password required.");
}

async function renderAdmin(_req: Request, res: Response, message?: { error?: string; ok?: string }) {
  const links = await listLinks();
  res.send(adminPage({ links, linkBase: PUBLIC_URL, ...message }));
}

router.get("/admin", requirePassword, async (req, res) => {
  await renderAdmin(req, res);
});

router.post("/admin", requirePassword, async (req, res) => {
  const slug = String(req.body.slug ?? "").trim().toLowerCase();

  if (req.body.action === "delete") {
    await deleteLink(slug);
    return renderAdmin(req, res, { ok: `Deleted ${slug}.` });
  }

  const destination = String(req.body.destination ?? "").trim();
  if (!SLUG_PATTERN.test(slug) || RESERVED.has(slug)) {
    return renderAdmin(req, res, {
      error: "Slugs can only use lowercase letters, numbers, - and _ (and can't be \"admin\" or \"ping\").",
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
