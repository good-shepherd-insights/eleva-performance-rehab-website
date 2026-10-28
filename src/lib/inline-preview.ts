import { ready, isLivePreviewEvent, mergeData } from "@payloadcms/live-preview";
import type { SiteGlobals, Page } from "./payload";

// Frontend half of the click-to-edit bridge (see the CMS repo's src/admin/InlinePreviewBridge.tsx
// for the admin-side half). Only ever runs when this page is embedded inside
// Payload's own Live Preview iframe/popup — a normal site visit never reaches
// this code path.
//
// Two independent things happen here, both driven by data attributes:
//  - `data-inline-edit="a.b.c"` elements: editable text, two-way. Typing
//    saves to Payload as a draft and mirrors into the admin sidebar form.
//  - `data-live-sync="a.b.c"` elements: read-only, one-way (admin -> page).
//    Used for the two image fields, which aren't click-to-edit here.

type JSONValue = unknown;

function getPath(obj: JSONValue, path: string): JSONValue {
  return path
    .split(".")
    .reduce<JSONValue>(
      (acc, key) =>
        acc && typeof acc === "object" ? (acc as Record<string, JSONValue>)[key] : undefined,
      obj,
    );
}

function setPath(obj: JSONValue, path: string[], value: JSONValue): void {
  const [key, ...rest] = path;
  const record = obj as Record<string, JSONValue>;
  if (rest.length === 0) {
    record[key] = value;
    return;
  }
  setPath(record[key], rest, value);
}

/** Builds a minimal partial-update payload by cloning the current top-level
 * group from tracked live data and mutating just the one leaf that changed —
 * required for array fields, since Payload replaces the whole array on
 * update rather than merging by index. */
function buildSavePayload(liveData: JSONValue, path: string, value: string) {
  const segments = path.split(".");
  const [topKey, ...rest] = segments;
  const clone = structuredClone(getPath(liveData, topKey));
  setPath({ [topKey]: clone }, [topKey, ...rest], value);
  return { [topKey]: clone };
}

interface InlinePreviewOptions {
  serverURL: string;
  initialData: SiteGlobals | Page;
  locale: string;
  globalSlug: string;
  collection?: "globals" | "pages";
  id?: string | number;
  initialGlobalData?: SiteGlobals;
}

export function initInlinePreview({ serverURL, initialData, locale, globalSlug, collection = "globals", id, initialGlobalData }: InlinePreviewOptions) {
  const embedded = window.parent !== window || Boolean(window.opener);
  if (!embedded) return;

  let resolvedServerURL = serverURL;
  try {
    if (document.referrer) resolvedServerURL = new URL(document.referrer).origin;
  } catch {
    resolvedServerURL = serverURL;
  }

  let liveData: SiteGlobals | Page = initialData;
  let globalData = initialGlobalData;
  let unsavedPagePreview = false;
  const saveTimers = new Map<string, number>();
  const isGlobalPath = (path: string) => /^(brand|accessibility)\./.test(path);
  // Sections belong to the page; everything else (brand, accessibility,
  // components) resolves against the site global's data.
  const globalFor = (path: string) => (isGlobalPath(path) || !path.startsWith("sections.") ? globalData ?? liveData : liveData);
  // Component-owned edit paths are authored as
  // components.N.component.M.<field> (N = curation row, M = section index in
  // the resolved document). The depth-resolved global data stores the
  // document's sections at components.N.component.sections.M, so the path is
  // rewritten to match the data for reads and saves.
  const unwrapComponentPath = (path: string) => path.replace(/^components\.(\d+)\.component\.(\d+)\./, "components.$1.component.sections.$2.");
  const getLiveValue = (path: string) => getPath(globalFor(path), unwrapComponentPath(path));

  const patchDOM = () => {
    document.querySelectorAll<HTMLElement>("[data-inline-edit]").forEach((el) => {
      if (el === document.activeElement) return;
      const path = el.dataset.inlineEdit!;
      const value = getLiveValue(path);
      if (typeof value === "string" && el.textContent !== value) el.textContent = value;
    });

    document.querySelectorAll<HTMLElement>("[data-live-sync-bg]").forEach((el) => {
      const value = getLiveValue(el.dataset.liveSyncBg!);
      // Payload returns media `url` relative to its own origin — must not
      // resolve against this page's origin (same bug class as the
      // server-side fetch in lib/payload.ts, here on the client instead).
      if (typeof value === "string") {
        el.style.backgroundImage = `url(${new URL(value, resolvedServerURL)})`;
      }
    });

    document.querySelectorAll<HTMLImageElement>("[data-live-sync-src]").forEach((el) => {
      const value = getLiveValue(el.dataset.liveSyncSrc!);
      if (typeof value === "string") {
        el.src = new URL(value, resolvedServerURL).toString();
      }
    });

    document.querySelectorAll<HTMLElement>("[data-live-sync-alt]").forEach((el) => {
      const value = getLiveValue(el.dataset.liveSyncAlt!);
      if (typeof value === "string") {
        if (el instanceof HTMLImageElement) el.alt = value;
        else el.setAttribute("aria-label", value);
      }
    });

    document.querySelectorAll<HTMLAnchorElement>("[data-live-sync-href]").forEach((el) => {
      const value = getLiveValue(el.dataset.liveSyncHref!);
      if (typeof value === "string") el.href = value;
    });
  };

  // @payloadcms/live-preview's subscribe()/handleMessage() share ONE
  // module-level cache (_payloadLivePreview.previousData) across every
  // subscribe() call on the page, and each subscribe() call resets it. Two
  // simultaneous subscriptions here (page + global) clobbered each other's
  // cache, so a page-edit broadcast could get merged against stale global
  // data with no `.id`, producing saves to `/api/pages/undefined` (500).
  // Fixed by driving the merge manually with the package's stateless pieces
  // (isLivePreviewEvent, mergeData) against our own two local caches
  // (liveData, globalData) instead of the package's shared one.
  const handleLivePreviewData = async (event: MessageEvent) => {
    if (!isLivePreviewEvent(event, resolvedServerURL)) return;
    const { collectionSlug, globalSlug: incomingGlobalSlug, data } = event.data as {
      collectionSlug?: string;
      globalSlug?: string;
      data?: unknown;
    };

    if (collection === "pages" && collectionSlug === "pages") {
      liveData = await mergeData({ serverURL: resolvedServerURL, collectionSlug, depth: 1, incomingData: data, initialData: liveData, locale });
      patchDOM();
    }

    if (globalData && incomingGlobalSlug === globalSlug) {
      globalData = await mergeData({ serverURL: resolvedServerURL, globalSlug: incomingGlobalSlug, depth: 1, incomingData: data, initialData: globalData, locale });
      patchDOM();
    }
  };

  window.addEventListener("message", handleLivePreviewData);

  const handlePayloadPreview = (event: MessageEvent<{ type?: string; collectionSlug?: string; data?: SiteGlobals | Page; globalSlug?: string }>) => {
    const parentWindow = window.parent !== window ? window.parent : window.opener;
    if (event.source !== parentWindow || event.data?.type !== "payload-live-preview" || !event.data.data) return;
    if (collection === "pages" && event.data.collectionSlug === "pages") {
      liveData = event.data.data;
      unsavedPagePreview = !("id" in event.data.data) || !event.data.data.id;
      patchDOM();
    }
    if (collection === "globals" && event.data.globalSlug === globalSlug) {
      liveData = event.data.data;
      patchDOM();
    }
  };
  window.addEventListener("message", handlePayloadPreview);

  const saveField = async (path: string, value: string) => {
    if (collection === "pages" && (unsavedPagePreview || !id)) return;
    const parentWindow = window.parent !== window ? window.parent : window.opener;
    // Sections of the page mirror into the admin sidebar form; global-owned
    // fields (brand, accessibility, components) don't.
    if (!isGlobalPath(path) && path.startsWith("sections.")) parentWindow?.postMessage({ type: "payload-inline-edit", path, value }, resolvedServerURL);

    // Components are curated on the site global, so component-owned paths
    // save to the global, not the page. Save payload paths must match the
    // CMS document shape (components.N.component.M.<field> →
    // components.N.component.sections.M.<field>).
    const savePath = unwrapComponentPath(path);
    const endpoint = savePath.startsWith("sections.")
      ? collection === "pages" && id
        ? `/api/pages/${id}`
        : `/api/globals/${globalSlug}`
      : `/api/globals/${globalSlug}`;
    const source = savePath.startsWith("sections.") && !isGlobalPath(savePath) ? liveData : globalData ?? liveData;
    const response = await fetch(
      `${resolvedServerURL}${endpoint}?draft=true&autosave=true&locale=${locale}`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildSavePayload(source, savePath, value)),
      },
    );

    const el = document.querySelector<HTMLElement>(`[data-inline-edit="${path}"]`);
    if (!response.ok) {
      if (el) el.dataset.inlineEditError = "true";
      console.error(`Inline edit save failed with ${response.status} for "${path}".`);
      return;
    }
    if (el) delete el.dataset.inlineEditError;
  };

  document.querySelectorAll<HTMLElement>("[data-inline-edit]").forEach((el) => {
    el.contentEditable = "true";
    el.spellcheck = true;
  });

  // Editable spans can sit inside <a> — without this, clicking to place a
  // cursor navigates away instead.
  document.addEventListener("click", (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-inline-edit]");
    if (target?.isContentEditable) event.preventDefault();
  });

  document.addEventListener("input", (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-inline-edit]");
    if (!target) return;
    const path = target.dataset.inlineEdit!;

    const existing = saveTimers.get(path);
    if (existing) window.clearTimeout(existing);

    const timer = window.setTimeout(() => {
      saveTimers.delete(path);
      void saveField(path, target.textContent ?? "");
    }, 500);
    saveTimers.set(path, timer);
  });

  ready({ serverURL: resolvedServerURL });

  return () => {
    window.removeEventListener("message", handleLivePreviewData);
    window.removeEventListener("message", handlePayloadPreview);
  };
}
