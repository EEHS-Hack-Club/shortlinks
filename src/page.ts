import type { Link } from "./db.ts";

const escape = (value: string) =>
  value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const day = (date: Date) => new Date(date).toISOString().slice(0, 10);

// "Added by X on date", plus "edited by Y on date" once someone has changed it.
function changedBy(link: Link) {
  const added = `Added by ${escape(link.created_by ?? "unknown")} on ${day(link.created_at)}`;
  if (!link.updated_at) return added;
  return `${added}<br>Edited by ${escape(link.updated_by ?? "unknown")} on ${day(link.updated_at)}`;
}

type Props = { links: Link[]; linkBase: string; admin: string; error?: string; ok?: string };

export function adminPage({ links, linkBase, admin, error, ok }: Props) {
  const rows = links
    .map(
      (link) => `
      <tr>
        <td><a href="${escape(linkBase + link.slug)}">${escape(link.slug)}</a></td>
        <td class="dest"><a href="${escape(link.destination)}">${escape(link.destination)}</a></td>
        <td>${link.clicks}</td>
        <td class="who-col">${changedBy(link)}</td>
        <td class="actions">
          <button type="button" onclick="edit(this)" data-slug="${escape(link.slug)}" data-dest="${escape(link.destination)}">Edit</button>
          <button type="button" onclick="navigator.clipboard.writeText(this.dataset.url)" data-url="${escape(linkBase + link.slug)}">Copy</button>
          <form method="post" onsubmit="return confirm('Delete this link?')">
            <input type="hidden" name="action" value="delete">
            <input type="hidden" name="slug" value="${escape(link.slug)}">
            <button>Delete</button>
          </form>
        </td>
      </tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Shortlinks</title>
<style>
  :root { color-scheme: light dark; --accent: #ec3750; --muted: #8492a6; --line: #8492a633; }
  body { font: 16px/1.5 system-ui, sans-serif; max-width: 900px; margin: 0 auto; padding: 24px 16px; }
  header { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 16px; }
  h1 { margin: 0; }
  .who { color: var(--muted); font-size: 14px; display: flex; align-items: center; gap: 8px; }
  .who button { padding: 4px 10px; font-size: 14px; }
  form.add { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 8px; }
  input { font: inherit; padding: 8px 10px; border: 1px solid var(--line); border-radius: 6px; }
  .slug { display: flex; align-items: center; gap: 4px; }
  .slug span { color: var(--muted); }
  input[name=destination] { flex: 1; min-width: 220px; }
  button { font: inherit; padding: 8px 14px; border: 0; border-radius: 6px; cursor: pointer; background: var(--line); }
  form.add button { background: var(--accent); color: white; }
  .hint { color: var(--muted); font-size: 14px; margin: 0 0 24px; }
  .msg { padding: 10px 14px; border-radius: 6px; margin-bottom: 16px; }
  .ok { background: #33d6a633; } .error { background: #ec375033; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 8px 6px; border-bottom: 1px solid var(--line); vertical-align: top; }
  th { color: var(--muted); font-weight: 500; font-size: 14px; }
  .dest { word-break: break-all; }
  .who-col { color: var(--muted); font-size: 14px; }
  .actions { display: flex; gap: 6px; white-space: nowrap; }
  .actions button { padding: 4px 10px; font-size: 14px; }
  a { color: inherit; }
</style>
</head>
<body>
<header>
  <h1>Shortlinks</h1>
  <form class="who" method="post" action="logout">Logged in as ${escape(admin)} <button>Log out</button></form>
</header>
${ok ? `<div class="msg ok">${escape(ok)}</div>` : ""}
${error ? `<div class="msg error">${escape(error)}</div>` : ""}
<form class="add" method="post">
  <input type="hidden" name="action" value="save">
  <label class="slug"><span>${escape(linkBase)}</span><input name="slug" placeholder="slug" required></label>
  <input name="destination" type="url" placeholder="https://..." required>
  <button>Save</button>
</form>
<p class="hint">Saving a slug that already exists changes where it points.</p>
<table>
  <thead><tr><th>Slug</th><th>Destination</th><th>Clicks</th><th>Added / edited by</th><th></th></tr></thead>
  <tbody>${rows || `<tr><td colspan="5">No links yet.</td></tr>`}</tbody>
</table>
<script>
  function edit(button) {
    document.querySelector("[name=slug]").value = button.dataset.slug;
    const dest = document.querySelector("[name=destination]");
    dest.value = button.dataset.dest;
    dest.focus();
  }
</script>
</body>
</html>`;
}
