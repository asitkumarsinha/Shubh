# Deploy Shubh Surgical (public URL)

Host the full app (Angular + Express + SQLite) on one public URL.

## Required host settings

Set these exactly on Render / Railway / Azure / any Node portal:

| Setting | Value |
|--------|--------|
| **Root Directory** | *(leave empty / repository root)* — do **not** set to `backend` |
| **Build Command** | `npm install --prefix backend && npm install --prefix frontend && npm run build` |
| **Start Command** | `node backend/server.js` |
| **Node version** | `20` (`NODE_VERSION=20`, also pinned by `.node-version`) |

Do not add `npm rebuild better-sqlite3`. That compiles the database library from source and fails on Render’s compiler. `npm install` uses the published binary instead.

On an existing Render service, open **Settings → Build Command** and replace it with the command above, then redeploy. A Blueprint service picks this up from `render.yaml`.

`npm run build` compiles Angular and copies it into `backend/public` so the API can serve the website.

---

## Render

### Option A — Blueprint

1. [render.com](https://render.com) → **New** → **Blueprint**
2. Select this GitHub repo
3. Apply `shubh-surgical` from `render.yaml`

### Option B — Manual Web Service

1. **New** → **Web Service** → connect repo
2. Use the settings table above
3. Create service and wait for **Live**

Demo logins:
- Admin: `admin@shubhsurgical.com` / `admin123`
- User: `user@shubhsurgical.com` / `user123`

---

## Why you saw “404 File not found”

Usually one of these:

1. **Frontend was never built on the host** — only the API started, so `/` has no `index.html`
2. **Root Directory was set to `backend/`** — then `frontend/` is missing during build
3. **Wrong start command** — must be `node backend/server.js` from repo root
4. **Build finished but files were not copied** — fixed by `npm run build` (includes `scripts/copy-frontend.js`)

After this fix, a successful deploy serves files from `backend/public`.

Check health: `https://YOUR-URL/api/health`  
You should see `"hasFrontend": true`.

---

## Optional email env vars

```
SMTP_SERVICE=gmail
SMTP_USER=your.email@gmail.com
SMTP_PASS=your_16_char_app_password
MAIL_FROM=Shubh Surgical Reports <your.email@gmail.com>
```

---

## Notes

- Free Render plans sleep when idle (first open can take 30–60s)
- SQLite/uploads can reset on free redeploys without a persistent disk
- **Never commit `node_modules`** — Windows binaries break on Render (`invalid ELF header`). If that error appears, clear Render build cache and redeploy after removing `node_modules` from git.
