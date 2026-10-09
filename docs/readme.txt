npm run install:all

npm run start:api
npm run start:web


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

------------------------------
In main page 'http://localhost:4200/login' change the name of website
 name replace with My Store Hub
Slogan - Your Trusted Partner in Health and Wellness. 
replace with 'Your name, your products, your customers.'
Add logo 'MyStoreHib.jfif' also apply theme for this page as per logo

In main page 'http://localhost:4200/login' near login button, logo is not visiable proper fix this
Also add some animation in logo above slogan
Slogan should be present in better way
catalogue and Login button showing proper fix it
Catalogue button display after login button


In catalogue Replace 'Medicines' word with 'Cutsomer Products'
remove card 'Trusted medical supply'
, 'Trusted medical supply', logo, 'Your name, your products, your customers.'
change some products name 

In main page 'http://localhost:4200/login'
remove 'Register' button from 
fix some layout in main page that look proper to users
page and button  should be responsive

when login as 'asitkumarsinha@gmail.com'
logo and name should be same as login page

Also when i select 'Customer customization' and selected 'Shubh Surgical' Theme colour is white but this is not 
reflecting, fix it. when we customize the Theme / Heading font / QR Code / Website logo / Login Initial / Website slogan / Website title / 
as per Customer. when login as per Login Initial then all field pick the value and customise the website for particular customer


In Help Center PDF, update name 
'Shubh Surgical' to 'My Store Hub'
also update the document as per current User interface.

In Browser title - showing 'My Store Hub | Online Medicine Store'
replace with 'My Store Hub'
and heart icon replace with 'My Store Hub' icon

In main page 'http://localhost:4200/login' Hide remove 'New customer? Create an account'

In http://localhost:4200/admin/medicines page, update 'medicines' name with 'Products'  every where
also check the layout of the page and should be responsive , fix it


In http://localhost:4200/tenants url
add Email in Customer businesses for all customers
customer can login with Email and password as admin

In http://localhost:4200/tenants url
add option to delete customer after confirmation


In http://localhost:4200/tenants , Add Customer Replace with Tenants
In http://localhost:4200/settings Dashboard replace with Settings
In http://localhost:4200/feedback View Customer replace with Feedbacks

In http://localhost:4200/admin url name replace with http://localhost:4200/admin/customers_tenats
Add Client replace with Clients
remove View Client
In http://localhost:4200/admin/medicines url name replace with http://localhost:4200/admin/Products
View Product replace with Orders
Top Product replace with Reports
Add Employee replace with Add / View Employee
Remove 'View Employee', 'Top Employee','Products'
Low Stock replace with Manage Products
'Payment', 'Clone Client' deactivate




when user login this website, first page always http://localhost:4200/login
when login as client email-id, then page layout should be same as per attached screen shot
when click on Shop then all product list will display and client can add into the cart
when click on cart then http://localhost:4200/cart will show the page layout should same as per attached image
when click on My Order then http://localhost:4200/orders  will show the page layout should same as per attached image
In Title bar always show who login in right hand side
Left hand Menu user can collapse and expand as per click on pin in left menu

In title always show login 'user name - Super Admin / Customer / Client' as per category
when login from @Initial, logo should show proper , same like 'http://localhost:4200/login' 'MyStoreHub' logo
In Left menu, when click on Pin , after menu collapse, menu icon should show
at last  optimize the code and git commit and push

when this website will open, show the website feature same like in 'Demo' content http://localhost:4200/demo.
'Demo' text rewrite and cover all the features of MyStoreHub and compare with Shopify and dukan and please contact to MyStoreHub team.
contact us , email icon + MyStoresHubs@gmail.com
This window will close auto after 10 seconds or Esc key or key out side, then land on http://localhost:4200/login page


perform Unit testing of this website.
this website is for multi-tenant
when login from 'asitkumarsinh@gmail.com' as super admin
super admin can create customer, based of 'Initial login', website will customize
admin can create clients and employee
all customer work as multi-tenant



In https://www.mystoreshubs.com/register page apply the same layout
of https://www.mystoreshubs.com/login 
In 'Create account' replace with 'Contact Us'
left hand side logo panel remove
Address label replace with Remark
when click on 'Register' button, only 'Super Admin' can see the request in Grid.
In https://www.mystoreshubs.com/login page, after login screen
https://www.mystoreshubs.com/demo content will show and 'MyStoreHub vs Shopify vs Dukaan' when click on this then content will show
Also when click on Translate then all page content will translate as per selection
In login page 'https://www.mystoreshubs.com/login' image should show proper.
where 'Medicine', 'Shubh Surgical' or 'shubhsurgical' replace with 'My Stores Hubs'


In 'http://localhost:4200/login' page
'Feedback' text replace with 'Register Me'
In 'http://localhost:4200/register' text 'Contact Us' replace with 'Register Me'
and all field should mandatory
In 'http://localhost:4200/login' page
click 'forgot password' then  User Interface will popup
ask 'User Name', 'EmailID', 'Mobile Number' and 'New Password'
if 'User Name', 'EmailID' and 'Mobile Number' match then update the password
otherwise , show message and all field should mandatory




In 'http://localhost:4200/demo' before 'MyStoreHub vs Shopify vs Dukaan'
add
'My Stores Hubs

One website that runs many branded online stores. Shoppers see a Shopping Mall of stores. Each store has its own name, logo, colours, and products. The store owner manages orders, clients, and staff. One Super Admin looks after every store on the platform.

Your name, your products, your customers.

Who uses it
1. Super Admin
   Sets up each customer (store), branding, plans, and backups. Sees contact requests from the Register Me page.
2. Hubs - Customer 
   Runs one store: products, prices, orders, clients, and employees.
3. Stores - Client (shopper)
   Shops in that store, pays, and tracks orders.

What a Stores - client can do
- Browse the Shopping Mall and open a store
- Search the catalogue, see stock and pictures, and add products to a personal cart
- Check out with a bill and UPI QR payment
- See My Orders and the status of each order
- Pay the retail or wholesale price assigned to their group
- Use the site in English, Hindi, Spanish, or French

What a Hubs - customer can do
- See today’s orders, revenue, and low stock on the dashboard
- Add and edit products with a retail price and a wholesale price
- Approve a bill, create a purchase order, then dispatch
- Add clients, block or allow login, keep notes, and export a CSV
- Add and view employees
- Open sales reports and email a report

What the Super Admin can do
- Create a separate store for each customer on the same website
- Give each store its own title, slogan, logo, QR code, and theme
- Use a Login Initial, such as @mystoreshubs, so that email loads that store’s look
- Manage plans, modules, backups, feedback, and website visits
- Read Register Me requests. Only the Super Admin sees that list.

How a new customer starts
1. Open the website and choose Register Me.
2. Enter full name, email, mobile number, and a remark. All four are required.
3. The My Stores Hubs team reviews the request and sets up the store.
4. Staff sign in with the store email. Shoppers sign in as clients of that store.
5. If a password is forgotten, Forgot Password asks for user name, email, and mobile number. The password changes only when those three match the account.

Contact
support@mystoreshubs.com
Powered by My Store Hub Technologies
'
Shop & Checkout replace wth 'Stores - Clients'
Shop & Checkout replace with 'Hubs - Customers'
Super Admin Platform replace with - 'Super Admin'
in proper presenation.

In title bar 'User Login' alwas right hand, in all pages



In 'http://localhost:4200/feedback' add drop down in 'Contact requests' and 'Website feedback'
- 'Action' drop down  it should contain
'Done', 'Pending'
also in 'http://localhost:4200/login' add Theme icon - Black / white. if select 
Black then all page convert into Black Theme and same for white
also 'http://localhost:4200/login' page logo should be proper fit and visable