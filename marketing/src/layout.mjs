// שלד HTML משותף לכל עמודי האתר הציבורי: head עם SEO מלא, כותרת עליונה, פוטר משפטי, JSON-LD.
// אין כאן שום סקריפט צד שלישי, פיקסל או cookie.

export function escapeHtml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export const logoSvg = (size = 40, id = "lg") => `<svg width="${size}" height="${size}" viewBox="0 0 200 200" aria-hidden="true" focusable="false"><defs><linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF099"/><stop offset=".3" stop-color="#D4AF37"/><stop offset=".7" stop-color="#AA7C11"/><stop offset="1" stop-color="#F3E5AB"/></linearGradient><linearGradient id="${id}s" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".4" stop-color="#E2E8F0"/><stop offset=".7" stop-color="#94A3B8"/><stop offset="1" stop-color="#CBD5E1"/></linearGradient></defs><path d="M170,45 C150,25 100,25 70,45 C40,65 42,105 75,120 C85,125 105,125 125,120 C110,123 90,121 82,115 C62,100 58,75 80,62 C95,52 135,52 150,65 L170,45 Z" fill="url(#${id}g)"/><path d="M70,155 C90,175 140,175 170,155 C200,135 198,95 165,80 C155,75 135,75 115,80 C130,77 150,79 158,85 C178,100 182,125 160,138 C145,148 105,148 90,135 L70,155 Z" fill="url(#${id}s)"/><rect x="100" y="110" width="12" height="18" rx="2" fill="url(#${id}g)"/><rect x="118" y="95" width="12" height="33" rx="2" fill="url(#${id}g)"/><rect x="136" y="75" width="12" height="53" rx="2" fill="url(#${id}g)"/></svg>`;

const whatsappIcon = `<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.6.8-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 12 12 0 0 0 4.6 4.1c1.7.7 2.4.8 3.2.7a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z"/></svg>`;

// כל העמודים (פוטר + קישוריות פנימית). בהאדר מוצגים רק הארבעה המרכזיים (headerNav) — header של מוצר, לא סרגל SEO.
const navItems = [
  {href: "/how-it-works/", label: "איך זה עובד", header: true},
  {href: "/for-mortgage-advisors/", label: "ליועצי משכנתאות", header: true},
  {href: "/non-bank-financing/", label: "מימון חוץ בנקאי", header: true},
  {href: "/mortgage-reform-2026/", label: "רפורמת המשכנתאות 2026"},
  {href: "/faq/", label: "שאלות ותשובות", header: true},
  {href: "/about/", label: "על SynCash"}
];
const headerNav = navItems.filter((item) => item.header);

export function ctaButtons(site, {primaryClass = "btn btn-primary", secondaryClass = "btn btn-secondary", whatsapp = true} = {}) {
  return `<a class="${primaryClass}" href="${site.registerUrl}" data-cta="register">הרשמה חינם ליועצים</a>
<a class="${secondaryClass}" href="${site.loginUrl}" data-cta="login">כניסה למערכת</a>${whatsapp ? `
<a class="btn btn-tertiary" href="#" data-whatsapp hidden>${whatsappIcon}<span>צור קשר ב-WhatsApp</span></a>` : ""}`;
}

export function renderPage(page, assets, site) {
  const url = `${site.baseUrl}${page.path === "/404.html" ? "/404/" : page.path}`;
  const title = escapeHtml(page.title);
  const description = escapeHtml(page.description);
  const jsonLd = [
    {
      "@context": "https://schema.org", "@type": "Organization", "@id": `${site.baseUrl}/#organization`,
      name: "SynCash", url: site.baseUrl, logo: `${site.baseUrl}/icon-512.png`, description: site.description, areaServed: "IL", inLanguage: "he-IL"
    },
    {"@context": "https://schema.org", "@type": "WebSite", "@id": `${site.baseUrl}/#website`, name: "SynCash", url: site.baseUrl, inLanguage: "he-IL", publisher: {"@id": `${site.baseUrl}/#organization`}},
    {"@context": "https://schema.org", "@type": "WebPage", "@id": `${url}#webpage`, url, name: page.title, description: page.description, inLanguage: "he-IL", isPartOf: {"@id": `${site.baseUrl}/#website`}, dateModified: page.lastmod ?? site.buildDate},
    ...(page.jsonLd ?? [])
  ];
  const robots = page.noindex ? `<meta name="robots" content="noindex, nofollow">` : `<meta name="robots" content="index, follow, max-image-preview:large">`;

  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
${robots}
<link rel="canonical" href="${url}">
<link rel="alternate" hreflang="he-IL" href="${url}">
<link rel="alternate" hreflang="x-default" href="${url}">
<meta property="og:type" content="${page.ogType ?? "website"}">
<meta property="og:site_name" content="SynCash">
<meta property="og:locale" content="he_IL">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${site.baseUrl}/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="SynCash — מערכת ליועצי משכנתאות">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}">
<meta name="twitter:image" content="${site.baseUrl}/og-image.png">
<meta name="theme-color" content="#061128">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-32x32.png" type="image/png" sizes="32x32">
<link rel="icon" href="/favicon-16x16.png" type="image/png" sizes="16x16">
<link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180">
<link rel="manifest" href="/site.webmanifest">
<link rel="preload" href="/fonts/FrankRuhlLibre-700-hebrew.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/Heebo-400-hebrew.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${assets.css}">
<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>
</head>
<body class="${page.bodyClass ?? ""}">
<a class="skip-link" href="#main">דלג לתוכן הראשי</a>
<header class="site-header" role="banner">
  <div class="container header-inner">
    <a class="brand" href="/" aria-label="SynCash — לעמוד הבית">${logoSvg(44, "hd")}<span class="brand-name">SynCash</span></a>
    <button class="nav-toggle" type="button" data-nav-toggle aria-expanded="false" aria-controls="site-nav"><span class="nav-toggle-bars" aria-hidden="true"></span><span class="nav-toggle-label">תפריט</span></button>
    <nav class="site-nav" id="site-nav" data-nav aria-label="ניווט ראשי">
      <ul>${headerNav.map((item) => `<li><a href="${item.href}"${item.href === page.path ? ' aria-current="page"' : ""}>${item.label}</a></li>`).join("")}</ul>
      <div class="nav-actions">
        <a class="btn btn-tertiary btn-small" href="#" data-whatsapp hidden>${whatsappIcon}<span>WhatsApp</span></a>
        <a class="nav-login" href="${site.loginUrl}" data-cta="login">כניסה למערכת</a>
        <a class="btn btn-primary btn-small" href="${site.registerUrl}" data-cta="register">הרשמה חינם ליועצים</a>
      </div>
    </nav>
  </div>
</header>
<main id="main" tabindex="-1">
${page.body(site)}
</main>
<footer class="site-footer" role="contentinfo">
  <div class="container footer-inner">
    <div class="footer-brand">
      ${logoSvg(44, "ft")}
      <p><strong>SynCash</strong><br>מערכת ליועצי משכנתאות: תיק אחד, הגשה אחת, יותר אפשרויות מימון.</p>
      <p class="footer-fine">השירות מיועד ליועצי משכנתאות ולגופי מימון. אין באמור התחייבות לאישור מימון, לריבית או לתנאים כלשהם.</p>
    </div>
    <nav class="footer-nav" aria-label="ניווט משני">
      <h2 class="footer-heading">האתר</h2>
      <ul>${navItems.map((item) => `<li><a href="${item.href}">${item.label}</a></li>`).join("")}</ul>
    </nav>
    <nav class="footer-nav" aria-label="מסמכים משפטיים ונגישות">
      <h2 class="footer-heading">משפטי ונגישות</h2>
      <ul>
        <li><a href="/legal/terms/">תנאי שימוש</a></li>
        <li><a href="/legal/privacy/">מדיניות פרטיות</a></li>
        <li><a href="/legal/dpa/">DPA</a></li>
        <li><a href="/legal/privacy-requests/">בקשות פרטיות</a></li>
        <li><a href="/accessibility/">הצהרת נגישות</a></li>
      </ul>
    </nav>
    <div class="footer-nav">
      <h2 class="footer-heading">כניסה</h2>
      <ul>
        <li><a href="${site.loginUrl}" data-cta="login">כניסה למערכת</a></li>
        <li><a href="${site.registerUrl}" data-cta="register">הרשמה חינם ליועצים</a></li>
        <li><a href="#" data-whatsapp hidden>צור קשר ב-WhatsApp</a></li>
      </ul>
      <ul class="social-list" data-social-list hidden aria-label="רשתות חברתיות">
        <li><a href="#" data-social="facebook" hidden rel="noopener noreferrer" target="_blank">Facebook</a></li>
        <li><a href="#" data-social="linkedin" hidden rel="noopener noreferrer" target="_blank">LinkedIn</a></li>
        <li><a href="#" data-social="instagram" hidden rel="noopener noreferrer" target="_blank">Instagram</a></li>
        <li><a href="#" data-social="youtube" hidden rel="noopener noreferrer" target="_blank">YouTube</a></li>
      </ul>
    </div>
  </div>
  <div class="container footer-bottom"><span>© ${site.year} SynCash</span><span>syncash.co.il</span></div>
</footer>
<a class="whatsapp-float" href="#" data-whatsapp hidden aria-label="צור קשר ב-WhatsApp">${whatsappIcon}</a>
<script src="${assets.js}" defer></script>
</body>
</html>
`;
}
