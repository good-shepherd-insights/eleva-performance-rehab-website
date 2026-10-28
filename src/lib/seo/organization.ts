import type { SiteGlobals } from "../payload";
import type { SchemaIds } from "./ids";

// Only fields the Payload site global actually supplies are emitted.
// No address, sameAs, or contact fields exist in the schema yet — see
// docs/seo-plumbing.md "Content/data gaps" for what a future CMS field
// would unlock here.
export function buildWebsiteSchema(
  page: SiteGlobals,
  ids: Pick<SchemaIds, "website" | "baseUrl">,
) {
  return {
    "@type": "WebSite",
    "@id": ids.website,
    name: page.brand.logoAlt,
    url: ids.baseUrl,
  };
}

export function buildOrganizationSchema(
  page: SiteGlobals,
  ids: Pick<SchemaIds, "organization" | "baseUrl">,
) {
  return {
    "@type": "Organization",
    "@id": ids.organization,
    name: page.brand.logoAlt,
    url: ids.baseUrl,
    ...(page.brand.logo
      ? {
          logo: {
            "@type": "ImageObject",
            url: page.brand.logo.url,
            width: page.brand.logo.width,
            height: page.brand.logo.height,
          },
        }
      : {}),
  };
}