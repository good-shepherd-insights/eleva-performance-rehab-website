import { cmsOrigin } from "./payload";

export interface LocaleEntry {
  code: string;
  label: string;
}

// Same source astro.config.mjs uses at build-config time to decide which
// routes exist; this is the runtime counterpart, fetched once per page
// render (this site builds statically, so "once per page build") to get
// each locale's native display name for the language switcher. Payload's
// own `config.localization.locales` is the source of truth, exposed by the
// CMS's `/api/locales` endpoint.
export async function getLocales(): Promise<LocaleEntry[]> {
  try {
    const res = await fetch(`${cmsOrigin}/api/locales`);
    if (!res.ok) {
      throw new Error(`Failed to fetch locales: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    const locales = Array.isArray(data?.locales) ? data.locales : null;
    if (!locales) {
      throw new Error("Unexpected /api/locales response shape");
    }
    return locales;
  } catch (error) {
    throw new Error(`Could not fetch locale labels from Payload: ${error instanceof Error ? error.message : String(error)}`);
  }
}