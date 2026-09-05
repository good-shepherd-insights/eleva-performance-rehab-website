// Stable @id values so JSON-LD nodes reference each other instead of
// duplicating data (see astro-seo-infra-readiness skill, "JSON-LD Relationships").
export interface SchemaIds {
  baseUrl: string;
  canonical: string;
  website: string;
  organization: string;
  webPage: string;
}

export function buildSchemaIds(canonical: string, baseUrl: string): SchemaIds {
  return {
    baseUrl,
    canonical,
    website: `${baseUrl}#website`,
    organization: `${baseUrl}#organization`,
    webPage: `${canonical}#webpage`,
  };
}
