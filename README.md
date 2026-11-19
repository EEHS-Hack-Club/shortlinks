# Shortlinks

EEHS Hack Club's link shortener: `eehshack.club/go/{slug}` redirects to wherever the slug points. Adapted from Hack Club's [hack.af](https://github.com/hackclub/hack.af).

- **Add, change or delete links** at `eehshack.club/go/admin` (asks for `ADMIN_PASSWORD`; any username works).
- **Unknown slugs** redirect to `FALLBACK_URL` (the club homepage by default).
- The `links` table is created automatically on startup.

## Running locally

```sh
bun install
cp .env.example .env   # then set ADMIN_PASSWORD
bun run db             # starts Postgres in Docker
bun dev                # http://localhost:3000/go/admin
```

## Hosting

Runs on Orchard in the Services project. Orchard only allows one deployment per hostname, so the website's `Caddyfile` (in [EEHS-Hack-Club/website](https://github.com/EEHS-Hack-Club/website)) proxies `eehshack.club/go` and `/go/*` to this app's Orchard URL. Everything else on `eehshack.club` is still served by the website.

## License

MIT, see [LICENSE](LICENSE).
