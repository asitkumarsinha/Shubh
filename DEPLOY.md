# Deploy MediShop on Render (public URL)

This guide puts the full app online so anyone can open it in a browser.

## What you get

- One public URL, e.g. `https://medishop-xxxx.onrender.com`
- Angular website + API + SQLite on the same service
- Free plan works for demos (sleeps after idle; cold start ~30–60s)

> **Note:** On Render free tier, SQLite/uploads can reset when the service redeploys. Fine for demos; for permanent data use a paid disk or a cloud database later.

---

## Step 1 — Put code on GitHub

1. Create a free account at [github.com](https://github.com) if needed.
2. Create a **new repository** (e.g. `MediShop`), leave it empty.
3. In a terminal from this project folder:

```bash
git add .
git commit -m "Prepare MediShop for Render deploy"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/MediShop.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username.

---

## Step 2 — Create a Render account

1. Open [https://render.com](https://render.com)
2. Sign up with **GitHub**
3. Allow Render to access your repositories

---

## Step 3 — Create a Web Service

### Option A — Blueprint (easiest if `render.yaml` is in the repo)

1. Render Dashboard → **New** → **Blueprint**
2. Select your `MediShop` repo
3. Apply the blueprint (`medishop` web service)
4. Click **Apply**

### Option B — Manual Web Service

1. Dashboard → **New** → **Web Service**
2. Connect the `MediShop` GitHub repo
3. Settings:

| Field | Value |
|--------|--------|
| **Name** | `medishop` |
| **Runtime** | Node |
| **Build Command** | `npm install --prefix backend && npm install --prefix frontend && npm run build --prefix frontend` |
| **Start Command** | `node backend/server.js` |
| **Instance** | Free |

4. Click **Create Web Service**

---

## Step 4 — Wait for deploy

- First build can take **5–10 minutes**
- When status is **Live**, open the URL shown (e.g. `https://medishop-xxxx.onrender.com`)
- Login:
  - Admin: `admin@medishop.com` / `admin123`
  - User: `user@medishop.com` / `user123`

Share that URL — anyone with internet can use the site.

---

## Step 5 — (Optional) Real email on Render

In Render → your service → **Environment**:

```
SMTP_SERVICE=gmail
SMTP_USER=your.email@gmail.com
SMTP_PASS=your_16_char_app_password
MAIL_FROM=MediShop Reports <your.email@gmail.com>
```

Then **Manual Deploy** → **Deploy latest commit**.

---

## Common issues

| Problem | Fix |
|---------|-----|
| Site sleeps / slow first open | Free plan cold start — wait 30–60s, or upgrade |
| Build fails on `better-sqlite3` | Ensure Node 20 (`NODE_VERSION=20`) |
| Blank page after deploy | Check build logs; confirm `frontend/dist/frontend/browser` was created |
| Data wiped after redeploy | Expected on free tier without a persistent disk |

---

## Railway alternative (short)

1. [railway.app](https://railway.app) → New Project → Deploy from GitHub
2. Root directory: project root
3. Build: same build command as Render
4. Start: `node backend/server.js`
5. Generate public domain in Settings → Networking

---

## After it’s live

Send people: **your Render URL**  
They open it → Register/Login → buy medicines / admin manages orders.
