=====================================================================================
                                   S I P V A U L T
             Buy a bottle once - keep it at your bar - order pegs from your vault
=====================================================================================

CONTENTS
  1.  What the app does
  2.  How a typical night works (user flows)
  3.  Architecture: BETA (one server) vs PROD (S3 + CloudFront + RDS)
  4.  Technology used and WHY each piece is needed
  5.  Folder & file guide (what every file is for)
  6.  Database tables explained
  7.  Environment variables (.env) explained
  8.  Run it on your own computer (local development)
  9.  Deploy the BETA to a single server (step by step)
  10. Day-to-day operations (update, logs, backups, restore, migrations)
  11. Real payments (replacing the "mock" provider)
  12. Moving to PRODUCTION: S3, CloudFront, RDS
  13. Security checklist
  14. Legal / compliance notes
  15. Troubleshooting
  16. Pushing this code to Git
  17. What's next (roadmap)


-------------------------------------------------------------------------------------
1. WHAT THE APP DOES
-------------------------------------------------------------------------------------
SipVault has three portals in ONE web application:

  CUSTOMER  (/vault, /bars, /order/...)
    - Signs up (age-checked), logs in.
    - Buys a bottle of their favourite liquor at a bar. The bottle goes into their
      "vault" and is physically kept at that bar.
    - At the bar, scans the QR code on the table, picks a bottle from the vault and
      orders pegs (30 ml each by default). The bottle picture visually empties as
      drinks are served.

  BAR OWNER / BAR STAFF  (/bar/...)
    - Live order screen: new orders appear instantly with TABLE NUMBER, customer,
      drink, quantity and note. Buttons: Accept -> Mark served / Reject.
    - Customer bottles held at the bar (with expiry dates).
    - Owner only: menu & prices, tables + printable QR codes, staff logins.

  ADMIN  (/admin)
    - Onboards bars (creates the bar + the owner's login).
    - Manages the global product catalog (brand, name, category, size, image).
    - Sees totals: bars, customers, bottles sold, gross sales.


-------------------------------------------------------------------------------------
2. HOW A TYPICAL NIGHT WORKS
-------------------------------------------------------------------------------------
  a) Customer buys "Glenfiddich 12, 750 ml" at The Oak Room -> pays
     -> a VaultBottle is created: total 750 ml, remaining 750 ml, kept 90 days.

  b) Customer sits at table 7, scans the QR -> opens /order/<barId>/7
     -> chooses "2 pegs (60 ml)" + note "on the rocks" -> Order is PLACED.
     -> 60 ml is RESERVED on the bottle (can't be ordered twice).

  c) Bar screen beeps, shows "Table 7 - 2 x 30 ml Glenfiddich 12 - on the rocks".
     Bartender taps "Accept", pours, taps "Mark served".
     -> 60 ml is DEDUCTED (remaining 690 ml), a ledger entry is written,
        the customer's vault refreshes and the bottle drains on screen.
     If the bar taps "Reject" (or the customer cancels before acceptance) the
     reserved 60 ml goes back to the bottle.

  d) When remaining reaches 0 the bottle becomes EMPTY. After "keep days" it expires.


-------------------------------------------------------------------------------------
3. ARCHITECTURE
-------------------------------------------------------------------------------------
BETA (what this repo deploys today) - everything on ONE server with Docker Compose:

      Browser ──HTTPS──► [ caddy ] ──► /media/*  -> image files on Docker volume
                             │
                             └──────► everything else -> [ web : Next.js ]
                                                             │        │
                                                     [ postgres ]  [ redis ]

  - ONE codebase, ONE Docker image for the app. No separate code for S3/CDN.
  - Images are saved on the server disk (Docker volume "uploads").
  - Database runs in a container, backed up nightly.

PROD (later) - same code, only .env changes:

      Browser ──► CloudFront ──► /media/*, /_next/static/*  -> S3 bucket
                      │
                      └────────► EC2 (caddy + web) ──► RDS PostgreSQL
                                                   └─► Redis (container or ElastiCache)

  The code already has a storage switch (lib/storage) and builds image URLs from
  an env variable, so moving to S3/CloudFront/RDS is configuration only (section 12).


-------------------------------------------------------------------------------------
4. TECHNOLOGY USED AND WHY
-------------------------------------------------------------------------------------
  Next.js 15 (App Router, TypeScript)
      The whole app: pages (React), backend logic (Server Actions) and API routes.
      One framework = one container for frontend + backend. "standalone" output
      makes a small production server.

  React 19 + Tailwind CSS 4
      UI and styling. Tailwind keeps styles inside the components (no big CSS files).

  Auth.js (next-auth v5)
      Login/logout and sessions. Email + password (bcrypt-hashed). Sessions are
      signed JWT cookies, so no session table is needed. Roles: CUSTOMER,
      BAR_STAFF, BAR_OWNER, ADMIN.

  PostgreSQL 16
      Main database. Chosen because it is reliable with money/stock-like data and
      supports the atomic "reserve ml only if enough is left" update we rely on.

  Prisma ORM
      Type-safe database access + schema file (prisma/schema.prisma) + migrations.

  Redis 7
      Only for publish/subscribe: when an order changes, the server publishes an
      event and every open bar screen / customer vault refreshes instantly.
      If Redis is down the app still works; pages just don't auto-refresh.

  Server-Sent Events (SSE)  - app/api/stream
      A one-way live connection from server to browser (simpler than WebSockets,
      works through Caddy/CloudFront, auto-reconnects).

  Caddy 2
      Reverse proxy in front of the app. Gets and renews free HTTPS certificates
      automatically, compresses responses, serves uploaded images directly.

  Docker + Docker Compose
      Each piece runs in its own container on one server; one command starts or
      updates everything. Same setup on your laptop and on the server.

  GitHub Actions
      Builds on every push (catches errors). On push to "main" it SSHes into the
      server and redeploys.

  zod          - validates every form input on the server.
  bcryptjs     - password hashing.
  qrcode       - generates the table QR codes.
  ioredis      - Redis client.
  @aws-sdk/client-s3 - used only when STORAGE_DRIVER=s3 (prod).


-------------------------------------------------------------------------------------
5. FOLDER & FILE GUIDE
-------------------------------------------------------------------------------------
sipvault/
├── README.txt                  This file.
├── package.json                Dependencies + npm scripts (dev, build, db:*).
├── tsconfig.json               TypeScript settings ("@/..." import alias).
├── next.config.ts              Next.js settings: standalone build, CDN asset prefix,
│                               upload size limit.
├── postcss.config.mjs          Enables Tailwind CSS.
├── next-env.d.ts               Next.js TypeScript types (auto-generated style file).
├── .env.example                Template of all settings. Copy to .env.
├── .gitignore                  Keeps secrets (.env), node_modules, uploads out of git.
├── .gitattributes              Forces Linux line endings on .sh files (Windows safety).
├── .dockerignore               Keeps junk/secrets out of the Docker image.
├── Dockerfile                  Builds the app image (deps -> build -> small runtime).
├── docker-compose.yml          BETA server stack: caddy, web, postgres, redis.
├── docker-compose.dev.yml      Local dev: only postgres + redis.
│
├── .github/workflows/deploy.yml   CI build + auto-deploy to the server.
│
├── deploy/
│   ├── Caddyfile               HTTPS, /media file serving, proxy to Next.js.
│   ├── docker-entrypoint.sh    Runs DB migrations then starts the app (in container).
│   ├── setup-server.sh         One-time Ubuntu setup: Docker, firewall, swap, /opt/sipvault.
│   ├── backup.sh               Nightly DB + uploads backup (+ optional off-server copy).
│   └── restore.sh              Restore DB from a backup file.
│
├── prisma/
│   ├── schema.prisma           Database tables (section 6).
│   ├── seed.mjs                Creates admin + optional demo bar/users/products/tables.
│   └── migrations/             (created by you - see section 10 "Migrations")
│
├── public/robots.txt           Asks search engines not to index the beta.
│
├── lib/                        Shared server-side code
│   ├── db.ts                   Prisma client (single shared instance).
│   ├── auth.ts                 Auth.js config: email/password login, role in session.
│   ├── session.ts              requireUser / requireBarUser / requireBarOwner guards.
│   ├── redis.ts                publish() + subscriber for live updates.
│   ├── payments.ts             Payment abstraction ("mock" in beta).
│   ├── uploads.ts              Validates + stores images (type/size checks).
│   ├── format.ts               Money and date formatting (INR, IST by default).
│   ├── types.ts                FormState type for form results.
│   └── storage/
│       ├── index.ts            Picks local or S3 driver; mediaUrl() builds image URLs.
│       ├── types.ts            Storage interface.
│       ├── local.ts            BETA: save files to UPLOAD_DIR on disk.
│       └── s3.ts               PROD: save files to S3.
│
├── components/
│   ├── BottleGauge.tsx         The animated SVG bottle (liquid level = ml left).
│   ├── ActionForm.tsx          Form wrapper showing errors/success from server actions.
│   ├── LiveRefresh.tsx         Listens to /api/stream and refreshes the page (+ beep).
│   ├── Nav.tsx                 Top navigation by role + logout.
│   └── StatusBadge.tsx         Coloured order status label.
│
└── app/                        Pages and routes (folder = URL)
    ├── layout.tsx              Page shell (nav + main), global CSS.
    ├── globals.css             Tailwind + small shared classes (btn, card, input...).
    ├── page.tsx                "/"  landing page; logged-in users go to their portal.
    ├── login/page.tsx          "/login"
    ├── register/page.tsx       "/register" (age check with LEGAL_DRINKING_AGE)
    ├── vault/page.tsx          "/vault"  customer's bottles + recent orders
    ├── bars/page.tsx           "/bars"   list of bars
    ├── bars/[barId]/page.tsx   "/bars/<id>"  bar's bottles & prices -> Buy
    ├── order/[barId]/[tableNo]/page.tsx
    │                           "/order/<barId>/<table>"  opened from the table QR code
    ├── bar/layout.tsx          Bar portal shell + tabs (owner vs staff)
    ├── bar/page.tsx            "/bar" -> redirects to /bar/orders
    ├── bar/orders/page.tsx     LIVE order queue with table numbers
    ├── bar/bottles/page.tsx    Customer bottles held at this bar
    ├── bar/menu/page.tsx       (owner) menu, prices, peg sizes
    ├── bar/tables/page.tsx     (owner) tables + printable QR codes
    ├── bar/staff/page.tsx      (owner) create staff logins
    ├── admin/layout.tsx        Admin-only guard
    ├── admin/page.tsx          Bars, catalog, stats
    ├── actions/                Server Actions = the backend business logic
    │   ├── auth.ts             login, register, logout
    │   ├── purchase.ts         buyBottle
    │   ├── orders.ts           placeOrder, cancelOrder, updateOrderStatus
    │   ├── bar.ts              menu, tables, staff
    │   └── admin.ts            createBar, createProduct, toggleBar
    ├── api/auth/[...nextauth]/route.ts   Auth.js endpoints
    ├── api/stream/route.ts     Server-Sent Events (live updates)
    ├── api/health/route.ts     Health check (used by Docker + uptime monitors)
    └── media/[...key]/route.ts Serves local images in dev (Caddy does it on the server)


-------------------------------------------------------------------------------------
6. DATABASE TABLES
-------------------------------------------------------------------------------------
  User         People. role = CUSTOMER | BAR_STAFF | BAR_OWNER | ADMIN.
               barId is set for owners/staff (which bar they work for).
  Bar          A venue. keepDays = how long bottles are kept for customers.
  BarTable     Tables of a bar (tableNo is unique per bar). Used in QR codes.
  Product      Global catalog: brand, name, category, volumeMl, imageKey.
  BarProduct   What a bar sells: product + price (priceMinor, in paise) + peg size.
  VaultBottle  A bottle a customer owns, kept at one bar:
                 totalMl, remainingMl, reservedMl (ordered, not yet poured),
                 pegSizeMl, status ACTIVE/EMPTY/EXPIRED, expiresAt.
  Purchase     Payment record for a bottle (provider, paymentRef, status).
  Order        A pour request: bottle, table, pegs, pourMl, note,
               status PLACED -> ACCEPTED -> SERVED (or REJECTED / CANCELLED).
  PourLedger   Audit trail: +750 PURCHASE, -60 POUR, ... Every ml is accounted for.

  Money is stored as whole numbers in the smallest unit (paise): 250000 = Rs 2,500.00.
  This avoids rounding errors with decimals.

  Concurrency safety: ordering uses ONE SQL statement that only reserves ml if
  "remaining - reserved >= requested", so double taps can't overdraw a bottle.
  Status changes use conditional updates so two bartenders can't serve twice.


-------------------------------------------------------------------------------------
7. ENVIRONMENT VARIABLES (.env)
-------------------------------------------------------------------------------------
  Copy .env.example to .env and edit. NEVER commit .env.

  DOMAIN               Domain Caddy gets HTTPS for (e.g. sipvault.example.com).
                       Use ":80" to test on a bare IP over plain HTTP.
  APP_URL              Public URL; printed inside the table QR codes.
  AUTH_SECRET          Secret that signs login cookies. Generate: openssl rand -base64 32
                       Changing it logs everyone out.
  AUTH_TRUST_HOST      true (we're behind Caddy).
  POSTGRES_USER/PASSWORD/DB   Database credentials for the postgres container.
  DATABASE_URL         Used for local dev. docker-compose overrides it on the server.
                       In PROD with RDS, set it to the RDS connection string.
  REDIS_URL            Used for local dev. docker-compose overrides it.
  STORAGE_DRIVER       local (beta) | s3 (prod)
  UPLOAD_DIR           Where local images are stored (compose sets /data/uploads).
  MEDIA_BASE_URL       Prefix for image URLs. Beta: /media   Prod: https://cdn.yourdomain.com
  AWS_REGION, S3_BUCKET   Only for STORAGE_DRIVER=s3.
  ASSET_PREFIX         Build-time. CDN URL for JS/CSS (prod only). Leave empty in beta.
  PAYMENT_PROVIDER     mock (beta, no money) | razorpay/stripe (to be implemented).
  CURRENCY             INR by default (formatting only).
  LEGAL_DRINKING_AGE   Minimum age at sign-up (default 21; varies by state/country).
  DISPLAY_TIMEZONE     Asia/Kolkata by default.
  SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD   First admin account created by the seed.
  SEED_DEMO            true = also create demo bar, users, products, tables.
  BACKUP_RSYNC_TARGET  Optional user@host:/path to copy backups off the server.


-------------------------------------------------------------------------------------
8. RUN IT ON YOUR OWN COMPUTER (LOCAL DEVELOPMENT)
-------------------------------------------------------------------------------------
  Install first:
    - Node.js 20 LTS          https://nodejs.org
    - Docker Desktop          https://www.docker.com/products/docker-desktop
    - Git                     (already installed)

  Steps (PowerShell or Git Bash, inside the sipvault folder):

    1) copy .env.example .env
       Edit .env: set POSTGRES_PASSWORD=sipvault and in DATABASE_URL use the same
       password, e.g.
         DATABASE_URL=postgresql://sipvault:sipvault@localhost:5432/sipvault?schema=public
       Set AUTH_SECRET to any long random string, APP_URL=http://localhost:3000

    2) docker compose -f docker-compose.dev.yml up -d      (starts postgres + redis)

    3) npm install

    4) npx prisma migrate dev --name init
       -> creates the tables AND the folder prisma/migrations. COMMIT that folder.

    5) npm run db:seed

    6) npm run dev     -> open http://localhost:3000

  Demo logins (from the seed):
    Admin      admin@sipvault.local / ChangeMe@123   (or your SEED_ADMIN_* values)
    Bar owner  owner@demo.local     / Demo@1234
    Bartender  staff@demo.local     / Demo@1234
    Customer   guest@demo.local     / Demo@1234

  Try the full flow: log in as guest -> Buy a Bottle -> The Oak Room -> Buy.
  In another browser (or private window) log in as owner -> Tables & QR -> open a
  table link (or go to /order/<barId>/1 as the guest) -> order -> watch it appear
  on /bar/orders -> Mark served -> the guest's bottle drains.

  Useful: npm run db:studio   (browse/edit the database in the browser)


-------------------------------------------------------------------------------------
9. DEPLOY THE BETA TO A SINGLE SERVER
-------------------------------------------------------------------------------------
  Server: AWS EC2 t3.medium / t4g.medium (2 vCPU, 4 GB RAM), Ubuntu 24.04,
          30-50 GB gp3 disk, Elastic IP attached.
          Security group: allow 22 (your IP only), 80, 443 from anywhere.
  DNS:    create an A-record  sipvault.yourdomain.com -> Elastic IP.

  1) SSH in and clone the repo:
       ssh ubuntu@<server-ip>
       sudo mkdir -p /opt/sipvault && sudo chown $USER /opt/sipvault
       git clone <your-repo-url> /opt/sipvault
       cd /opt/sipvault

  2) One-time server setup (Docker, firewall, swap):
       bash deploy/setup-server.sh
       exit    # log out and SSH back in so the docker group applies

  3) Create the env file:
       cd /opt/sipvault
       cp .env.example .env
       nano .env
         DOMAIN=sipvault.yourdomain.com
         APP_URL=https://sipvault.yourdomain.com
         AUTH_SECRET=<output of: openssl rand -base64 32>
         POSTGRES_PASSWORD=<strong password>
         SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD = your real admin login
         SEED_DEMO=false   (or true for a demo)
       chmod 600 .env

  4) Start everything:
       docker compose up -d --build
     First build takes a few minutes. Check:
       docker compose ps
       docker compose logs -f web
     On start the web container applies migrations automatically
     (deploy/docker-entrypoint.sh).

  5) Create the admin (and demo data if SEED_DEMO=true):
       docker compose exec web node prisma/seed.mjs

  6) Open https://sipvault.yourdomain.com  (Caddy fetched the certificate itself).

  7) Nightly backups:
       chmod +x deploy/*.sh
       crontab -e
         30 2 * * * /opt/sipvault/deploy/backup.sh >> /opt/sipvault/backups/backup.log 2>&1
     Set BACKUP_RSYNC_TARGET (or copy backups/ to S3/another machine) - a backup on
     the same disk does NOT protect you if the server dies. Also enable EBS snapshots
     (AWS Data Lifecycle Manager) for the server disk.

  8) Auto-deploy from GitHub (optional):
       In GitHub repo -> Settings -> Secrets -> Actions add:
         SERVER_HOST, SERVER_USER (ubuntu), SERVER_SSH_KEY (private key)
       Every push to "main" now builds and redeploys.
       (The server must be able to "git pull" - use a deploy key for private repos.)

  9) Monitoring (recommended): free uptime check (UptimeRobot / Uptime Kuma) on
       https://sipvault.yourdomain.com/api/health


-------------------------------------------------------------------------------------
10. DAY-TO-DAY OPERATIONS
-------------------------------------------------------------------------------------
  Update to latest code (manual):   cd /opt/sipvault && git pull && docker compose up -d --build
  View logs:                         docker compose logs -f web      (or caddy, postgres)
  Restart app only:                  docker compose restart web
  Stop everything:                   docker compose down            (data volumes are kept)
  DANGER - delete all data:          docker compose down -v
  Open a DB shell:                   docker compose exec postgres psql -U sipvault sipvault
  Run backup now:                    ./deploy/backup.sh
  Restore DB:                        ./deploy/restore.sh backups/db_<date>.sql.gz
  Rollback code:                     git checkout <previous-commit> && docker compose up -d --build

  Migrations (changing the database):
    - Edit prisma/schema.prisma on your PC.
    - npx prisma migrate dev --name <what_changed>   (creates prisma/migrations/...)
    - Commit + push. The server applies it on next start ("prisma migrate deploy").
    - IMPORTANT: until prisma/migrations exists, the container uses "prisma db push"
      (fine for the first beta deploy). Create the "init" migration (section 8 step 4)
      as soon as possible and commit it. If you already deployed with db push, run once
      on your PC against an EMPTY local DB:  npx prisma migrate dev --name init
      and on the server mark it as applied:
        docker compose exec web prisma migrate resolve --applied <folder_name_of_init>


-------------------------------------------------------------------------------------
11. REAL PAYMENTS
-------------------------------------------------------------------------------------
  Beta uses PAYMENT_PROVIDER=mock: "Buy" succeeds instantly, no money is taken.
  To go live (e.g. Razorpay for India):
    1. Create a Purchase with status PENDING and a Razorpay order (server side).
    2. Open Razorpay Checkout in the browser.
    3. Add a webhook route app/api/payments/webhook/route.ts that VERIFIES the
       signature, marks the Purchase PAID and only then creates the VaultBottle
       (move the transaction from app/actions/purchase.ts into that handler).
    4. Never trust the browser saying "payment done" - only the webhook.
  Keep provider keys in .env (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, webhook secret).


-------------------------------------------------------------------------------------
12. MOVING TO PRODUCTION (S3 + CloudFront + RDS)
-------------------------------------------------------------------------------------
  Same code, same Docker image - only infrastructure and .env change.

  A) Images -> S3 + CloudFront
     1. Create private S3 bucket (e.g. sipvault-media-prod), Block Public Access ON.
     2. Create CloudFront distribution with the bucket as origin using Origin Access
        Control (OAC). Optional custom domain cdn.yourdomain.com + ACM certificate
        (must be in us-east-1 for CloudFront).
     3. Give the EC2 instance an IAM role allowing s3:PutObject/DeleteObject on the
        bucket (no access keys in .env needed).
     4. Copy existing images:
          docker run --rm -v sipvault_uploads:/data amazon/aws-cli s3 sync /data s3://sipvault-media-prod
        (or install aws cli on the host and sync the volume path)
     5. .env:  STORAGE_DRIVER=s3  S3_BUCKET=sipvault-media-prod  AWS_REGION=ap-south-1
               MEDIA_BASE_URL=https://cdn.yourdomain.com
     6. docker compose up -d   -> new uploads go to S3; images load from CloudFront.
        Image keys in the DB don't change, so no data migration.

  B) JS/CSS -> CloudFront (optional, nice speed-up)
     Simplest: put CloudFront in front of the whole site (origin = your EC2/Caddy
     domain, cache /_next/static/* for long, forward everything else uncached with
     all headers/cookies). No code change needed.
     Alternative: build with ASSET_PREFIX=https://cdn.yourdomain.com and upload
     .next/static to S3 under _next/static in CI.

  C) Database -> RDS PostgreSQL
     1. Create RDS PostgreSQL 16 (Multi-AZ for prod), private subnet, security group
        allowing 5432 only from the EC2 security group. Enable automated backups.
     2. Short maintenance window: docker compose stop web
          docker compose exec -T postgres pg_dump -U sipvault -Fc sipvault > final.dump
          pg_restore -h <rds-endpoint> -U <user> -d sipvault --no-owner final.dump
     3. In docker-compose.yml set web's DATABASE_URL to the RDS URL (add ?sslmode=require),
        remove the postgres service + depends_on.
     4. docker compose up -d

  D) Later scaling: ElastiCache for Redis, 2+ EC2s behind an ALB (sessions are JWT and
     files are on S3, so the app is already stateless), or move containers to ECS.


-------------------------------------------------------------------------------------
13. SECURITY CHECKLIST
-------------------------------------------------------------------------------------
  [ ] Strong AUTH_SECRET and POSTGRES_PASSWORD; .env is chmod 600 and NOT in git.
  [ ] Change the seed admin password after first login (or set SEED_ADMIN_PASSWORD).
  [ ] SSH: key-only login, port 22 open to your IP only.
  [ ] Postgres/Redis are NOT exposed to the internet (compose doesn't publish ports).
  [ ] Backups copied off the server and a restore tested once.
  [ ] Keep Ubuntu updated: sudo apt update && sudo apt upgrade (monthly).
  [ ] Before real users: add rate limiting on login, email/phone verification,
      password reset, and real payment webhooks.
  [ ] Never store AWS keys in the repo - use the EC2 IAM role.


-------------------------------------------------------------------------------------
14. LEGAL / COMPLIANCE NOTES (please verify with a lawyer)
-------------------------------------------------------------------------------------
  - Alcohol laws differ by state/country. In India they are state subjects; online
    sale of liquor is mostly restricted. The model here keeps the BAR as the seller:
    the bottle is bought for, stored at and poured at a licensed bar.
  - Age verification: sign-up checks date of birth against LEGAL_DRINKING_AGE.
    For production add ID/KYC verification and staff ID checks at the bar.
  - Bottle keeping periods, refunds and expiry handling should be in your terms.


-------------------------------------------------------------------------------------
15. TROUBLESHOOTING
-------------------------------------------------------------------------------------
  Site not loading / certificate errors
     - DNS A-record must point to the server; ports 80 and 443 must be open.
     - docker compose logs caddy
  "web" keeps restarting
     - docker compose logs web  (usually wrong DATABASE_URL / POSTGRES_* or AUTH_SECRET)
  Build killed / out of memory on the server
     - setup-server.sh adds 2 GB swap; or build the image in CI and push to a registry.
  Live orders don't appear without refresh
     - Check redis is running: docker compose ps
     - Behind another proxy/CDN, make sure /api/stream is not cached or buffered.
  ".sh: not found" or "\r" errors
     - Script got Windows line endings. .gitattributes prevents this; on the server
       fix with: sed -i 's/\r$//' deploy/*.sh
  Images not showing
     - Beta: MEDIA_BASE_URL must be /media. Prod: check CloudFront/S3 permissions (OAC).
  Logged out after deploy
     - AUTH_SECRET changed. Keep it the same across deploys.


-------------------------------------------------------------------------------------
16. PUSHING THIS CODE TO GIT
-------------------------------------------------------------------------------------
  IMPORTANT: run these INSIDE the sipvault folder (not its parent, which contains
  credential files that must never be committed).

    cd D:\RahulDevops\sipvault
    git init
    git add .
    git status            # check: no .env, no passwords, no node_modules
    git commit -m "SipVault beta scaffold"
    git branch -M main
    git remote add origin https://github.com/<you>/sipvault.git
    git push -u origin main

  After your first "npm install" commit package-lock.json too (makes builds repeatable).
  After "npx prisma migrate dev --name init" commit prisma/migrations/.


-------------------------------------------------------------------------------------
17. WHAT'S NEXT (ROADMAP)
-------------------------------------------------------------------------------------
  - Real payments (Razorpay/Stripe) with webhooks.
  - Phone OTP login, password reset, email verification.
  - KYC / ID check for age.
  - Job to mark bottles EXPIRED + reminder notifications (WhatsApp/SMS/email).
  - Gift / share a bottle with a friend.
  - Bar reports (pours per day, top brands), CSV export.
  - PWA (installable app + push notifications).
  - Automated tests (Playwright for flows, unit tests for order logic).
=====================================================================================
