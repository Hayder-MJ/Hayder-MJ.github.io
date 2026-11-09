// ---- The seller's details: the only place to change them. ----
// Leave a value empty ("") until it is known: the page then shows a neutral text instead.
const SITE = {
  // One-year licence price as shown to buyers, e.g. "250,000 IQD" or "$199".
  price: "",
  // WhatsApp number in international form, digits only, e.g. "9647701234567".
  whatsapp: "9647843731036",
  // Contact email (optional).
  email: "hamjdh27@gmail.com",
  // The public GitHub repository whose releases hold the installers (the same one Solar Sizer updates from).
  releases: "Hayder-MJ/solarsizer-updates",
  // The version the "new" band talks about. The band in both home pages writes it in its [data-version] spans;
  // a site test checks that they match this, so a new release changes this line and those spans together.
  version: "2.11.9",
};

// ---- Page wiring (no need to change below) ----
(function () {
  const ar = document.documentElement.lang === "ar";
  const say = (en, arText) => (ar ? arText : en);

  document.querySelectorAll("[data-price]").forEach((el) => {
    el.textContent = SITE.price || say("Contact us for the price", "تواصل معنا لمعرفة السعر");
  });

  const message = say("Hello, I would like to buy Solar Sizer.", "مرحباً، أرغب بشراء برنامج Solar Sizer.");
  const buyLink = SITE.whatsapp
    ? `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(message)}`
    : SITE.email
      ? `mailto:${SITE.email}?subject=${encodeURIComponent("Solar Sizer")}&body=${encodeURIComponent(message)}`
      : "#contact";
  document.querySelectorAll("[data-buy]").forEach((a) => {
    a.href = buyLink;
    if (buyLink.startsWith("http")) { a.target = "_blank"; a.rel = "noopener"; }
  });

  const contact = document.querySelector("[data-contact]");
  if (contact) {
    const parts = [];
    if (SITE.whatsapp) parts.push(`<a href="https://wa.me/${SITE.whatsapp}" target="_blank" rel="noopener">WhatsApp <span class="ltr">+${SITE.whatsapp}</span></a>`);
    if (SITE.email) parts.push(`<a href="mailto:${SITE.email}">${SITE.email}</a>`);
    contact.innerHTML = parts.join(" · ") || say("Contact details coming soon.", "معلومات التواصل قريباً.");
  }

  // WhatsApp: the help tile and a round button in the bottom corner, both from SITE.whatsapp. No number, no tile and no button.
  const askLink = SITE.whatsapp
    ? `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(say("Hello, I have a question about Solar Sizer.", "مرحباً، لدي سؤال عن برنامج Solar Sizer."))}`
    : "";
  let waButton = null;
  if (askLink) {
    document.querySelectorAll("[data-wa]").forEach((a) => { a.href = askLink; a.target = "_blank"; a.rel = "noopener"; a.hidden = false; });
    const stickyButton = document.querySelector("[data-sticky]");
    if (stickyButton && document.createElement) {
      waButton = document.createElement("a");
      waButton.className = "wa-float";
      waButton.href = askLink; waButton.target = "_blank"; waButton.rel = "noopener";
      waButton.setAttribute("aria-label", say("Talk to us on WhatsApp", "كلّمنا على واتساب"));
      waButton.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-5A8 8 0 1 1 21 12z"/><path d="M8.5 12h.01M12 12h.01M15.5 12h.01"/></svg>';
      stickyButton.after(waButton); // right after the sticky button, so CSS can lift it above that button when it shows
    }
  }

  const year = document.querySelector("[data-year]");
  if (year) year.textContent = new Date().getFullYear();

  // Download buttons open the newest release page on GitHub. When GitHub answers, they download the
  // installer itself instead. If GitHub is slow or refuses, the release page still works.
  const downloads = document.querySelectorAll("[data-download]");
  if (downloads.length && SITE.releases && window.fetch) {
    fetch(`https://api.github.com/repos/${SITE.releases}/releases/latest`, { headers: { Accept: "application/vnd.github+json" } })
      .then((res) => (res.ok ? res.json() : null))
      .then((release) => {
        const installer = installerOf(release);
        if (installer) downloads.forEach((a) => { a.href = installer; });
      })
      .catch(() => {});
  }

  // ---- Motion: soft fades on scroll, facts that count up once, and the phone's sticky download button. ----
  // Everything here is skipped when the browser can't watch the page or the visitor asked for less motion;
  // the page is then complete and still, with the real numbers already written in the HTML.
  const watch = window.IntersectionObserver;
  const still = !window.matchMedia || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const root = document.documentElement;

  const sticky = document.querySelector("[data-sticky]");
  const hero = document.querySelector(".hero");
  const cta = document.querySelector(".cta");
  if (sticky && hero && cta && watch) {
    // Shown once the hero has scrolled away, hidden again when the last band (or anything after it) is on screen.
    // It also steps aside while the yellow "new" band is on screen, so two yellow download links never sit together.
    let pastHero = false, atEnd = false, onBand = false;
    const update = () => sticky.classList.toggle("show", pastHero && !atEnd && !onBand);
    new watch(([e]) => { pastHero = !e.isIntersecting && e.boundingClientRect.top < 0; update(); }).observe(hero);
    new watch(([e]) => { atEnd = e.isIntersecting || e.boundingClientRect.top < 0; update(); }).observe(cta);
    const band = document.querySelector(".news");
    if (band) new watch(([e]) => { onBand = e.isIntersecting; update(); }).observe(band);
    if (waButton) new watch(([e]) => { waButton.classList.toggle("aside", e.isIntersecting); }).observe(cta);
  }

  if (watch && !still && root && root.classList) {
    root.classList.add("js-motion");
    // A part is hidden only once the browser has said it is off screen, so if this never runs, nothing stays hidden.
    const seen = new watch((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) { e.target.classList.add("reveal"); return; }
        e.target.classList.add("in");
        seen.unobserve(e.target);
      });
    });
    document.querySelectorAll(".center, .split > div, .tile, .paper, .step, .price-box, .faq, .cta .wrap").forEach((el) => seen.observe(el));

    // The facts count up from 0 the first time they come into view, then stay put.
    // A number is set to 0 only while it is fully off screen, and counts up once it is well in view.
    const counting = new watch((entries) => {
      entries.forEach((e) => {
        const el = e.target;
        if (!el.dataset.armed) {
          if (e.intersectionRatio === 0) { el.dataset.armed = "1"; el.textContent = "0"; } else counting.unobserve(el);
          return;
        }
        if (e.intersectionRatio < 0.6) return;
        counting.unobserve(el);
        const end = Number(e.target.dataset.count), start = performance.now(), ms = 900;
        const step = (now) => {
          const t = Math.min(1, (now - start) / ms);
          e.target.textContent = String(Math.round(end * (1 - Math.pow(1 - t, 3))));
          if (t < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    }, { threshold: [0, 0.6] });
    document.querySelectorAll("[data-count]").forEach((el) => counting.observe(el));
  }

  function installerOf(release) {
    const allowed = `https://github.com/${SITE.releases}/releases/download/`;
    const asset = ((release && release.assets) || []).find((a) => /^SolarSizer-Setup-\d+\.\d+\.\d+\.exe$/i.test(a.name));
    const url = asset && asset.browser_download_url;
    return url && url.startsWith(allowed) ? url : null;
  }
})();
