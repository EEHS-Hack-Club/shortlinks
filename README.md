# Shortlinks

EEHS Hack Club's link shortener: `eehshack.club/go/{slug}` redirects to wherever the slug points. Adapted from Hack Club's [hack.af](https://github.com/hackclub/hack.af).

- **Add, change or delete links** at `eehshack.club/go/admin`. You log in with your Hack Club account, and only emails listed in `ADMIN_EMAILS` get in. The Hack Club Auth app's redirect URI is `https://eehshack.club/go/auth/callback`.
- **Unknown slugs** redirect to `NOT_FOUND_URL` (the website's 404 page by default). A bare `/go` goes to `FALLBACK_URL` (the homepage).
- **Who changed what:** the admin page shows who added and last edited each link. Every create, edit and delete is also recorded in the `link_history` table, including deleted links.
- The `links` and `link_history` tables are created (and new columns added) automatically on startup.

## Running locally

```sh
bun install
cp .env.example .env   # then fill in the Hack Club Auth and session settings
bun run db             # starts Postgres in Docker
bun dev                # http://localhost:3000/go/admin
```

## Hosting

Runs on Orchard in the Services project. Orchard only allows one deployment per hostname, so the website's `Caddyfile` (in [EEHS-Hack-Club/website](https://github.com/EEHS-Hack-Club/website)) proxies `eehshack.club/go` and `/go/*` to this app's Orchard URL. Everything else on `eehshack.club` is still served by the website.

## License

MIT, see [LICENSE](LICENSE).
