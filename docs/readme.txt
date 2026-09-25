Here are feature-side improvements, grouped by who benefits:

## Customer-facing

**Shopping**
- Search bar with autocomplete (name, category, salt/composition)
- Filters: category, price range, brand, prescription-required, in-stock only
- Sort: price low→high, popularity, newest
- Product detail page: full description, dosage info, pack size, expiry, manufacturer, reviews
- Wishlist / favourites
- "Buy again" quick reorder from My Orders
- Recently viewed items
- Compare two medicines side by side

**Checkout & payment**
- Multiple payment options: UPI, card, cash on delivery/pickup
- Save multiple delivery addresses; choose at checkout
- Delivery slot selection or "pickup from store" option
- Apply coupon / discount code
- GST invoice download (PDF) after dispatch
- Order cancellation within a time window (before approval)
- Partial order handling if one item is out of stock

**Post-order**
- Order tracking timeline with live status
- SMS/WhatsApp/email notification on each status change
- Return / refund request flow
- Rate & review delivered medicines
- Download past invoices anytime

**Account**
- Profile page: edit name, phone, addresses, change password
- Prescription upload (photo) for Rx-only medicines
- Family members under one account
- Loyalty points / wallet credit

## Admin-facing

Done **Dashboard (new landing page)**
- Cards: today's orders, pending approvals, revenue, low stock, new clients
- Quick actions: approve pending order, restock item, add employee

**Catalogue management**
- Bulk upload medicines via CSV/Excel
- Categories & subcategories management
- Expiry date tracking with alerts (30/60/90 days)
- Batch-level stock with FEFO (first-expiry-first-out)
- Low-stock threshold per item + restock reminders
- Featured / banner products on the shop home

**Orders**
- Bulk approve / dispatch
- Print packing slip
- Assign delivery person
- Refund management screen

**Clients**
- Client detail page: full order history, total spend, notes
- Client groups (retail / wholesale) with different pricing
- Export client list

**Employees**
- Roles & permissions per employee (who can approve orders, edit stock)
- Attendance / activity log
- Task assignment

**Reports**
- Date-range filters on all reports
- Sales by category, by medicine, by client
- Profit margin report
- Export to Excel/PDF
- Scheduled daily/weekly email report

**Marketing**
- Announcement banner on the shop page (offers, notices)
- Coupon/discount management
- Featured offers section on home

## Site-wide
- Dark/light theme toggle
- Language switch (English/Hindi)
- Mobile-first polish; installable PWA ("Add to home screen")
- Contact / WhatsApp support button
- FAQ page linked from Help Center

## Suggested priority order
1. **Search + filters + product detail page** (biggest customer win)
2. **Invoice PDF download + order notifications**
3. **Admin dashboard + date-filtered reports + CSV export**
4. **Coupons + wishlist + reorder**
5. **Prescription upload + client groups/wholesale pricing**
6. **PWA + theme toggle + language switch**

Tell me which ones you want and I'll build them in that order.

Create a new Role - 'Super Admin', when login from 'asitkumarsinha@gmail.com' and password 'Shivansh2026'
this login consider as 'Super Admin'. Super Admin can see 'Setting' button. when click on button Super Admin can change

Customers / Tenants

Create new customer business
Activate, suspend, or archive customer
View subscription status and expiry
Configure store name, logo, contact details, GST, address
Website Customization

Theme colors, fonts, login banner, homepage text
Logo, favicon, product images, QR/payment image
Custom domain or subdomain, such as client-name.yourapp.com
Enable Hindi/English and other site-wide options
Modules / Feature Control

Turn features on/off per customer: wholesale pricing, employees, reports, QR checkout, coupons, prescription upload, etc.
This lets you sell Basic, Professional, and Enterprise plans.
Initial Setup Template

Create a new customer from a reusable template
Add default medicine categories, roles, order statuses, invoice format, and sample data
Avoid manually configuring every new customer.
Customer Administrators

Create the first customer admin account
Reset admin password
Control maximum users/employees allowed by their plan
Never display existing passwords—only set a replacement password.
Subscription & Billing

Plan selected
Monthly/yearly price
Trial dates, renewal date, invoice/payment status
Storage, user, order, and medicine limits
Tenant Data

Usage dashboard: users, orders, medicines, storage
Export customer data
Backup/restore controls
Delete tenant only with strong confirmation and backup
Support & Audit

Customer support tickets/notes
Audit log for configuration changes
“Login as customer admin” only if required, with explicit reason and audit logging
----------------------------------------

Use Super Admin as the **platform owner**, not as a store operator. You sell and configure customer businesses. Each customer’s own admin then runs their shop.

## 1. Log in as Super Admin

1. Open [http://localhost:4200/login](http://localhost:4200/login).
2. Email: `asitkumarsinha@gmail.com`  
   Password: `Shivansh2026`
3. Click **Sign in**.
4. You land on **Website settings**. The top bar shows **Settings** and **Customers** only. You will **not** see Dashboard, Medicines, Orders, or Clients.

That is correct: Super Admin configures the product, store admins run daily operations.

## 2. Change the default website brand (Settings)

Use this for the default Shubh Surgical site (the primary tenant).

1. Click **Settings**.
2. Change **Website title** (today: Shubh Surgical).
3. Change **Website slogan**.
4. Upload a **logo** if you want a new brand mark.
5. Upload a **Checkout QR** image (shown on bills).
6. Click **Save website settings**.
7. Check the preview on the right. The top bar, login page, shop hero, and Checkout QR update.

## 3. Sell the product to a new customer (Customers)

1. Click **Customers**.
2. Fill **Create customer business**:
   - **Business name** — e.g. `Acme Medical`
   - **Tenant slug / subdomain** — e.g. `acme-medical` (used as their identity / future subdomain)
   - **First administrator** — their store owner’s name
   - **Administrator email** — unique email they will use to log in
   - **Administrator password** — at least 6 characters (you set it once; it is hashed and cannot be viewed later)
   - Phone, **Plan** (Basic / Professional / Enterprise), billing cycle, price, renewal date, custom domain
3. Tick the **modules** this plan includes (wholesale, employees, reports, QR checkout, coupons, prescriptions).
4. Keep **Copy the reusable starter catalogue template** checked if you want sample medicines copied from the main store.
5. Click **Create customer**.

The system creates:
- an isolated customer store
- their first **admin** login
- optional starter medicines
- usage counters (users, employees, medicines, orders)

Give the customer their admin email and the password you typed. They log in at the same login page and get the normal store Dashboard.

## 4. Activate, suspend, or archive

On each customer card, use the status dropdown:

- **Active** — they can log in and work.
- **Suspended** — they cannot use the portal (e.g. unpaid).
- **Archived** — closed customer. The primary Shubh Surgical tenant cannot be archived.

Status saves as soon as you change it.

## 5. Change plan, billing, store details, and features

1. Open a customer card.
2. Click **Subscription, store, and feature configuration**.
3. Update plan, price, payment status (`trial` / `paid` / `overdue` / `cancelled`), renewal date, GST, address, theme color, language.
4. Tick or untick modules (wholesale, employees, reports, etc.).
5. Click **Save configuration**.

Disabled modules are blocked for that customer (e.g. Employees API if Employees is off). Usage chips show how close they are to plan limits.

## 6. Reset the customer’s admin password

1. On the customer card click **Reset admin password**.
2. Enter a **new** password (6+ characters).
3. Share the new password with the customer.

You never see the old password. It stays encrypted.

## 7. Backup and archive

1. Click **Export backup** first. A JSON file downloads (tenant, users, medicines, employees, orders). Keep this file.
2. To close a customer (not the main Shubh Surgical tenant): click **Archive**, then type the **exact business name** when asked.
3. The store is archived; data remains in your backup file.

## 8. How the three logins differ

| Who | Login | What they see |
|---|---|---|
| Super Admin | `asitkumarsinha@gmail.com` | Settings + Customers only |
| Store admin | e.g. `admin@shubhsurgical.com` or the email you created | Dashboard, stock, orders, clients, employees, reports |
| Shopper | e.g. `user@shubhsurgical.com` | Shop, cart, my orders |

Typical sale flow:

1. Super Admin creates the customer and first admin.  
2. Customer admin logs in and runs their store.  
3. Super Admin later changes plan, modules, billing, or resets the admin password.

Custom domain is stored on the customer record. Pointing `acme-medical.yourapp.com` or `shop.customer.com` at this app still needs hosting/DNS setup; it is not automatic on localhost.

shiva@gmail.com
