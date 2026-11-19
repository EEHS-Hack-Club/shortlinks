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

Runs on Orchard in the Services project. The ingress sends `eehshack.club/go/` to this app, and everything else on `eehshack.club` still goes to the website.

## License

MIT, see [LICENSE](LICENSE).
