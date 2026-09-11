// Escaping "<" prevents a "</script>" sequence inside any CMS-sourced string
// value from breaking out of the JSON-LD script tag. Deliberately NOT
// HTML-entity-encoding the JSON (no `&amp;`/`&quot;` etc.) — astro-seo-infra-
// readiness skill's known astro-seo-schema failure mode is exactly that:
// entity-escaped characters corrupting parsed JSON-LD string values.
export function serializeJsonLd(graph: unknown): string {
  return JSON.stringify(graph).replace(/</g, "\\u003c");
}
