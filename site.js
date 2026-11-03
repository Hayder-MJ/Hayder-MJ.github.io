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

  function installerOf(release) {
    const allowed = `https://github.com/${SITE.releases}/releases/download/`;
    const asset = ((release && release.assets) || []).find((a) => /^SolarSizer-Setup-\d+\.\d+\.\d+\.exe$/i.test(a.name));
    const url = asset && asset.browser_download_url;
    return url && url.startsWith(allowed) ? url : null;
  }
})();
