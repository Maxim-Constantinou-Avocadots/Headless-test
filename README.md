# Willowbrook Animal Rescue

The website for Willowbrook Animal Rescue, Bristol — a Wix Managed Headless
site built with Astro. Visitors browse animals available for adoption, read a
full profile, and apply to adopt a specific animal. There is also a small merch
shop that funds the shelter, and a newsletter signup in the footer.

- **Site dashboard:** https://manage.wix.com/dashboard/7485a5cf-ddfa-4799-9587-be1611c35917

---

## For the shelter — how to run the site day to day

You do not need to touch any code for any of this. Everything below happens in
the Wix dashboard, and changes appear on the live site immediately — there is
no "publish" step to remember.

### Add a new animal

1. Open the dashboard and go to **CMS** → **Animals**.
2. Click **+ Add Item**.
3. Fill in the fields. These are the ones that matter most:
   - **Name** — what you call them.
   - **Slug** — the web address. Use lowercase with hyphens and no spaces, e.g.
     `bramble` or `pip-and-pod`. It must be different from every other animal.
   - **Status** — `Available`, `Pending`, or `Adopted`. Spelling matters.
     - `Available` shows in the main list.
     - `Pending` is hidden unless a visitor ticks "include pending".
     - `Adopted` disappears from the list and moves to **Happy endings** at the
       bottom of the Adopt page.
   - **Age (months)** — always in months. The site converts it, so `30` shows
     as "2 years" and `8` shows as "8 months".
   - **Main image** — the photo on the card. See "Photographs" below.
   - **Short description** — one line, shown on the card.
   - **Full description** — the long story, shown on their own page.
   - **Featured** — tick this for the animals you want on the home page. Three
     or four is about right. If you tick none, the home page falls back to the
     newest available animals on its own.
4. Click **Save**. The animal is live.

**Bonded pairs** (animals that must be rehomed together): create a record for
each animal, then open one and set **Bonded with** to the other. Do the same in
reverse on the second record. Each page then tells visitors they come as a pair.

### Review adoption applications

1. Go to **CMS** → **Adoption Applications**.
2. Each row is one application, newest at the bottom. Click one to read it.
3. Use the **Status** field to track it: `New` → `Reviewing` → `Approved` or
   `Declined`. This is for you — it is never shown on the website.

Applications are private. They can only be read by you and other people you
have given dashboard access to. Nothing about them is visible on the public
site, and the website itself cannot read them back.

### Export the subscriber list

1. Go to **CMS** → **Subscribers**.
2. Click the **⋯** menu at the top right of the table → **Export to CSV**.
3. The file downloads with email, first name, where they signed up, and when.

Anyone who unsubscribes should have their **Status** changed to `Unsubscribed`
rather than being deleted, so they do not get re-added if they sign up again by
accident.

### Read contact-form messages

**CMS** → **Enquiries**. Same idea — private, newest at the bottom.

### Add a shop product

1. Go to **Store Products** in the dashboard (not CMS — the shop is a real Wix
   store, so orders, stock and payments all work the normal way).
2. Click **+ New Product**.
3. Set a name, price, a photo, and tick **Visible**. A product that is not
   visible will not appear on the site.
4. For sizes or colours, add them under **Product Options**. The website builds
   the size and colour pickers from whatever you set here.
5. Under **Inventory**, set the stock. When a size runs out the site crosses it
   out automatically; when everything runs out the product shows "Out of stock"
   and cannot be added to a basket.
6. To decide where it appears in the shop filter, add it to a **Category**.

Orders arrive in the normal **Orders** section of the dashboard.

### If you connect a custom domain, re-register it

Checkout redirects through the domain registered on the site's OAuth app, and
that registration does **not** update itself when the published domain changes
— `wix release` is documented to handle it and does not. When it is wrong,
clicking checkout fails with:

```
{"message":"Failed to extract metaSiteId",
 "details":{"applicationError":{"code":"FAILED_TO_FETCH_METASITE_ID_BY_DOMAIN"}}}
```

This happened once already: the app was still registered against the domain
from when the project was first provisioned, so checkout redirected to a dead
host. It is fixed for the current domain. If you later connect a custom
domain, a developer needs to patch the OAuth app again — add the new domain to
`allowedDomains`, `allowedRedirectDomains` and `allowedRedirectUris`, and set
`redirectUrlWixPages` to it:

```bash
SITE_ID=7485a5cf-ddfa-4799-9587-be1611c35917
CLIENT_ID=edf3f8da-beb5-43f8-bd1e-18bf0df02742
TOKEN=$(npx @wix/cli@latest token --site "$SITE_ID")

# GET first — PATCH replaces each array wholesale, so include what is there.
curl -sS "https://www.wixapis.com/oauth-app/v1/oauth-apps/$CLIENT_ID" \
  -H "Authorization: Bearer $TOKEN"

curl -sS -X PATCH "https://www.wixapis.com/oauth-app/v1/oauth-apps/$CLIENT_ID" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{
    "oAuthApp": {
      "id": "'"$CLIENT_ID"'",
      "allowedDomains": ["https://YOUR-DOMAIN", "..."],
      "allowedRedirectDomains": ["https://YOUR-DOMAIN", "..."],
      "allowedRedirectUris": ["https://YOUR-DOMAIN/api/auth/callback", "..."],
      "redirectUrlWixPages": "https://YOUR-DOMAIN"
    },
    "mask": { "paths": ["allowedDomains","allowedRedirectDomains",
                        "allowedRedirectUris","redirectUrlWixPages"] }
  }'
```

The field mask is required — without it the PATCH returns 200 and silently
does nothing.

### Regional settings

The site is set to GBP and Europe/London, and the business name is
Willowbrook Animal Rescue. Two leftovers from the blank template you may want
to tidy in the dashboard:

- The **locale** still reads Greek (Cyprus). Harmless — prices, dates and the
  site language are all set explicitly in code — but you can correct it under
  **Settings** → **Business Info** → **Regional Settings**.
- The **site name** is still "Paw Haven", which is what the hosted checkout
  page puts in its browser-tab title. Rename the site in the dashboard to
  change it; it is separate from the business name.

### Photographs

Animals and products currently have no photographs — every image slot shows a
coloured placeholder block with the animal's name instead. **This is the one
thing worth doing before showing the site to the public.** As soon as you
upload a real photo to an animal's **Main image** or a product's image, the
placeholder disappears on its own. No code change, no republish.

> Why they are missing: the build tried to generate placeholder imagery through
> Wix's AI image service and was refused with a permissions error, most likely
> because the account has no AI credits or the feature is not enabled on this
> plan. Rather than ship broken images, every slot falls back to an on-brand
> coloured block. Real photographs are better than generated ones here anyway.

### Change page titles and descriptions for Google

Animal pages look after themselves: their title and description are built from
the animal's name, breed, age and short description, so editing the animal
updates them.

For every other page the title and description are set in the code, in that
page's `seo` block under `src/pages/`. A developer can change them in a minute.

This is not where Wix would normally put them, and the reason is worth
recording. Wix can inject these tags from **SEO & GEO** → **SEO Settings**, but
only once a Wix user has configured each page there — until then it injects
nothing at all, and every page ships with no title. Feeding defaults through
`@wix/seo`'s tag service was tried and does not help: it returns only what the
dashboard has resolved and ignores supplied fallbacks. So the tags are authored
in code, which means every page has a good title today.

If you later configure dashboard SEO for a page, ask a developer to remove that
page's `seo` prop at the same time, so its managed tags are not rendered
alongside the coded ones.

---

## For developers

### Local setup

Requires Node 20.11 or later.

```bash
npm install --ignore-scripts   # see note below
npx wix login                  # once per machine
npx wix env pull               # writes .env.local
npm run dev                    # http://localhost:4321
```

`--ignore-scripts` is deliberate. Astro pulls `sharp` as an optional transitive
dependency for local build-time image optimisation, which this site never uses
— all imagery is served as remote Wix Media URLs through plain `<img>`. Its
native build can fail and abort the whole install, so it is skipped up front. A
missing `sharp` is expected here and is not worth diagnosing.

### Environment variables

There are no hand-managed environment variables. `wix env pull` writes
`.env.local` with `WIX_CLIENT_ID`, `WIX_CLIENT_SECRET` and friends; the CLI owns
that file and it must never be committed or edited by hand (it is gitignored).

To add your own variable, declare it in the `env.schema` block of
`astro.config.mjs` and set it with `npx wix env set --key=NAME --value=...`.
Secrets must use `context: 'server', access: 'secret'` so they never reach the
browser bundle.

### Commands

| Command | Does |
|---|---|
| `npm run dev` | Local dev server with hot reload |
| `npm run build` | Production build |
| `npm run release` | Publishes to Wix hosting |
| `npx astro check` | Typechecks `.astro`, `.ts` and `.tsx` |

### Project structure

```
src/
  layouts/Layout.astro      Shell: head, skip link, header, footer, SEO slot
  components/
    Header/Footer.astro     Site chrome
    AnimalCard.astro        Animal card used on Home and Adopt
    AnimalFilters.astro     GET filter form for the Adopt page
    ProductCard.astro       Shop card
    Placeholder.astro       Themed block shown wherever a photo is missing
    StatusBadge.astro       Available / Pending / Adopted pill
    *.tsx                   React islands (see below)
  lib/
    site.ts                 Shelter name, address, hours, stats — edit here
    animals.ts              Animals CMS reads, filtering, sorting
    store.ts                Products, variants, categories, cart reads
    media.ts                Resolves wix:image:// URIs to real URLs
    format.ts               Age, fee, date, status and placeholder helpers
    sanitize.ts             Allow-list sanitiser for CMS rich text
    server/                 Server-only: validation, rate limiting, notify stub
  pages/
    index.astro             Home
    adopt/index.astro       Listing with filters
    adopt/[slug].astro      Animal detail
    apply/                  Application form and thank-you
    shop/                   Shop, product detail, order thank-you
    cart.astro              Basket
    about, contact, privacy, 404
    api/                    Server endpoints — the only writers
```

Data fetching lives in `src/lib`; components receive plain objects and never
call the SDK themselves.

### Architecture notes

**Authentication.** This is a Wix-managed Astro project, so authentication is
ambient. There is no `createClient`, no `OAuthStrategy` and no `clientId` in
app code — you import from `@wix/*` and call methods.

**Form submissions and why elevation is not used.** `AdoptionApplications`,
`Subscribers` and `Enquiries` are `read`/`update`/`remove: ADMIN` with
`insert: ANYONE`. Submissions are never publicly readable, and nobody can edit
or delete one; a visitor can only add.

The stricter design — admin-only in both directions, with the server route
elevating to write — was built first and does not work here. `auth.elevate()`
wraps a raw Wix module descriptor, but `@wix/data`'s `items.insert` is a plain
contextualised function, so elevation fails at runtime with
`context.initWixModules(...).apply is not a function`. The SDK's own type
documentation notes that elevation is not intended for Wix Headless. So the
collections use the permission model the platform actually supports.

Submissions still go through `src/pages/api/`, which validates every rule the
browser checks, rate limits, and discards honeypot submissions. Worth being
clear about the residual gap: because `insert` is open, a determined bot could
POST straight to Wix Data and bypass those checks. The protections make casual
abuse uneconomic; they are not a hard boundary.

**Duplicate subscribers** are prevented without reading the collection. Since
`read` is admin-only, the route cannot query for an existing address — a
visitor-scoped read returns zero rows either way. Instead each subscriber's
item `_id` is a SHA-256 hash of their email, so a second signup collides with
`WDE0074` and is reported as "already on the list". The hash means no address
is recoverable from an item id.

**The basket runs in the browser, not on the server.** `src/lib/cart-client.ts`
calls `currentCartV2` directly from the React islands. This is not a style
choice: the visitor's cart session lives in the browser's Wix context and is
not sent to the server as a cookie, so the same calls made from a server route
act on a fresh, empty cart every request — an item would appear to add and then
vanish on the next read. This was built as server routes first and failed
exactly that way. Verified: reusing one visitor token returns the same cart id
across calls, while server-side calls do not.

**Rate limiting is best-effort.** It is an in-process counter, so it resets on
a cold start and does not coordinate across instances. It stops one script
hammering one endpoint; it will not stop a distributed attacker. If real abuse
shows up, `src/lib/server/rateLimit.ts` is the seam to swap for a durable store.

**Email notifications are not wired up.** The skill exposes no automations or
triggered-email mechanism for a managed Astro project, so
`src/lib/server/notify.ts` logs what it would send and returns cleanly. Two
ways to finish it — a no-code Wix Automation, or a transactional email provider
behind a secret env var — are documented in that file.

**Progressive enhancement.** The Adopt filters are a plain GET form and work
with JavaScript disabled; they auto-submit when scripting is available. The
mobile nav stays open without JavaScript rather than becoming unreachable. The
application form, basket and contact form do need JavaScript, and each says so
in a `<noscript>` block with the shelter's phone number.

**The sitemap is served at `/sitemap-pages.xml`, not `/sitemap.xml`.** Wix
reserves the latter at the platform level and answers it with its own 404
before the request reaches Astro. `src/pages/sitemap-pages.xml.ts` generates
the real one from live data, so animals and products the shelter adds appear
without a republish; the thank-you pages, basket and 404 are excluded because
they are noindex. The site's robots.txt has been updated to point at it.

**Live queries, never pinned IDs.** Featured animals, shop categories, filter
options and the home-page product teaser all come from live queries. Content
added in the dashboard appears without a code change or a republish. A new CMS
*field* or collection does need code.

### CMS schema

`Animals` is public-read, admin-write. `AdoptionApplications`, `Subscribers`
and `Enquiries` are admin-only in both directions.

`Animals` fields: `name`, `slug`, `species`, `breed`, `age` (months), `sex`,
`size`, `mainImage`, `gallery`, `shortDescription`, `description` (rich text),
`goodWithKids`, `goodWithDogs`, `goodWithCats`, `houseTrained`, `neutered`,
`vaccinated`, `specialNeeds`, `adoptionFee`, `status`, `intakeDate`,
`featured`, `bondedWith` (reference to another animal).

### Accessibility

WCAG 2.1 AA is a build requirement, not a nice-to-have. Every
foreground/background pair in `src/styles/global.css` meets the contrast floor,
focus outlines are never removed, all form fields have real labels with errors
associated via `aria-describedby`, the application form moves focus to each new
step, and every image has alt text (decorative ones are `alt=""` with the
accessible name on the link instead).

If you change the palette, re-check contrast. The tokens carry their measured
ratios in comments.
