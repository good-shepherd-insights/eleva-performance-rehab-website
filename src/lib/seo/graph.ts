import type { Graph } from "schema-dts";

// Removes undefined/null/empty-string leaves so optional CMS-sourced fields
// that are absent (see astro-seo-infra-readiness skill: "do not fabricate
// content-specific facts in code") don't show up as empty JSON-LD properties.
function pruneEmpty<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .map((item) => pruneEmpty(item))
      .filter((item) => item !== undefined) as unknown as T;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([key, val]) => [key, pruneEmpty(val)] as const)
      .filter(([, val]) => val !== undefined && val !== null && val !== "");
    return Object.fromEntries(entries) as T;
  }
  return value;
}

export function buildGraph(
  nodes: Array<Record<string, unknown> | undefined>,
): Graph {
  return {
    "@context": "https://schema.org",
    "@graph": nodes
      .filter((node): node is Record<string, unknown> => Boolean(node))
      .map((node) => pruneEmpty(node)),
  } as unknown as Graph;
}
