// Mirrors SiteGlobals / Pages from the Payload backend's generated
// payload-types.ts, narrowed to what the page consumes. Fetched with
// depth=1 so image/photo resolve to full Media.

export interface Media {
  url: string;
  alt: string;
  width: number;
  height: number;
}

export interface SiteGlobals {
  brand: { logo: Media; logoAlt: string; favicon: Media };
  nav: {
    items: {
      type: "link" | "cta";
      label: string;
      href: string;
      openInNewTab?: boolean | null;
    }[];
  };
  accessibility: {
    primaryNavLabel: string;
    heroOverviewLabel: string;
    programSummaryLabel: string;
    homeLinkSuffix: string;
    skipToContentLabel?: string | null;
    menuLabel?: string | null;
    languageSwitchAriaLabelTemplate?: string | null;
  };
  footer: {
    tagline: string;
    links: { label: string; href: string }[];
    note: string;
  };
}

type Highlight = { label: string };
type Pillar = { index: string; title: string; body: string };
type Step = { number: string; title: string; body: string };
type Item = {
  title: string;
  detail: string;
  tag: string;
  itemLabel: string;
  viewLabel: string;
  viewAriaLabel: string;
  href: string;
};

export type PageSection =
  | { blockType: "hero"; hero: {
      kicker: string;
      headline: string;
      subhead: string;
      image: Media;
      imageAlt: string;
      visualCaption: string;
      secondaryCtaLabel: string;
      primaryCtaHref: string;
      secondaryCtaHref: string;
    }; process: { steps: { label: string }[] } }
  | { blockType: "highlights"; highlights: { items: Highlight[] } }
  | { blockType: "content"; content: {
      headingTop: string;
      headingBottom: string;
      intro: string;
      pillars: Pillar[];
    } }
  | { blockType: "mediaFeature"; mediaFeature: {
      photo: Media;
      photoAlt: string;
      kicker: string;
      headingTop: string;
      headingBottom: string;
      steps: Step[];
      linkLabel: string;
      linkHref: string;
    } }
  | { blockType: "itemList"; itemList: {
      kicker: string;
      heading: string;
      intro: string;
      items: Item[];
      allLabel: string;
      allHref: string;
    } }
  | { blockType: "quote"; quote: { quote: string; attribution: string } }
  | { blockType: "callToAction"; callToAction: {
      kicker: string;
      headingTop: string;
      headingBottom: string;
      ctaLabel: string;
      href: string;
    } };

export type Page = {
  id: string | number;
  slug: string;
  title: string;
  banner: {
    backLabel: string;
    centerLabel: string;
    nextLabel: string;
    nextHref: string;
  };
  metadata: { titleTemplate: string };
  sections: PageSection[];
};

function requiredEnv(name: string): string {
  const value = (import.meta.env as Record<string, string | undefined>)[name] ?? process.env[name];
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) throw new Error(`Missing required environment variable: ${name}`);
  return trimmed;
}

function requiredOrigin(name: string): string {
  const value = requiredEnv(name);
  const url = new URL(value);
  if (url.pathname !== "/" || url.search || url.hash) {
    throw new Error(`${name} must be an origin without a path, query, or hash`);
  }
  return url.origin;
}

export const cmsOrigin = requiredOrigin("CMS_ORIGIN");
export const globalSlug = requiredEnv("SITE_GLOBAL_SLUG");
export const PAGE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function absolutizeSiteChromeUrls(page: SiteGlobals): SiteGlobals {
  // Payload returns media `url` as a path relative to its own origin.
  page.brand.logo.url = new URL(page.brand.logo.url, cmsOrigin).toString();
  page.brand.favicon.url = new URL(page.brand.favicon.url, cmsOrigin).toString();
  return page;
}

export async function getSiteGlobals(locale: string): Promise<SiteGlobals> {
  const res = await fetch(
    `${cmsOrigin}/api/globals/${globalSlug}?depth=1&locale=${locale}`,
  );

  if (!res.ok) {
    throw new Error(
      `Failed to fetch "${globalSlug}" (locale "${locale}") from Payload: ${res.status} ${res.statusText}`,
    );
  }

  return absolutizeSiteChromeUrls(await res.json());
}

function absolutizePageMediaUrls(page: Page): Page {
  for (const section of page.sections) {
    if (section.blockType === "hero") section.hero.image.url = new URL(section.hero.image.url, cmsOrigin).toString();
    if (section.blockType === "mediaFeature") section.mediaFeature.photo.url = new URL(section.mediaFeature.photo.url, cmsOrigin).toString();
  }
  return page;
}

const hasText = (value: unknown) => typeof value === "string" && value.trim().length > 0;
const hasMedia = (value: unknown): value is Media => {
  if (!value || typeof value !== "object") return false;
  const media = value as Partial<Media>;
  return hasText(media.url) && hasText(media.alt) && typeof media.width === "number" && typeof media.height === "number";
};
const hasNonEmpty = (value: unknown, item: (entry: unknown) => boolean) => Array.isArray(value) && value.length > 0 && value.every(item);

function isCompletePage(page: Page): boolean {
  if ((typeof page.id !== "string" && typeof page.id !== "number") || !hasText(page.slug) || !hasText(page.title)) return false;
  if (!page.banner || ![page.banner.backLabel, page.banner.centerLabel, page.banner.nextLabel, page.banner.nextHref].every(hasText)) return false;
  if (!page.metadata || page.metadata.titleTemplate !== "{title}") return false;
  const sections = page.sections;
  if (!Array.isArray(sections) || sections.length === 0) return false;
  return sections.every((section) => {
    if (section.blockType === "hero") {
      const hero = section.hero;
      const process = section.process?.steps;
      return Boolean(hero && [hero.kicker, hero.headline, hero.subhead, hero.imageAlt, hero.visualCaption, hero.secondaryCtaLabel, hero.primaryCtaHref, hero.secondaryCtaHref].every(hasText) && hasMedia(hero.image) && hasNonEmpty(process, (step) => Boolean(step && hasText((step as { label?: unknown }).label))));
    }
    if (section.blockType === "highlights") return hasNonEmpty(section.highlights?.items, (item) => Boolean(item && hasText((item as { label?: unknown }).label)));
    if (section.blockType === "content") return [section.content?.headingTop, section.content?.headingBottom, section.content?.intro].every(hasText) && hasNonEmpty(section.content?.pillars, (pillar) => Boolean(pillar && hasText((pillar as { index?: unknown; title?: unknown; body?: unknown }).index) && hasText((pillar as { title?: unknown }).title) && hasText((pillar as { body?: unknown }).body)));
    if (section.blockType === "mediaFeature") {
      const mediaFeature = section.mediaFeature;
      const steps = mediaFeature?.steps;
      const completeSteps = hasNonEmpty(steps, (step) => Boolean(step && hasText((step as { number?: unknown; title?: unknown; body?: unknown }).number) && hasText((step as { title?: unknown }).title) && hasText((step as { body?: unknown }).body)));
      return Boolean(mediaFeature && hasMedia(mediaFeature.photo) && [mediaFeature.photoAlt, mediaFeature.kicker, mediaFeature.headingTop, mediaFeature.headingBottom, mediaFeature.linkLabel, mediaFeature.linkHref].every(hasText) && completeSteps);
    }
    if (section.blockType === "itemList") {
      const itemList = section.itemList;
      const items = itemList?.items;
      const completeItems = hasNonEmpty(items, (item) => Boolean(item && ["title", "detail", "tag", "itemLabel", "viewLabel", "viewAriaLabel", "href"].every((key) => hasText((item as Record<string, unknown>)[key]))));
      return Boolean(itemList && [itemList.kicker, itemList.heading, itemList.intro, itemList.allLabel, itemList.allHref].every(hasText) && completeItems);
    }
    if (section.blockType === "quote") return Boolean(section.quote && hasText(section.quote.quote) && hasText(section.quote.attribution));
    if (section.blockType === "callToAction") return Boolean(section.callToAction && [section.callToAction.kicker, section.callToAction.headingTop, section.callToAction.headingBottom, section.callToAction.ctaLabel, section.callToAction.href].every(hasText));
    return false;
  });
}

function hasLocalizedPageData(page: Page): boolean {
  if (hasText(page.title) || [page.banner?.backLabel, page.banner?.centerLabel, page.banner?.nextLabel, page.metadata?.titleTemplate].some(hasText)) return true;
  return (page.sections ?? []).some((section) => {
    if (section.blockType === "hero") return [section.hero?.kicker, section.hero?.headline, section.hero?.subhead, section.hero?.imageAlt, section.hero?.visualCaption, section.hero?.secondaryCtaLabel, ...(section.process?.steps ?? []).map((step) => step.label)].some(hasText);
    if (section.blockType === "highlights") return (section.highlights?.items ?? []).some((item) => hasText(item.label));
    if (section.blockType === "content") return [section.content?.headingTop, section.content?.headingBottom, section.content?.intro, ...(section.content?.pillars ?? []).flatMap((pillar) => [pillar.title, pillar.body])].some(hasText);
    if (section.blockType === "mediaFeature") return [section.mediaFeature?.photoAlt, section.mediaFeature?.kicker, section.mediaFeature?.headingTop, section.mediaFeature?.headingBottom, section.mediaFeature?.linkLabel, ...(section.mediaFeature?.steps ?? []).flatMap((step) => [step.title, step.body])].some(hasText);
    if (section.blockType === "itemList") return [section.itemList?.kicker, section.itemList?.heading, section.itemList?.intro, section.itemList?.allLabel, ...(section.itemList?.items ?? []).flatMap((item) => [item.title, item.detail, item.tag, item.itemLabel, item.viewLabel, item.viewAriaLabel])].some(hasText);
    if (section.blockType === "quote") return [section.quote?.quote, section.quote?.attribution].some(hasText);
    return [section.callToAction?.kicker, section.callToAction?.headingTop, section.callToAction?.headingBottom, section.callToAction?.ctaLabel].some(hasText);
  });
}

async function fetchPages(locale: string, slug?: string): Promise<Page[]> {
  if (!PAGE_SLUG_PATTERN.test(locale)) return [];

  const params = new URLSearchParams({ depth: "1", locale, "fallback-locale": "none", limit: "1000" });
  if (slug) params.set("where[slug][equals]", slug);
  const res = await fetch(`${cmsOrigin}/api/pages?${params}`);
  if (!res.ok) throw new Error(`Failed to fetch Pages (locale "${locale}"): ${res.status} ${res.statusText}`);
  const data = await res.json() as { docs?: Page[] };
  const translatedPages = (data.docs ?? []).filter((page) => {
    if (!hasLocalizedPageData(page)) return false;
    if (!hasText(page.title)) throw new Error(`Published Page "${page.slug}" is missing its title for locale "${locale}".`);
    return true;
  });
  for (const page of translatedPages) {
    if (!isCompletePage(page)) {
      throw new Error(`Published Page "${page.slug}" is incomplete for locale "${locale}".`);
    }
  }
  return translatedPages.map(absolutizePageMediaUrls);
}

export async function getPages(locale: string): Promise<Page[]> {
  return fetchPages(locale);
}

export async function getPage(slug: string, locale: string): Promise<Page | null> {
  if (!PAGE_SLUG_PATTERN.test(locale) || !PAGE_SLUG_PATTERN.test(slug) || slug.length > 80) return null;
  return (await fetchPages(locale, slug))[0] ?? null;
}
