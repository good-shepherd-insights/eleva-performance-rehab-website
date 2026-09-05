# Project Context

## Company Policy

Read and follow [COMPANY_POLICY.md](COMPANY_POLICY.md) before using this
project context or making changes. Company policy is mandatory and violations
are blocking issues.

## Project

This is the production Astro frontend for a multilingual
site connected to a separate Payload CMS backend.

## Repository Scope

This repository contains the public website only.

The separate Payload CMS supplies:

1. Page content — the site shell (the configured site global,
   `SITE_GLOBAL_SLUG`: brand, accessibility labels, components) plus
   per-page sections (`pages` collection).
2. Media records and image metadata.
3. Localized shell labels.
4. Live preview data.
5. The favicon.

## Runtime Architecture

1. Astro renders the public website.
2. `astro.config.mjs` discovers the locale list and default locale from
   Payload's `/api/locales` at build time — never hand-maintained here,
   and no allow-list exists on this side.
3. `/` renders the homepage in the CMS-configured default locale.
   `/<locale>/` renders it in every other CMS-discovered locale.
4. Non-home pages (Payload `pages` collection, any other slug) render
   through `src/pages/[locale]/[slug].astro`. There is no top-level
   `src/pages/[slug].astro` — a non-home page currently has no unprefixed
   default-locale route, only `/<locale>/<slug>/` prefixed ones. This is an
   existing gap, not a documented design decision; do not assume it is
   intentional.
5. `src/components/PageView.astro` is the shared page assembly for every
   page (home and non-home alike), for both locales. It walks the page's
   `sections` array and renders each section as neutral semantic markup —
   the template ships no per-section presentational components; each project
   authors its own.
6. `src/lib/payload.ts` is the CMS boundary, with two distinct fetch shapes:
   `getSiteGlobals()` fetches the site shell from the configured site
   global
   (`SITE_GLOBAL_SLUG`); `getPage()` /
   `getPages()` fetch page content (the page's `sections` blocks) from the
   `pages` collection. Both normalize Payload's
   relative media URLs to absolute.
7. Page validation is structural only — `isCompletePage()` and
   `hasLocalizedPageData()` in `payload.ts`. Section rendering is data-driven
   (a `<section>`
   per block), not a
   per-blockType component switch.
8. `src/lib/inline-preview.ts` runs when the page is embedded inside Payload's
   Live Preview iframe or popup.
9. **Known gap, verified in source (`src/components/PageView.astro`):**
   `jsonLd={{}}` is hardcoded for every page, home included.
   `buildSiteGraph` (`src/lib/seo/schemaGraph.ts`) exists but is never
   called from any `.astro` file (grep-verified) — every rendered page
   currently ships an empty JSON-LD script tag.

## System Design

End-to-end data flow, one direction, no branch skipped:

1. **Locale discovery (build time).** `astro.config.mjs` calls Payload's
   `/api/locales` before Astro's own config is evaluated — this repo never
   hand-maintains a locale list. Feeds Astro's `i18n.locales` and the
   sitemap integration's `i18n` option.
2. **Request/build enters at a thin route file** — `src/pages/index.astro`
   (default-locale home, resolved from Astro's CMS-derived i18n state),
   `src/pages/[locale]/index.astro` (home, other
   locales), or `src/pages/[locale]/[slug].astro` (any other `pages`
   document, `getStaticPaths` enumerated via `getPages()`). Each does one
   thing: resolve which `Page` to fetch, fetch it via `getPage()`, hand it
   to `PageView.astro`. No page-assembly logic belongs in these files.
3. **`payload.ts` is the only place that talks to Payload.** Two shapes:
   `getSiteGlobals()` → `SiteGlobals` (site shell); `getPage()` /
   `getPages()` → `Page` (collection, per-page `sections` blocks). Both
   validate structurally (`isCompletePage`, `hasLocalizedPageData`) and
   absolutize Payload's relative media URLs generically at any depth.
4. **`PageView.astro` assembles the page**, for every slug and both
   locales: fetches `SiteGlobals` itself (brand/accessibility), and walks
   `page.sections` rendering one neutral `<section>` per block.
   Presentation per section type is authored by each project, not shipped.
5. **`InlinePreviewBootstrap.astro`** wires the rendered page to
   `src/lib/inline-preview.ts` when embedded in Payload's Live Preview
   iframe/popup. Editable/sync attributes are carried by the markup each
   project's own components render; the bridge resolves global paths
   (`brand.*`, `accessibility.*`) against the site global.
6. **`Layout.astro`** renders shared `<head>` concerns — metadata,
   favicon, locale alternates, and (intended, currently broken per the
   gap above) the JSON-LD graph from `src/lib/seo/`.
7. **`@astrojs/sitemap`** (astro.config.mjs) generates the sitemap from
   Astro's own route list at build time, independent of steps 3–6.

## Styles

1. `src/styles/global.css` ships only a base reset — no design system, no
   component classes, no palette. Each project authors its own presentation.

## Content Model

Content is split across two Payload sources, both mirrored by types in
`src/lib/payload.ts`. Components should render fields from this structured
data instead of embedding editable copy or media paths directly.

**Site global** (slug from `SITE_GLOBAL_SLUG`, mirrored as `SiteGlobals`) —
site shell, shared by every
page:

1. Brand logo, favicon, and alt text.
2. Accessibility shell labels.
3. `components` — an ordered curation list of `components` collection
   documents; each resolves to that document's `sections` blocks and
   renders globally on every page, in this order.

**`components` collection (`CuratedComponent`)** — reusable component
documents (unique slug + title), each holding a `sections` array of
tenant-defined blocks; fetched depth-resolved through the site global's
curation.

**`pages` collection (`Page`, one document per slug)** — per-page content,
as a `sections` array of tenant-defined blocks:

1. A metadata title template (per page).
2. `sections` — whatever block kinds the project registered.

The `SiteGlobals` type in `payload.ts` mirrors the CMS site global's shell
fields, and `PageSection` is a generic block (`blockType` + arbitrary
tenant-defined fields) — neither is the shape of a predefined section set.

## Live Preview

Inline preview uses these data attributes:

1. `data-inline-edit` marks editable text.
2. `data-live-sync-bg` marks background image URLs that sync from Payload.
3. `data-live-sync-src` marks image sources that sync from Payload.
4. `data-live-sync-alt` marks ARIA labels that sync from Payload.
5. `data-live-sync-href` marks link hrefs that sync from Payload.

Preserve these attributes when preserving the corresponding preview behavior.

## Development

Use the repo scripts and project guidance:

1. Install dependencies with `npm install`.
2. Run the frontend with `npm run dev`.
3. In Conductor-managed sessions, start the dev server with
   `astro dev --background`.
4. Verify with `npx astro check`.
5. Build with `npm run build`.

The frontend expects Payload at the configured `CMS_ORIGIN` and reads the
shared global through the configured `SITE_GLOBAL_SLUG`; both are required
environment variables with no fallback.

## Out Of Scope

1. This repository should not become the source of truth for editable content or
   uploaded media.
