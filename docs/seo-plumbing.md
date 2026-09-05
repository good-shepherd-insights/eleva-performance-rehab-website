# SEO Plumbing — CMS Field Map

Purpose: for a CMS editor or future developer, trace every piece of
rendered SEO output back to exactly which Payload field produces it (or
which frontend-owned config value produces it, if not CMS content). No
orphaned frontend fields without a CMS source, no CMS fields nothing reads.

## Metadata (astro-seo `<SEO>` component, src/layouts/Layout.astro)

| Output | Source | Owner |
|---|---|---|
| `<title>` | `metadata.titleTemplate` with `{title}` replaced by `page.title` | Payload: Page.metadata.titleTemplate, Page.title |
| meta description / og:description / twitter:description | `hero.subhead` | Payload: Page (first hero section).hero.subhead |
| canonical / og:url | computed from `astro.config.mjs`'s `site` + current route path | Frontend (routing, not content) |
| hreflang alternates (x-default + one per locale) | `astro:i18n`'s `getAbsoluteLocaleUrlList()`/`toCodes()`, reading `i18n` from `astro:config/client` — no locale ever hardcoded here, see "Locale discovery" below for where that config value actually comes from | Frontend (routing, not content) |
| og:title / twitter:title | same as `<title>` | Payload (see title row) |
| og:image / twitter:image | `hero.image.url` (absolutized against `CMS_ORIGIN`) | Payload: Page (first hero section).hero.image |
| og:image:alt / twitter:imageAlt | `hero.imageAlt` | Payload: Page (first hero section).hero.imageAlt |
| favicon | `brand.favicon.url` | Payload: SiteGlobals.brand.favicon |
| robots meta | always `index, follow` (astro-seo default; no noindex/nofollow set anywhere) | Frontend (policy, not content) |

## JSON-LD graph (src/lib/seo/*.ts, rendered in Layout.astro)

| Node | Field | Source | Owner |
|---|---|---|---|
| WebSite | name | `brand.logoAlt` | Payload: SiteGlobals.brand.logoAlt |
| WebSite | description | `hero.subhead` | Payload: Page (first hero section).hero.subhead |
| WebSite | url | site origin | Frontend |
| Organization | name | `brand.logoAlt` | Payload: SiteGlobals.brand.logoAlt |
| Organization | description | `footer.tagline` | Payload: SiteGlobals.footer.tagline |
| Organization | logo | `brand.logo.url` + width/height | Payload: SiteGlobals.brand.logo |
| WebPage | name | page title (see metadata table) | Payload (see title row) |
| WebPage | description | `hero.subhead` | Payload: Page (first hero section).hero.subhead |
| WebPage | url / inLanguage | computed | Frontend (routing) |

No BreadcrumbList — this site has one route per locale (the home page
itself), and the skill explicitly exempts the home page from needing one.

## Sitemap / robots

| Output | Source |
|---|---|
| `sitemap-index.xml` / `sitemap-0.xml` | generated entirely by the `@astrojs/sitemap` integration from the actual build output + `astro.config.mjs`'s `i18n.locales` — no manually maintained route list |
| `robots.txt` | hand-written (`src/pages/robots.txt.ts`), Sitemap: line derived from `site` (Astro build config), not a separately hardcoded domain string |

## Locale discovery — how the site knows which languages exist

Payload is the only source of truth for the locale list; nothing below is a
manually maintained array.

1. **`GET /api/locales`** — a small custom Payload endpoint
   (cms-template's `src/payload.config.ts`, root-level
   `endpoints`) that returns `{ locales, defaultLocale }` from
   `config.localization` straight from server memory. No database query —
   this is Payload's own extensibility model (a real endpoint reading
   `req.payload.config`), not a side effect inferred from document content.
2. **`astro.config.mjs`** fetches that endpoint at build time (top-level
   `await`, which Astro's config loader supports) and feeds the resulting
   code list into both `i18n.locales` and `@astrojs/sitemap`'s `i18n.locales`
   map — one fetch, two consumers. A missing or misconfigured CMS breaks the
   build loudly (missing `CMS_ORIGIN`, non-200 response, empty locale list,
   or invalid default locale all throw); there is no fallback locale list.
3. **`src/pages/[locale]/index.astro`** — a dynamic route whose
   `getStaticPaths()` reads that same resolved `i18n.locales` (via
   `astro:config/client`) and generates one real page per non-default
   locale. The default locale still lives at the static `src/pages/
   index.astro` — `prefixDefaultLocale:false` means `/` is unprefixed, which
   a generic `[locale]`-prefixed route can't produce, so that one file is an
   intentional, permanent exception, not leftover hardcoding.
4. **`src/components/Nav.astro`'s language switcher** — `otherLocales` is
   computed once in `PageView.astro` (`getLocales()` in
   `src/lib/locales.ts`, same `/api/locales` endpoint) and passed down as a
   prop; Nav renders one link per entry via `.map()`, hrefs via
   `getRelativeLocaleUrl`. No per-locale branching anywhere in either
   file — adding a locale in Payload adds a switcher link automatically.

### Nav's three CMS-sourced UI strings

`accessibility.skipToContentLabel`, `accessibility.menuLabel`, and
`accessibility.languageSwitchAriaLabelTemplate` (this last one contains a
literal `{language}` placeholder, replaced with the target locale's own
`label` from `/api/locales`) are real `localized: true` Payload fields on
the site global — not frontend ternaries. `Nav.astro`/`PageView.astro` read
them with a single non-branching `?? "default text"` fallback for the
(optional) label fields only;
every real API response already has a value, translated or Payload's own
automatic default-locale fallback (`localization.fallback: true`, Payload's
own default) for locales not yet translated.

## Content/data gaps — fields that don't exist in Payload yet

These are NOT bugs in the frontend pipe. The frontend is ready to render
them the moment the field exists; until then they're correctly omitted
(the JSON-LD graph builder strips undefined/empty fields rather than
fabricating placeholder values, per the skill: "do not fabricate
content-specific facts in code").

- **Dedicated social-share image.** Currently `hero.image` is reused for
  og:image/twitter:image. A `metadata.socialImage` field on the Payload
  site global (same `Media` upload shape as `hero.image`) would let
  an editor pick a purpose-built share image without changing the hero
  photo. Wiring change needed if added: swap `page.hero.image.url` /
  `page.hero.imageAlt` for `page.metadata.socialImage.url` /
  `page.metadata.socialImage.alt` in `src/components/PageView.astro`
  (falls back to `hero.image` if the new field is empty).
- **Organization address / contact / social profiles (`sameAs`).** No
  fields exist in the site global for a mailing address, phone, email, or
  social media profile URLs. Adding an `organization` group (address
  sub-fields, `email`, `telephone`, a repeatable `socialLinks` array of
  URLs) would let `src/lib/seo/organization.ts`'s
  `buildOrganizationSchema` emit `address`, `email`, `telephone`, and
  `sameAs` — all currently correctly absent, not fabricated.

## Explicitly out of scope for this pass

The former silent fallback to a hardcoded content snapshot was already
removed: the build now fails loudly when the CMS is unreachable or returns
invalid data (see "Locale discovery" above).

## Verifying this map stays accurate

The template ships no tenant acceptance scripts or SEO tests. Verify the
metadata map by building the site (`CMS_ORIGIN=<your CMS URL> npm run build`)
and inspecting the rendered `dist/**/*.html` output.
