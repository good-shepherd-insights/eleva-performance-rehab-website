# Astro Website Template

## Required Docs

- [COMPANY_POLICY.md](COMPANY_POLICY.md) - mandatory policy.
- [CONTEXT.md](CONTEXT.md) - repository context.
- [AGENTS.md](AGENTS.md) - agent and development instructions.
- [CLAUDE.md](CLAUDE.md) - Claude instruction entrypoint.
- [Astro documentation](https://docs.astro.build) - framework reference.

The production Astro frontend for a multilingual site, connected to a
separate Payload CMS backend. All runtime configuration comes from the
environment contract documented below.

## Repository scope

This repository contains the public website only. The Payload CMS is maintained
separately and supplies page content (site chrome plus per-page sections),
media, localized navigation, live preview data, and the favicon.

The site has localized homepage routes — `/` for the CMS-configured default
locale and `/<locale>/` for every other CMS-discovered locale.

Additional CMS-authored pages (`pages` collection, any slug other than
`home`) render through `src/pages/[locale]/[slug].astro`. **Known gap:**
there is no top-level `src/pages/[slug].astro`, so a non-home page currently
resolves only at `/<locale>/<slug>/` prefixed routes — there is no equivalent
unprefixed default-locale route. Do not silently "fix" this as a side effect
of an unrelated change; it needs its own scoped ticket.

## Architecture

`src/components/PageView.astro` is the shared page assembly used for every
page — home and every other CMS-authored page — for both locales. It walks
a page's `sections` array and dispatches each block by `blockType`.
`src/components/PageView.astro` and `src/pages/[locale]/[slug].astro`
are thin entrypoints that fetch one `Page` via `getPage()`/`getPages()` and
hand it to `PageView.astro`; keep them thin, don't grow page-assembly logic
back into them.

`src/lib/payload.ts` is the CMS boundary and has two fetch shapes, not one:
`getSiteGlobals()` fetches only site chrome (`brand`, `nav`, `accessibility`,
`footer`) from the configured site global (`SITE_GLOBAL_SLUG`);
`getPage()`/`getPages()` fetch page
content (hero, highlights, content, and every other section) from the `pages`
collection. Every `Page` blockType is checked in exactly one place —
`isCompletePage()` and `hasLocalizedPageData()` in `payload.ts`, one branch
per blockType — plus one render case in `PageView.astro`. Extend those three
switches for a new section type; do not add a second, parallel
validation/fetch/render path for it.

`src/styles/global.css` is the frontend design-system source of truth for
layout, typography, color tokens, responsive behavior, and interaction
states. `src/lib/seo/` builds a JSON-LD graph (`buildSiteGraph`,
`schemaGraph.ts`) meant to render in `src/layouts/Layout.astro` — see
[`docs/seo-plumbing.md`](docs/seo-plumbing.md) for the field map. **Known
gap, verified in source:** `PageView.astro` currently hardcodes
`jsonLd={{}}` for every page (home included) and never calls
`buildSiteGraph`; every rendered page ships an empty JSON-LD script tag
right now. Not fixed here — flagged so it isn't mistaken for "already
wired up," and so a fix doesn't get bundled into an unrelated ticket.

Content belongs in Payload. Components should render CMS data and should not
reintroduce page copy, navigation labels, media URLs, or branding as scattered
hardcoded values. Navigation is repeatable CMS data with `link` and `cta`
variants; CTA styling is selected from the item type.

## Local development

```sh
npm install
npm run dev
```

## Environment variables

| Variable | Purpose |
| --- | --- |
| `CMS_ORIGIN` | Public origin of the companion CMS |
| `SITE_ORIGIN` | Public origin of this website |
| `SITE_GLOBAL_SLUG` | Identifier of the CMS shared site global |

The CMS owns locale configuration. The website discovers locales and the
default locale from the CMS endpoint at build time; it does not configure a
second locale list.

## Verification

```sh
npx astro check
npm run build
```

The build must complete for the default-locale homepage and every
CMS-discovered locale route. Changes affecting CMS-backed fields should also
be verified against each configured locale's API responses.

## Contributor guardrails

- Preserve the shared component architecture and existing semantic class names.
- Extend semantic design tokens before adding one-off colors or spacing rules.
- Treat Payload as the source of truth for editable content and media.
- Do not commit `.env` files, local databases, uploaded media, dependencies, or
  generated build output.
- Make focused changes, preserve unrelated work, and run verification before
  opening a pull request.
- Scope changes to the ticket that authorized them. Do not use one ticket to
  redesign routing, add a parallel validation/fetch/SEO-graph mechanism next
  to an existing one, or build a bespoke page-view component where the
  generic `PageView.astro` + `pages` collection pattern already covers it.
  A PR built against an outdated architecture (e.g. predating the `pages`
  collection migration) must be re-scoped against current `main`/`staging`
  before merge, not merged as-is and reconciled later.
