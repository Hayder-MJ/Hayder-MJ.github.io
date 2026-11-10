// Checks that the static site works on GitHub Pages: every local link points at a real file, no link starts
// with "/" (that would break when the site is opened from a folder), and the download wiring is safe.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pages = ['index.html', 'en/index.html', 'privacy.html', 'en/privacy.html', 'terms.html', 'en/terms.html'];
const read = (p) => readFileSync(join(root, p), 'utf8');
const links = (html) => [...html.matchAll(/\s(?:href|src)="([^"]*)"/g)].map((m) => m[1]);

for (const page of pages) {
  test(`${page}: no link starts with "/"`, () => {
    assert.deepEqual(links(read(page)).filter((l) => l.startsWith('/')), []);
  });

  test(`${page}: every local link points at a file`, () => {
    const missing = links(read(page))
      .filter((l) => l && !/^(https?:|mailto:|#)/.test(l))
      .map((l) => l.split('#')[0])
      .map((l) => join(dirname(join(root, page)), l.endsWith('/') || l === '.' ? `${l}/index.html` : l))
      .filter((p) => !existsSync(p));
    assert.deepEqual(missing, []);
  });

  test(`${page}: canonical, hreflang and preview image are full addresses`, () => {
    const html = read(page);
    assert.match(html, /<link rel="canonical" href="https:\/\/[^"]+">/);
    assert.match(html, /hreflang="ar" href="https:\/\//);
    assert.match(html, /hreflang="en" href="https:\/\//);
    assert.match(html, /og:image" content="https:\/\//);
  });

  test(`${page}: links to the privacy policy and the terms of sale`, () => {
    assert.match(read(page), /<a class="foot-link" href="privacy\.html">/);
    assert.match(read(page), /<a class="foot-link" href="terms\.html">/);
  });

  if (!page.endsWith('index.html')) continue;

  test(`${page}: download buttons work without JavaScript`, () => {
    const buttons = [...read(page).matchAll(/<a [^>]*data-download[^>]*>/g)].map((m) => m[0]);
    assert.ok(buttons.length >= 2);
    for (const b of buttons) assert.match(b, /href="https:\/\/github\.com\/[^"]+\/releases\/latest"/);
  });
}

// Runs site.js against a tiny fake page and a fake GitHub answer, and returns the download link it sets.
async function downloadLinkFor(release) {
  const button = { href: 'release-page' };
  const document = {
    documentElement: { lang: 'en' },
    querySelectorAll: (sel) => (sel === '[data-download]' ? [button] : []),
    querySelector: () => null,
  };
  const fetch = async () => ({ ok: true, json: async () => release });
  vm.runInNewContext(read('site.js'), { document, window: { fetch }, fetch, encodeURIComponent });
  await new Promise((r) => setTimeout(r, 10));
  return button.href;
}

test('download button gets the newest installer from the releases repo', async () => {
  const url = 'https://github.com/Hayder-MJ/solarsizer-updates/releases/download/v2.10.0/SolarSizer-Setup-2.10.0.exe';
  const href = await downloadLinkFor({
    assets: [
      { name: 'SolarSizer-Setup-2.10.0.exe.sig', browser_download_url: `${url}.sig` },
      { name: 'SolarSizer-Setup-2.10.0.exe', browser_download_url: url },
    ],
  });
  assert.equal(href, url);
});

test('download button ignores files from anywhere else', async () => {
  const href = await downloadLinkFor({
    assets: [{ name: 'SolarSizer-Setup-2.10.0.exe', browser_download_url: 'https://evil.example/SolarSizer-Setup-2.10.0.exe' }],
  });
  assert.equal(href, 'release-page');
});

test('download button keeps the release page when nothing is published', async () => {
  assert.equal(await downloadLinkFor(null), 'release-page');
});

test('the "new" band names the same version as SITE.version in site.js', () => {
  const version = read('site.js').match(/^\s*version: "(\d+\.\d+\.\d+)",/m)?.[1];
  assert.ok(version, 'SITE.version is missing');
  for (const page of ['index.html', 'en/index.html']) {
    const shown = [...read(page).matchAll(/data-version>([^<]*)</g)].map((m) => m[1]);
    assert.ok(shown.length >= 2, `${page} has no version in its band`);
    assert.deepEqual([...new Set(shown)], [version], page);
  }
});

// Runs site.js with the given WhatsApp number against a fake page holding the sticky button and one WhatsApp tile.
function whatsappWith(number) {
  const tile = { hidden: true, href: '' };
  const made = [];
  const sticky = { after: (el) => made.push(el) };
  const document = {
    documentElement: { lang: 'en' },
    querySelectorAll: (sel) => (sel === '[data-wa]' ? [tile] : []),
    querySelector: (sel) => (sel === '[data-sticky]' ? sticky : null),
    createElement: () => ({ setAttribute() {}, classList: { toggle() {} } }),
  };
  const source = read('site.js').replace(/^(\s*whatsapp: )"[^"]*",/m, (_, k) => `${k}${JSON.stringify(number)},`);
  assert.ok(source.includes(`whatsapp: ${JSON.stringify(number)},`));
  vm.runInNewContext(source, { document, window: {}, encodeURIComponent });
  return { tile, made };
}

test('no WhatsApp button or tile when SITE.whatsapp is empty', () => {
  const { tile, made } = whatsappWith('');
  assert.equal(tile.hidden, true);
  assert.equal(tile.href, '');
  assert.deepEqual(made, []);
});

test('the WhatsApp tile and round button open wa.me in a new tab', () => {
  const { tile, made } = whatsappWith('9647000000000');
  assert.equal(tile.hidden, false);
  assert.match(tile.href, /^https:\/\/wa\.me\/9647000000000\?text=/);
  assert.equal(tile.target, '_blank');
  assert.equal(tile.rel, 'noopener');
  assert.equal(made.length, 1);
  assert.equal(made[0].href, tile.href);
  assert.equal(made[0].target, '_blank');
  assert.equal(made[0].rel, 'noopener');
});

test('robots.txt and sitemap.xml list the site', () => {
  assert.match(read('robots.txt'), /Sitemap: https:\/\/.+\/sitemap\.xml/);
  assert.match(read('sitemap.xml'), /<loc>https:\/\/.+\/en\/<\/loc>/);
});

test('every file in images/ is listed in images/CREDITS.md', () => {
  const credits = read('images/CREDITS.md');
  const listed = new Set([...credits.matchAll(/^\| ([^|\s]+) \|/gm)].map((m) => m[1]));
  const files = readdirSync(join(root, 'images')).filter((f) => f !== 'CREDITS.md');
  assert.deepEqual(files.filter((f) => !listed.has(f)), []);
  assert.deepEqual([...listed].filter((f) => f !== 'File' && !files.includes(f)), [], 'CREDITS.md lists a file that is gone');
});

test('the stock photos are each 150 KB or less', () => {
  const big = readdirSync(join(root, 'images'))
    .filter((f) => f.startsWith('photo-'))
    .filter((f) => statSync(join(root, 'images', f)).size > 150 * 1024);
  assert.deepEqual(big, []);
});
