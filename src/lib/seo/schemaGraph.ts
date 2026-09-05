import type { SiteGlobals } from "../payload";
import { buildSchemaIds } from "./ids";
import { buildGraph } from "./graph";
import { buildOrganizationSchema, buildWebsiteSchema } from "./organization";
import { buildWebPageSchema } from "./webpage";

// The home page is the site's only route per locale, so no BreadcrumbList —
// astro-seo-infra-readiness skill: "the home page does not need a breadcrumb."
export function buildSiteGraph({
  page,
  canonical,
  baseUrl,
  title,
  description,
  locale,
}: {
  page: SiteGlobals;
  canonical: string;
  baseUrl: string;
  title: string;
  description: string;
  locale: string;
}) {
  const ids = buildSchemaIds(canonical, baseUrl);

  return buildGraph([
    buildWebsiteSchema(page, ids),
    buildOrganizationSchema(page, ids),
    buildWebPageSchema({ ids, name: title, description, inLanguage: locale }),
  ]);
}
