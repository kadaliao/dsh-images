import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  CODE_PREFIX,
  PNG_KEYWORD,
  decodeRecipe,
  encodeRecipe,
  findCode,
  normalizeRecipe,
  parseRecipeText,
  pick,
  pngText,
  recipeFromImage,
  recipeInPng,
  renderPrompt,
  searchRecipes,
  shareText,
  slotsOf,
  withPngText,
} from '../lib/recipes.mjs';
import { COMMUNITY_MIRROR, COMMUNITY_URL, createLibrary, parseRef, sourceKey } from '../lib/library.mjs';
import { PNG_2x3, sheetPng } from './fixtures.mjs';

const FIGURINE = {
  id: 'desk-figurine',
  title: { zh: '桌面手办', en: 'Desk figurine' },
  summary: { zh: '把照片做成手办', en: 'A photo as a figurine' },
  category: 'photo',
  tags: ['Figurine', '3d', 'figurine'],
  inputs: [{ name: 'photo', label: { zh: '照片', en: 'A photo' } }],
  slots: [
    { name: 'scene', label: { zh: '场景', en: 'Scene' }, default: 'a tidy desk' },
    { name: 'unused', label: 'never used', default: 'x' },
  ],
  prompt: 'Turn {{ subject }} in the photo into a figurine standing on {{scene}}; {{scene}} is lit softly.',
  params: { size: '1024x1536', quality: 'ultra', frames: 7 },
  source: { repo: 'someone/prompts', url: 'https://github.com/someone/prompts#case-1', license: 'MIT', author: '@someone' },
  sample: 'https://example.com/sample.png',
  extra: 'dropped',
};

test('a recipe is checked: its blanks come from the template, labels and defaults from its slots', () => {
  const r = normalizeRecipe(FIGURINE);
  assert.deepEqual(slotsOf(r.prompt), ['subject', 'scene']);
  assert.deepEqual(r.slots, [
    { name: 'subject', label: { en: 'subject' }, default: '' },
    { name: 'scene', label: { zh: '场景', en: 'Scene' }, default: 'a tidy desk' },
  ]);
  assert.deepEqual(r.tags, ['figurine', '3d']);
  assert.deepEqual(r.params, { size: '1024x1536' }, 'an unknown quality and a frame count outside the layouts are dropped');
  assert.equal(r.sample, undefined);
  assert.equal(r.extra, undefined);
  assert.deepEqual(r.inputs, [{ name: 'photo', label: { zh: '照片', en: 'A photo' } }]);
  assert.equal(r.source.license, 'MIT');

  assert.throws(() => normalizeRecipe({ title: 'x' }), /no prompt/);
  assert.throws(() => normalizeRecipe({ prompt: 'x' }), /no title/);
  assert.throws(() => normalizeRecipe([]), /object/);
  const many = Array.from({ length: 9 }, (_, i) => `{{s${i}}}`).join(' ');
  assert.throws(() => normalizeRecipe({ title: 't', prompt: many }), /at most 8 blanks/);

  // A plain string is filed under its language; the category falls back on what the recipe does.
  const plain = normalizeRecipe({ title: '黑板课堂', prompt: 'p', params: { frames: 4, frameMs: 5 }, cover: '../secret.png' });
  assert.deepEqual(plain.title, { zh: '黑板课堂' });
  assert.equal(plain.category, 'sticker');
  assert.deepEqual(plain.params, { frames: 4, frameMs: 40 });
  assert.equal(plain.cover, undefined, 'a cover path may not climb out of its source');
  assert.equal(plain.id, '', 'no id to be had from a Chinese title');
  assert.equal(normalizeRecipe({ title: 'Swiss Grid Poster!', prompt: 'p' }).id, 'swiss-grid-poster');
  assert.equal(pick(plain.title, 'en'), '黑板课堂');
  assert.equal(pick({ zh: '中', en: 'en' }, 'zh-CN'), '中');
});

test('a template is filled with the values given, then the defaults, then the blank\'s name', () => {
  const r = normalizeRecipe(FIGURINE);
  assert.equal(renderPrompt(r, {}), 'Turn subject in the photo into a figurine standing on a tidy desk; a tidy desk is lit softly.');
  assert.equal(
    renderPrompt(r, { subject: 'the cat', scene: '  a bookshelf ' }, 'make it glossy'),
    'Turn the cat in the photo into a figurine standing on a bookshelf; a bookshelf is lit softly.\n\nAdditional direction: make it glossy',
  );
});

test('a recipe code carries the recipe, and is found inside a whole message', () => {
  const r = normalizeRecipe({ ...FIGURINE, cover: 'https://example.com/c.webp', stats: { votes: 3 }, issue: 7 });
  const code = encodeRecipe(r);
  assert.ok(code.startsWith(CODE_PREFIX));
  assert.match(code, /^dshimg1\.[A-Za-z0-9_-]+$/);
  const text = shareText(r, 'zh', code);
  assert.match(text, /【DSH Images 玩法】桌面手办/);
  assert.equal(findCode(`看看这个\n${text}\n好玩`), code);
  const back = decodeRecipe(text);
  assert.equal(back.prompt, r.prompt);
  assert.equal(back.cover, 'https://example.com/c.webp');
  assert.equal(back.stats, undefined, 'votes stay with the source');
  assert.equal(back.issue, undefined);
  assert.deepEqual(parseRecipeText(code), back);

  assert.throws(() => decodeRecipe('no code here'), /no recipe code/);
  assert.throws(() => decodeRecipe(`${code.slice(0, 30)}`), /damaged or cut off/);
  // The recipe's JSON is taken too, bare or fenced.
  assert.equal(parseRecipeText(JSON.stringify(FIGURINE)).id, 'desk-figurine');
  assert.equal(parseRecipeText('```json\n' + JSON.stringify({ recipe: FIGURINE }) + '\n```').id, 'desk-figurine');
  assert.throws(() => parseRecipeText('{nope'), /does not parse/);
});

test('a PNG carries its recipe in a text chunk, and still decodes as the same picture', async () => {
  const png = await sheetPng(2, 2);
  const r = normalizeRecipe(FIGURINE);
  const tagged = withPngText(png, PNG_KEYWORD, encodeRecipe(r));
  assert.ok(tagged.length > png.length);
  assert.equal(recipeInPng(tagged).prompt, r.prompt);
  // Setting it again replaces the chunk rather than adding a second.
  const again = withPngText(tagged, PNG_KEYWORD, encodeRecipe({ ...r, prompt: 'changed' }));
  assert.equal(recipeInPng(again).prompt, 'changed');
  assert.equal([...pngText(again).keys()].filter((k) => k === PNG_KEYWORD).length, 1);
  const { decodePng } = await import('../lib/animate.mjs');
  const a = decodePng(png);
  const b = decodePng(again);
  assert.equal(b.width, a.width);
  assert.ok(Buffer.from(b.data).equals(Buffer.from(a.data)), 'the pixels are untouched');
  assert.equal(recipeInPng(png), null);
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
  assert.equal(withPngText(jpeg, PNG_KEYWORD, 'x'), jpeg);
});

test('a gallery picture stands for its own recipe, braces and all', () => {
  const r = recipeFromImage({ id: 'mw8-ab', prompt: 'A poster titled {{NIGHT}}, flat style', size: '1536x1024', inputs: 2, animation: { frames: 9, delayMs: 120 }, quality: 'high' });
  assert.equal(r.id, 'image-mw8-ab');
  assert.deepEqual(r.slots, [], 'braces in a prompt do not become blanks');
  assert.equal(renderPrompt(r), 'A poster titled { {NIGHT} }, flat style');
  assert.equal(r.title.en, 'A poster titled { {NIGHT} }');
  assert.equal(r.inputs.length, 2);
  assert.equal(r.category, 'sticker');
  assert.deepEqual(r.params, { size: '1536x1024', frames: 9, frameMs: 120, quality: 'high' });
  assert.equal(recipeFromImage({ id: 'x', prompt: '日系手帐风格的信息图，奶油白纸背景' }).title.zh, '日系手帐风格的信息图');
});

test('search finds every term, the title first', () => {
  const list = [
    normalizeRecipe({ id: 'a', title: 'Poster', summary: 'a magazine look', prompt: 'p' }),
    normalizeRecipe({ id: 'b', title: 'Magazine cover', prompt: 'p' }),
    normalizeRecipe({ id: 'c', title: { zh: '手绘图解' }, tags: ['sketch'], prompt: 'hand-drawn magazine' }),
  ];
  assert.deepEqual(searchRecipes(list, 'magazine').map((r) => r.id), ['b', 'a', 'c']);
  assert.deepEqual(searchRecipes(list, '手绘').map((r) => r.id), ['c']);
  assert.deepEqual(searchRecipes(list, 'magazine sketch').map((r) => r.id), ['c']);
  assert.equal(searchRecipes(list, '').length, 3);
});

// --- the library ---------------------------------------------------------------------

function fixtureDirs() {
  const dir = mkdtempSync(join(tmpdir(), 'images-lib-'));
  const builtinDir = join(dir, 'pkg-recipes');
  mkdirSync(join(builtinDir, 'covers'), { recursive: true });
  writeFileSync(
    join(builtinDir, 'builtin.json'),
    JSON.stringify({ format: 1, recipes: [FIGURINE, { id: 'broken' }, { ...FIGURINE, title: 'dup' }, { id: 'chalk', title: 'Chalk', prompt: 'chalk {{topic}}', slots: [{ name: 'topic', default: 'tides' }] }] }),
  );
  writeFileSync(join(builtinDir, 'covers', 'desk-figurine.webp'), Buffer.from('RIFF0000WEBPVP8 ', 'latin1'));
  return { dir, builtinDir };
}

/** A web of community indexes: `routes` maps a URL to a body, a status, or a function. */
function web(routes) {
  const calls = [];
  const fetch = async (url) => {
    calls.push(String(url));
    const hit = routes[String(url)];
    const value = typeof hit === 'function' ? hit() : hit;
    if (value === undefined || typeof value === 'number') return { ok: false, status: value ?? 404, headers: new Map(), arrayBuffer: async () => new ArrayBuffer(0) };
    const bytes = Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value));
    return { ok: true, status: 200, headers: new Map(), arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
  };
  return { fetch, calls };
}

const INDEX = {
  format: 1,
  title: { zh: '社区', en: 'Community' },
  repo: 'kadaliao/dsh-images-recipes',
  recipes: [
    { id: 'riso', title: 'Risograph', prompt: 'riso {{subject}}', cover: 'covers/riso.png', author: 'github:ana', issue: 12, stats: { votes: 9, works: 2 } },
    { id: 'bad', title: 'No prompt' },
    { id: 'abs', title: 'Absolute', prompt: 'p', cover: 'https://cdn.example.com/abs.png' },
  ],
};

test('the library joins built-in, own and community recipes under refs', async () => {
  const { dir, builtinDir } = fixtureDirs();
  let now = 1_000_000;
  const net = web({ [COMMUNITY_URL]: 503, [COMMUNITY_MIRROR]: INDEX, 'https://cdn.jsdelivr.net/gh/kadaliao/dsh-images-recipes@main/covers/riso.png': Buffer.from(PNG_2x3) });
  const store = { get: (id) => (id === 'pic1' ? { id: 'pic1', prompt: 'a lighthouse at night', size: '1024x1024', file: join(dir, 'pic1.png'), mediaType: 'image/png' } : undefined) };
  writeFileSync(join(dir, 'pic1.png'), PNG_2x3);
  const lib = createLibrary({ dir, builtinDir, store, fetch: net.fetch, now: () => now });

  await lib.ensure(5000);
  // GitHub was down; the mirror answered, and covers resolve against the mirror.
  assert.deepEqual(net.calls.slice(0, 2), [COMMUNITY_URL, COMMUNITY_MIRROR]);
  const refs = lib.all().map((r) => r.ref);
  assert.deepEqual(refs, ['builtin:desk-figurine', 'builtin:chalk', 'community:riso', 'community:abs']);
  const riso = lib.get('community:riso');
  assert.equal(riso.cover, 'https://cdn.jsdelivr.net/gh/kadaliao/dsh-images-recipes@main/covers/riso.png');
  assert.equal(riso.repo, 'kadaliao/dsh-images-recipes');
  assert.deepEqual(riso.stats, { votes: 9, works: 2 });
  const community = lib.sources().find((s) => s.key === 'community');
  assert.equal(community.count, 2);
  assert.deepEqual(community.title, { zh: '社区', en: 'Community' });

  // Covers: the built-in file, a community one downloaded once and kept, a picture's own file.
  assert.equal((await lib.coverOf('builtin:desk-figurine')).mediaType, 'image/webp');
  assert.equal(await lib.coverOf('builtin:chalk'), null);
  const first = await lib.coverOf('community:riso');
  assert.equal(first.mediaType, 'image/png');
  const fetchedBefore = net.calls.length;
  assert.deepEqual(await lib.coverOf('community:riso'), first);
  assert.equal(net.calls.length, fetchedBefore, 'a kept cover is not fetched again');
  assert.equal(await lib.coverOf('community:abs'), null, 'a cover that cannot be fetched is none');
  assert.equal((await lib.coverOf('image:pic1')).file, join(dir, 'pic1.png'));

  // A picture's own recipe.
  assert.equal(lib.get('image:pic1').prompt, 'a lighthouse at night');
  assert.equal(lib.get('image:nope'), undefined);
  assert.equal(lib.get('nonsense'), undefined);
  assert.deepEqual(parseRef('mine:a-b'), { source: 'mine', id: 'a-b' });

  // A fresh cache is not fetched again within the week; a forced refresh is.
  const before = net.calls.length;
  now += 3_600_000;
  await lib.ensure(5000);
  assert.equal(net.calls.length, before);
  await lib.refresh();
  assert.ok(net.calls.length > before);

  // A second process reads the cache without fetching.
  const cold = createLibrary({ dir, builtinDir, store, fetch: async () => assert.fail('no fetch'), now: () => now });
  await cold.ensure(10);
  assert.equal(cold.get('community:riso').title.en, 'Risograph');
});

test('the user\'s own recipes are saved, renamed apart, edited, covered once and removed', () => {
  const { dir, builtinDir } = fixtureDirs();
  const net = web({});
  const lib = createLibrary({ dir, builtinDir, fetch: net.fetch, now: () => 5 });
  const cover = join(dir, 'cover.png');
  writeFileSync(cover, PNG_2x3);

  const a = lib.saveMine({ ...FIGURINE, stats: { votes: 3 }, issue: 4 });
  assert.equal(a.ref, 'mine:desk-figurine');
  assert.equal(a.stats, undefined);
  const b = lib.saveMine(FIGURINE, { cover: { file: cover, mediaType: 'image/png' } });
  assert.equal(b.ref, 'mine:desk-figurine-2');
  assert.ok(existsSync(b.coverFile));
  const c = lib.saveMine({ title: '黑板', prompt: 'p' });
  assert.match(c.id, /^r-/);

  const edited = lib.updateMine('desk-figurine', { title: { en: 'Figure' }, prompt: 'new {{thing}}' });
  assert.equal(edited.title.en, 'Figure');
  assert.deepEqual(edited.slots.map((s) => s.name), ['thing']);
  assert.equal(lib.updateMine('nope', {}), undefined);
  assert.throws(() => lib.updateMine('desk-figurine', { prompt: '' }), /no prompt/);

  // A first picture covers a bare recipe; a covered one keeps its cover.
  assert.equal(lib.coverMineIfBare('desk-figurine', { file: cover, mediaType: 'image/png' }), true);
  assert.equal(lib.coverMineIfBare('desk-figurine', { file: cover, mediaType: 'image/png' }), false);
  assert.ok(lib.get('mine:desk-figurine').coverFile.endsWith('desk-figurine.png'));

  // Another library on the same folder sees the same recipes.
  const again = createLibrary({ dir, builtinDir, fetch: net.fetch });
  assert.deepEqual(
    again.all().filter((r) => r.origin === 'mine').map((r) => r.ref),
    ['mine:desk-figurine', 'mine:desk-figurine-2', `mine:${c.id}`],
  );
  assert.equal(lib.removeMine('desk-figurine-2'), true);
  assert.equal(existsSync(b.coverFile), false);
  assert.equal(lib.removeMine('desk-figurine-2'), false);
  assert.equal(JSON.parse(readFileSync(join(dir, 'recipes', 'mine.json'), 'utf8')).recipes.length, 2);
});

test('sources can be changed; an unreachable one says why and is not hammered', async () => {
  const { dir, builtinDir } = fixtureDirs();
  let now = 10;
  const extra = 'https://team.example.com/recipes/index.json';
  const net = web({ [COMMUNITY_URL]: INDEX, [extra]: 500 });
  const lib = createLibrary({ dir, builtinDir, fetch: net.fetch, now: () => now });
  lib.setSources([COMMUNITY_URL, extra, 'http://insecure.example.com/x.json', extra]);
  assert.deepEqual(lib.sourceUrls(), [COMMUNITY_URL, extra]);
  await lib.ensure(5000);
  const team = lib.sources().find((s) => s.url === extra);
  assert.equal(team.key, sourceKey(extra));
  assert.match(team.key, /^s[0-9a-f]{8}$/);
  assert.equal(team.error, '500');
  const calls = net.calls.length;
  now += 60_000;
  await lib.ensure(5000);
  assert.equal(net.calls.length, calls, 'a failed source rests an hour');
  lib.setSources([]);
  assert.deepEqual(lib.all().map((r) => r.origin), ['builtin', 'builtin']);
});
