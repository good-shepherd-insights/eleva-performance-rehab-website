import type { SchemaIds } from "./ids";

export function buildWebPageSchema({
  ids,
  name,
  description,
  inLanguage,
}: {
  ids: Pick<SchemaIds, "webPage" | "canonical" | "website">;
  name: string;
  description: string;
  inLanguage: string;
}) {
  return {
    "@type": "WebPage",
    "@id": ids.webPage,
    name,
    description,
    url: ids.canonical,
    inLanguage,
    isPartOf: { "@id": ids.website },
  };
}
