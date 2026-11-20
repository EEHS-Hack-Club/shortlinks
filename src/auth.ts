// "Log in with Hack Club" for the admin portal, using Hack Club Auth (auth.hackclub.com).
// Admins are whoever's Slack ID is listed in ADMIN_SLACK_IDS. Sessions are a signed cookie,
// so there's nothing to store in the database.
import express, { type NextFunction, type Request, type Response } from "express";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const HCA_URL = process.env.HCA_URL ?? "https://auth.hackclub.com";
const CLIENT_ID = process.env.HCA_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.HCA_CLIENT_SECRET ?? "";
const SESSION_SECRET = process.env.SESSION_SECRET ?? "";
const ADMIN_SLACK_IDS = new Set(
  (process.env.ADMIN_SLACK_IDS ?? "").split(",").map((id) => id.trim()).filter(Boolean),
);
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_COOKIE = "shortlinks_session";
const STATE_COOKIE = "shortlinks_state";

declare global {
  namespace Express {
    interface Request {
      adminSlackId?: string;
    }
  }
}

export function setupAuth(basePath: string, publicUrl: string) {
  const router = express.Router();
  const redirectUri = `${publicUrl}auth/callback`;
  const cookieOptions = { path: basePath, httpOnly: true, secure: true, sameSite: "lax" as const };
  const missing = [
    !CLIENT_ID && "HCA_CLIENT_ID",
    !CLIENT_SECRET && "HCA_CLIENT_SECRET",
    !SESSION_SECRET && "SESSION_SECRET",
    ADMIN_SLACK_IDS.size === 0 && "ADMIN_SLACK_IDS",
  ].filter(Boolean);

  router.get("/login", (_req, res) => {
    if (missing.length) {
      return res.status(503).send(`Login isn't set up yet. Missing env vars: ${missing.join(", ")}`);
    }
    const state = randomBytes(16).toString("hex");
    res.cookie(STATE_COOKIE, state, { ...cookieOptions, maxAge: 10 * 60 * 1000 });
    const url = new URL("/oauth/authorize", HCA_URL);
    url.search = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid slack_id",
      state,
    }).toString();
    res.redirect(302, url.toString());
  });

  router.get("/auth/callback", async (req, res) => {
    const expectedState = readCookie(req, STATE_COOKIE);
    res.clearCookie(STATE_COOKIE, cookieOptions);
    const { code, state, error } = req.query;

    if (error) return res.status(400).send(`Hack Club Auth said: ${escapeHtml(String(error))}`);
    if (!expectedState || typeof state !== "string" || !safeEqual(state, expectedState)) {
      return res.status(400).send(`Login expired or was tampered with. <a href="${basePath}/login">Try again</a>.`);
    }
    if (typeof code !== "string") return res.status(400).send("Missing login code.");

    const slackId = await slackIdFromCode(code, redirectUri);
    if (!slackId) {
      return res.status(502).send(`Couldn't get your Slack ID from Hack Club Auth. <a href="${basePath}/login">Try again</a>.`);
    }
    if (!ADMIN_SLACK_IDS.has(slackId)) {
      return res.status(403).send(`Your Hack Club account (${escapeHtml(slackId)}) isn't a shortlinks admin. Ask an admin to add your Slack ID.`);
    }

    res.cookie(SESSION_COOKIE, sign(`${slackId}|${Date.now() + SESSION_MS}`), {
      ...cookieOptions,
      maxAge: SESSION_MS,
    });
    res.redirect(302, `${basePath}/admin`);
  });

  router.post("/logout", (_req, res) => {
    res.clearCookie(SESSION_COOKIE, cookieOptions);
    res.redirect(302, "/");
  });

  // Lets a request through only with a valid session for someone still on the allowlist.
  function requireAdmin(req: Request, res: Response, next: NextFunction) {
    const [slackId, expires] = (verify(readCookie(req, SESSION_COOKIE)) ?? "").split("|");
    if (slackId && Number(expires) > Date.now() && ADMIN_SLACK_IDS.has(slackId)) {
      req.adminSlackId = slackId;
      return next();
    }
    if (req.method === "GET") return res.redirect(302, `${basePath}/login`);
    res.status(401).send(`Your login has expired. <a href="${basePath}/login">Log in again</a>.`);
  }

  return { router, requireAdmin };
}

// Swaps the one-time login code for a token, then asks Hack Club Auth who it belongs to.
async function slackIdFromCode(code: string, redirectUri: string): Promise<string | null> {
  try {
    const tokenRes = await fetch(new URL("/oauth/token", HCA_URL), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      }),
    });
    const token = (await tokenRes.json()) as { access_token?: string };
    if (!tokenRes.ok || !token.access_token) {
      console.error("Hack Club Auth token exchange failed:", tokenRes.status, token);
      return null;
    }

    const meRes = await fetch(new URL("/api/v1/me", HCA_URL), {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    const me = (await meRes.json()) as { identity?: { slack_id?: string } };
    if (!meRes.ok) console.error("Hack Club Auth /me failed:", meRes.status, me);
    return me.identity?.slack_id ?? null;
  } catch (error) {
    console.error("Hack Club Auth request failed:", error);
    return null;
  }
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function readCookie(req: Request, name: string): string | undefined {
  for (const part of (req.headers.cookie ?? "").split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
}

function hmac(value: string) {
  return createHmac("sha256", SESSION_SECRET).update(value).digest("base64url");
}

function sign(value: string) {
  return `${value}.${hmac(value)}`;
}

function verify(signed: string | undefined): string | null {
  if (!signed || !SESSION_SECRET) return null;
  const dot = signed.lastIndexOf(".");
  const value = signed.slice(0, dot);
  return dot > 0 && safeEqual(signed.slice(dot + 1), hmac(value)) ? value : null;
}

function safeEqual(a: string, b: string) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}
