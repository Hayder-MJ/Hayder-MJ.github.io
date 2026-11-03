# Solar Sizer website

The public website: what Solar Sizer does, the free trial download, the price and the Buy button. It is a plain
static site for GitHub Pages, with no server code.

- `index.html` is the Arabic page (the main page) and `en/index.html` the English one. Both use `styles.css`.
- `site.js` holds the seller's price, WhatsApp number, email and the releases repository. Change them only there.
- `images/` holds screenshots of the program and its printed quotes, made from the demo data.
- All links are relative, so the site also works when opened straight from this folder.

## Downloads

The download buttons link to the newest release of the public repository `Hayder-MJ/solarsizer-updates`. In the
browser, `site.js` asks GitHub for that release and points the buttons straight at `SolarSizer-Setup-<version>.exe`.
If GitHub doesn't answer, the buttons still open the release page. Solar Sizer's updater reads the same releases.

## Address

The pages are written for `https://hayder-mj.github.io/` (repository `Hayder-MJ.github.io`). If the site moves to
another address, change it in the `canonical`, `hreflang` and `og:` lines of both pages, in `robots.txt` and in
`sitemap.xml`.

## Checks

```
cd Website
npm test
```

The tests need no internet.
