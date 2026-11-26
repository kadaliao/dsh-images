/**
 * The recipe library: the recipes the plugin ships with, the user's own, and
 * every community source the user follows, behind one list. A recipe is named
 * by a ref, `<source>:<id>` (`builtin:desk-figurine`, `mine:r-ab12`,
 * `community:…`); `image:<gallery id>` stands for a picture's own recipe.
 *
 * Community sources are JSON indexes on the web, fetched when first needed and
 * then weekly, kept under the cache directory. Their covers are fetched once on
 * first view and served from the cache. What a source holds is data written by
 * strangers: it is checked like any recipe and never run.
 *
 * @module @kadaliao/dsh-images/lib/library
 */

import { createHash } from 'node:crypto';
import { closeSync, copyFileSync, mkdirSync, openSync, readFileSync, readSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { normalizeRecipe, recipeFromImage, slugify } from './recipes.mjs';

/** The community index, and the mirror tried when GitHub cannot be reached. */
export const COMMUNITY_REPO = 'kadaliao/dsh-images-recipes';
export const COMMUNITY_URL = `https://raw.githubusercontent.com/${COMMUNITY_REPO}/main/index.json`;
export const COMMUNITY_MIRROR = `https://cdn.jsdelivr.net/gh/${COMMUNITY_REPO}@main/index.json`;

/** A source is fetched again after a week. */
const STALE_MS = 7 * 24 * 3_600_000;
/** A failed fetch is not retried on its own for an hour. */
const RETRY_MS = 3_600_000;
const MAX_INDEX_BYTES = 5 * 1024 * 1024;
const MAX_COVER_BYTES = 4 * 1024 * 1024;
const MAX_RECIPES = 3000;
const COVER_TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };

/** The first `n` bytes of a file (fewer when it is shorter). */
export function readHead(file, n) {
  const fd = openSync(file, 'r');
  try {
    const buf = Buffer.alloc(n);
    return buf.subarray(0, readSync(fd, buf, 0, n, 0));
  } finally {
    closeSync(fd);
  }
}

/** The image type a file's first bytes announce, or null. */
export function sniffImage(bytes) {
  const b = bytes;
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif';
  return null;
}

/** The key a source URL is filed under: `community` for the default one. */
export function sourceKey(url) {
  return url === COMMUNITY_URL ? 'community' : `s${createHash('sha1').update(url).digest('hex').slice(0, 8)}`;
}

/** Split a ref into its source and id. */
export function parseRef(ref) {
  const m = /^([a-z][a-z0-9]{0,15}):([A-Za-z0-9-]{1,60})$/.exec(String(ref ?? '').trim());
  return m ? { source: m[1], id: m[2] } : null;
}

const readJson = (file) => {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return undefined;
  }
};
const writeJson = (file, value) => {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(value, null, 2), 'utf8');
};
const exists = (file) => {
  try {
    return statSync(file).size > 0;
  } catch {
    return false;
  }
};

/** Bytes of a URL, refusing anything over `max`. */
async function fetchBytes(fetchImpl, url, max, timeoutMs) {
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs), headers: { accept: '*/*' } });
  if (!res.ok) throw new Error(`${res.status}`);
  const declared = Number(res.headers?.get?.('content-length'));
  if (Number.isFinite(declared) && declared > max) throw new Error('too large');
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length > max) throw new Error('too large');
  return bytes;
}

/**
 * The library under `dir` (the plugin's cache directory).
 * @param {object} options
 * @param {string} options.dir - where the user's recipes and the source caches live.
 * @param {string} options.builtinDir - the shipped `recipes/` folder: `builtin.json` and `covers/`.
 * @param {{get(id: string): object|undefined}} [options.store] - the gallery, for `image:` refs.
 * @param {typeof fetch} [options.fetch]
 * @param {() => number} [options.now]
 */
export function createLibrary({ dir, builtinDir, store, fetch: fetchImpl = (...a) => globalThis.fetch(...a), now = () => Date.now() }) {
  const root = join(dir, 'recipes');
  const mineFile = join(root, 'mine.json');
  const sourcesFile = join(root, 'sources.json');
  const coversDir = join(root, 'covers');
  const cacheDir = join(root, 'cache');

  // --- built-in --------------------------------------------------------------------
  let builtin = null;
  function builtins() {
    if (builtin !== null) return builtin;
    const raw = readJson(join(builtinDir, 'builtin.json'));
    const out = [];
    for (const r of Array.isArray(raw?.recipes) ? raw.recipes : []) {
      try {
        const recipe = normalizeRecipe(r);
        if (recipe.id === '' || out.some((o) => o.id === recipe.id)) continue;
        out.push(recipe);
      } catch {
        // A broken entry is left out.
      }
    }
    builtin = out;
    return builtin;
  }

  // --- the user's own ----------------------------------------------------------------
  let mine = null;
  let mineMtime = -1;
  function mineList() {
    let m = -1;
    try {
      m = statSync(mineFile).mtimeMs;
    } catch {
      m = -1;
    }
    if (mine !== null && m === mineMtime) return mine;
    mineMtime = m;
    const raw = readJson(mineFile);
    mine = [];
    for (const r of Array.isArray(raw?.recipes) ? raw.recipes : []) {
      try {
        const recipe = normalizeRecipe(r);
        if (recipe.id !== '') mine.push({ ...recipe, ...(typeof r.coverFile === 'string' ? { coverFile: r.coverFile } : {}) });
      } catch {
        // Skipped.
      }
    }
    return mine;
  }
  function saveMineList(list) {
    writeJson(mineFile, { format: 1, recipes: list });
    mine = list;
    try {
      mineMtime = statSync(mineFile).mtimeMs;
    } catch {
      mineMtime = -1;
    }
  }
  function uniqueId(base) {
    const taken = new Set(mineList().map((r) => r.id));
    const stem = (slugify(base) || `r-${now().toString(36)}`).slice(0, 40);
    if (!taken.has(stem)) return stem;
    for (let i = 2; ; i += 1) if (!taken.has(`${stem}-${i}`)) return `${stem}-${i}`;
  }

  // --- community sources -----------------------------------------------------------
  function sourceUrls() {
    const raw = readJson(sourcesFile);
    if (!Array.isArray(raw?.urls)) return [COMMUNITY_URL];
    return raw.urls.filter((u) => typeof u === 'string' && /^https:\/\//i.test(u));
  }
  const cacheFile = (key) => join(cacheDir, `${key}.json`);
  const states = new Map();
  const inflight = new Map();

  function cached(key) {
    const hit = states.get(key);
    if (hit) return hit;
    const raw = readJson(cacheFile(key));
    const state = raw && typeof raw === 'object' ? raw : { fetchedAt: 0 };
    states.set(key, state);
    return state;
  }

  /** The recipes one index holds, checked; covers resolved against where it was served from. */
  function readIndex(json, servedFrom) {
    if (!json || typeof json !== 'object' || !Array.isArray(json.recipes)) throw new Error('not a recipe index');
    if (json.format !== undefined && json.format !== 1) throw new Error('a newer index format; update Images');
    const recipes = [];
    for (const r of json.recipes.slice(0, MAX_RECIPES)) {
      try {
        const recipe = normalizeRecipe(r);
        if (recipe.id === '' || recipes.some((o) => o.id === recipe.id)) continue;
        if (recipe.cover && !/^https:\/\//i.test(recipe.cover)) recipe.cover = new URL(recipe.cover, servedFrom).href;
        recipes.push(recipe);
      } catch {
        // A broken entry is left out.
      }
    }
    const title = json.title && typeof json.title === 'object' ? { zh: String(json.title.zh ?? json.title.en ?? ''), en: String(json.title.en ?? json.title.zh ?? '') } : undefined;
    const repo = typeof json.repo === 'string' && /^[\w.-]+\/[\w.-]+$/.test(json.repo) ? json.repo : undefined;
    return { recipes, ...(title ? { title } : {}), ...(repo ? { repo } : {}) };
  }

  async function fetchSource(url) {
    const key = sourceKey(url);
    if (inflight.has(key)) return inflight.get(key);
    const job = (async () => {
      const tries = url === COMMUNITY_URL ? [COMMUNITY_URL, COMMUNITY_MIRROR] : [url];
      let lastError = '';
      for (const at of tries) {
        try {
          const bytes = await fetchBytes(fetchImpl, at, MAX_INDEX_BYTES, 20_000);
          const index = readIndex(JSON.parse(Buffer.from(bytes).toString('utf8')), at);
          const state = { url, servedFrom: at, fetchedAt: now(), ...index };
          states.set(key, state);
          try {
            writeJson(cacheFile(key), state);
          } catch {
            // Kept in memory for this process.
          }
          return state;
        } catch (error) {
          lastError = error?.message ?? String(error);
        }
      }
      const prev = cached(key);
      const state = { ...prev, url, error: lastError || 'unreachable', failedAt: now() };
      states.set(key, state);
      return state;
    })().finally(() => inflight.delete(key));
    inflight.set(key, job);
    return job;
  }

  /** Fetch what is stale: waits up to `waitMs` for sources never fetched, refreshes the rest behind. */
  async function ensure(waitMs = 4000, force = false) {
    const jobs = [];
    for (const url of sourceUrls()) {
      const state = cached(sourceKey(url));
      const due = force || !state.fetchedAt || now() - state.fetchedAt > STALE_MS;
      const resting = !force && state.failedAt && now() - state.failedAt < RETRY_MS;
      if (!due || resting) continue;
      const job = fetchSource(url);
      if (force || !state.fetchedAt) jobs.push(job);
    }
    if (jobs.length === 0) return;
    await Promise.race([Promise.allSettled(jobs), new Promise((resolve) => setTimeout(resolve, waitMs))]);
  }

  // --- the joined list -------------------------------------------------------------
  function sources() {
    const out = [
      { key: 'builtin', kind: 'builtin', count: builtins().length },
      { key: 'mine', kind: 'mine', count: mineList().length },
    ];
    for (const url of sourceUrls()) {
      const key = sourceKey(url);
      const s = cached(key);
      out.push({
        key,
        kind: 'remote',
        url,
        default: url === COMMUNITY_URL,
        count: Array.isArray(s.recipes) ? s.recipes.length : 0,
        fetchedAt: s.fetchedAt || 0,
        ...(s.title ? { title: s.title } : {}),
        ...(s.repo ? { repo: s.repo } : url === COMMUNITY_URL ? { repo: COMMUNITY_REPO } : {}),
        ...(s.error ? { error: s.error } : {}),
      });
    }
    return out;
  }

  function all() {
    const out = [];
    for (const r of builtins()) out.push({ ...r, origin: 'builtin', ref: `builtin:${r.id}` });
    for (const r of mineList()) out.push({ ...r, origin: 'mine', ref: `mine:${r.id}` });
    for (const url of sourceUrls()) {
      const key = sourceKey(url);
      const s = cached(key);
      for (const r of Array.isArray(s.recipes) ? s.recipes : []) out.push({ ...r, origin: key, ref: `${key}:${r.id}`, ...(s.repo ? { repo: s.repo } : {}) });
    }
    return out;
  }

  function get(ref) {
    const parsed = parseRef(ref);
    if (parsed === null) return undefined;
    if (parsed.source === 'image') {
      const item = store?.get?.(parsed.id);
      return item ? { ...recipeFromImage(item), origin: 'image', ref: `image:${item.id}`, image: item.id } : undefined;
    }
    return all().find((r) => r.ref === `${parsed.source}:${parsed.id}`);
  }

  /**
   * Keep a recipe as the user's own. `cover` copies a picture in as its cover.
   * @param {object} raw
   * @param {{cover?: {file: string, mediaType: string}}} [options]
   */
  function saveMine(raw, options = {}) {
    const recipe = normalizeRecipe(raw);
    const id = uniqueId(recipe.id || recipe.title.en || recipe.title.zh);
    const stored = { ...recipe, id, createdAt: now(), updatedAt: now() };
    delete stored.stats;
    delete stored.issue;
    if (options.cover) {
      const ext = COVER_TYPES[options.cover.mediaType] ?? 'png';
      const file = join(coversDir, `${id}.${ext}`);
      mkdirSync(coversDir, { recursive: true });
      copyFileSync(options.cover.file, file);
      stored.coverFile = file;
      delete stored.cover;
    }
    saveMineList([...mineList(), stored]);
    return { ...stored, origin: 'mine', ref: `mine:${id}` };
  }

  /** Change one of the user's recipes; returns it, or undefined for an unknown id. */
  function updateMine(id, patch) {
    const list = mineList();
    const at = list.findIndex((r) => r.id === id);
    if (at < 0) return undefined;
    const prev = list[at];
    const next = normalizeRecipe({ ...prev, ...patch, id });
    const stored = { ...next, id, createdAt: prev.createdAt, updatedAt: now(), ...(prev.coverFile ? { coverFile: prev.coverFile } : {}) };
    saveMineList(list.map((r, i) => (i === at ? stored : r)));
    return { ...stored, origin: 'mine', ref: `mine:${id}` };
  }

  /** Give one of the user's recipes a cover it lacks, from a picture made with it. */
  function coverMineIfBare(id, cover) {
    const list = mineList();
    const at = list.findIndex((r) => r.id === id);
    if (at < 0 || list[at].coverFile || list[at].cover) return false;
    const ext = COVER_TYPES[cover.mediaType] ?? 'png';
    const file = join(coversDir, `${id}.${ext}`);
    try {
      mkdirSync(coversDir, { recursive: true });
      copyFileSync(cover.file, file);
    } catch {
      return false;
    }
    saveMineList(list.map((r, i) => (i === at ? { ...r, coverFile: file } : r)));
    return true;
  }

  function removeMine(id) {
    const list = mineList();
    const hit = list.find((r) => r.id === id);
    if (!hit) return false;
    if (hit.coverFile) rmSync(hit.coverFile, { force: true });
    saveMineList(list.filter((r) => r.id !== id));
    return true;
  }

  function setSources(urls) {
    const clean = [...new Set((Array.isArray(urls) ? urls : []).map((u) => String(u ?? '').trim()).filter((u) => /^https:\/\//i.test(u)))].slice(0, 20);
    writeJson(sourcesFile, { urls: clean });
    return sources();
  }

  const coverStem = (recipe) => join(cacheDir, `${recipe.origin}-covers`, `${recipe.id}-${createHash('sha1').update(recipe.cover).digest('hex').slice(0, 8)}`);

  /**
   * Where a recipe's cover is on disk now, or null: a community cover counts
   * once it has been downloaded. Nothing is fetched.
   */
  function coverFileOf(recipe) {
    if (!recipe) return null;
    if (recipe.origin === 'image') {
      const item = store?.get?.(recipe.image);
      return item?.file && exists(item.file) ? item.file : null;
    }
    if (recipe.origin === 'builtin') {
      const file = join(builtinDir, recipe.cover && !/^https:/i.test(recipe.cover) ? recipe.cover : join('covers', `${recipe.id}.webp`));
      return file.startsWith(builtinDir) && exists(file) ? file : null;
    }
    if (recipe.origin === 'mine' && recipe.coverFile) return exists(recipe.coverFile) ? recipe.coverFile : null;
    if (!recipe.cover || !/^https:\/\//i.test(recipe.cover)) return null;
    const stem = coverStem(recipe);
    for (const ext of Object.values(COVER_TYPES)) if (exists(`${stem}.${ext}`)) return `${stem}.${ext}`;
    return null;
  }

  /**
   * The cover of a recipe as a local file `{file, mediaType}`, or null. A
   * community cover is downloaded once and kept.
   */
  async function coverOf(ref) {
    const recipe = get(ref);
    if (!recipe) return null;
    const local = coverFileOf(recipe);
    if (local) {
      const mediaType = recipe.origin === 'image' ? store.get(recipe.image).mediaType : sniffImage(readHead(local, 16));
      return mediaType ? { file: local, mediaType } : null;
    }
    if (recipe.origin === 'image' || recipe.origin === 'builtin' || recipe.coverFile || !recipe.cover || !/^https:\/\//i.test(recipe.cover)) return null;
    const stem = coverStem(recipe);
    let bytes;
    try {
      bytes = await fetchBytes(fetchImpl, recipe.cover, MAX_COVER_BYTES, 20_000);
    } catch {
      return null;
    }
    const mediaType = sniffImage(bytes);
    if (!mediaType) return null;
    const file = `${stem}.${COVER_TYPES[mediaType]}`;
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, bytes);
    return { file, mediaType };
  }

  return { all, get, sources, ensure, refresh: () => ensure(20_000, true), saveMine, updateMine, removeMine, coverMineIfBare, setSources, coverOf, coverFileOf, sourceUrls };
}
