# Shubh Surgical — Online Medicine Store

Angular frontend + Express/SQLite backend for multi-user medicine shopping with admin approval workflow.

## Features

- **Admin / User login** (JWT)
- Admin uploads medicine images, price, stock
- Users browse medicines, add to cart, checkout
- Bill shows item count + medicine images + **QR code**
- Admin approves payment → **Purchase Order** generated → ready to dispatch
- Admin can **cancel** orders
- Reports: buyers, prices, user info, order status + **email report**

## Demo accounts

| Role  | Email               | Password  |
|-------|---------------------|-----------|
| Admin | admin@medishop.com  | admin123  |
| User  | user@medishop.com   | user123   |

## Run locally

### 1. Backend (API + SQLite)

```bash
cd backend
npm install
npm start
```

API: http://localhost:3000

### 2. Frontend (Angular)

```bash
cd frontend
npm install
npm start
```

App: http://localhost:4200 (proxies `/api` and `/uploads` to the backend)

## Order flow

1. User adds medicines → Checkout
2. System creates bill + QR (`pending`)
3. Admin reviews amount → **Approve** (creates PO) or **Cancel**
4. Admin marks **Dispatch** when medicine is ready
5. Reports section tracks buyers and statuses; Email button prompts for an email id and sends the report

## Email reports

By default (no SMTP), reports are saved to a **local outbox** and opened in a browser preview.
They will **not** appear in a real Gmail/Outlook inbox until SMTP is configured.

### Real inbox delivery (Gmail)

1. Copy `backend/.env.example` → `backend/.env`
2. Create a Gmail [App Password](https://myaccount.google.com/apppasswords)
3. Set:

```env
SMTP_SERVICE=gmail
SMTP_USER=your.email@gmail.com
SMTP_PASS=your_16_char_app_password
MAIL_FROM="Shubh Surgical Reports <your.email@gmail.com>"
```

4. Restart the backend (`npm start` in `backend/`)

## Go live (others can access)

See **[DEPLOY.md](DEPLOY.md)** for a full Render walkthrough.

Short version:
1. Push this project to GitHub
2. Create a **Web Service** on [render.com](https://render.com)
3. Build: `npm install --prefix backend && npm install --prefix frontend && npm run build --prefix frontend`
4. Start: `node backend/server.js`
5. Share the public URL Render gives you
