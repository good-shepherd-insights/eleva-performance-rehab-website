export function GET({ site }: { site: URL | undefined }) {
  if (!site) {
    throw new Error("Astro's configured site origin is missing; cannot generate robots.txt without it.");
  }
  const sitemapURL = new URL("sitemap-index.xml", site);
  const robots = `User-agent: *
Allow: /

Sitemap: ${sitemapURL}
`;

  return new Response(robots, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
