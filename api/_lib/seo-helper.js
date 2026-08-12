// FILE: api/_lib/seo-helper.js
// Shared logic for the SEO work added 2026-08-11: sitemap.xml generation and
// server-side prerendering of crawlable HTML for bots/social-share previews.
// Lives under api/_lib/ (not directly under api/) so it does NOT count
// against Vercel's Hobby-plan 12-Serverless-Function limit -- see
// api/utility.js, which is the actual function that imports and calls this.
import { db } from './firebase-admin-helper.js';

// ---------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------

// Ported byte-for-byte from public/app.js's createSlug() so server-generated
// product URLs (sitemap.xml, canonical tags) exactly match what the client
// router produces and matches against in showProductDetail(). If that
// function ever changes, this one needs to change with it.
export function createSlug(text) {
    if (!text) return '';
    return text.toString().toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/&/g, '-and-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-');
}

export function escapeXml(str = '') {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

export function escapeHtml(str = '') {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// Strips any stray HTML/markup that may have ended up in CMS text fields and
// collapses whitespace, then truncates to a clean word boundary -- used for
// meta descriptions, which must be plain text.
export function toPlainText(str = '', maxLen = 300) {
    const plain = String(str).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    if (plain.length <= maxLen) return plain;
    const cut = plain.slice(0, maxLen);
    const lastSpace = cut.lastIndexOf(' ');
    return (lastSpace > maxLen * 0.6 ? cut.slice(0, lastSpace) : cut).trim() + '...';
}

export function getBaseUrl(req) {
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
    const proto = host.startsWith('localhost') || host.startsWith('127.0.0.1')
        ? 'http'
        : (req.headers['x-forwarded-proto'] || 'https');
    return `${proto}://${host}`;
}

// ---------------------------------------------------------------------
// Static content-page config -- mirrors the exact routes registered in
// defineRoutes() in public/app.js. If a new static page route is added
// there, add its entry here too so it gets prerendered/sitemap'd.
// ---------------------------------------------------------------------
export const STATIC_PAGES = {
    '/contact-us': { key: 'contact_us', title: 'Contact Us', kind: 'contact' },
    '/our-mission': { key: 'our_mission', title: 'Our Mission', kind: 'sections' },
    '/privacy-policy': { key: 'privacy_policy', title: 'Privacy Policy', kind: 'sections' },
    '/terms-and-conditions': { key: 'terms_and_conditions', title: 'Terms & Conditions', kind: 'sections' },
    '/about-us': { key: 'about_us', title: 'About Us', kind: 'sections' },
    '/faqs': { key: 'faqs', title: 'FAQs', kind: 'faqs' },
    '/delivery-info': { key: 'delivery_info', title: 'Delivery Information', kind: 'sections' },
};

const SITE_NAME = 'LuxuryHampers';

// ---------------------------------------------------------------------
// Data fetchers (direct Firestore reads, same collections/docs the public
// API endpoints use -- see api/inventory.js, api/content-manager.js,
// api/site-settings.js for the equivalent client-facing versions)
// ---------------------------------------------------------------------

export async function fetchAllProducts() {
    const snap = await db.collection('products').get();
    if (snap.empty) return [];
    return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.isArchived !== true);
}

export async function fetchMenu() {
    const snap = await db.doc('siteContent/header_nav').get();
    return snap.exists ? snap.data() : { items: [] };
}

export async function fetchSiteSettings() {
    const snap = await db.doc('settings/site_settings').get();
    const defaults = { freeDeliveryThreshold: 50, baseCurrencySymbol: '£' };
    return snap.exists ? { ...defaults, ...snap.data() } : defaults;
}

export async function fetchStaticPage(pageKey) {
    const snap = await db.doc(`siteContent/${pageKey}`).get();
    return snap.exists ? snap.data() : null;
}

// Flattens the mega-menu structure (top-level items + subMenu items that
// have an `argument`) into a simple list of { title, argument } category
// entries -- used for both sitemap.xml and category-page prerendering.
export function flattenMenuCategories(menu) {
    const out = [];
    for (const item of (menu.items || [])) {
        if (item.argument && !item.isBestsellerFilter && item.argument !== 'Bestsellers') {
            out.push({ title: item.title, argument: item.argument });
        }
        if (item.isMegaMenu && Array.isArray(item.subMenu)) {
            for (const sub of item.subMenu) {
                if (sub.argument) out.push({ title: sub.title, argument: sub.argument });
            }
        }
    }
    return out;
}

// CORRECTED (2026-08-11): originally matched against occasionTags/
// dietaryTags/contentsTags/tag -- those are for the sidebar chip filters
// (see checkSmartMatch() in public/app.js), a completely different
// mechanism from /category/:name routing. Real category matching is done
// in updateProductView() (public/app.js, "Category Filter" step): it
// strips one trailing "s" from the whole argument string, lowercases it,
// and checks whether it's a substring of either p.title or p.category.
// Ported byte-for-byte so prerendered category pages show exactly the same
// products the live client-rendered grid would.
export function productsForCategory(products, argument) {
    const simpleFilter = String(argument).replace(/s$/, '').toLowerCase();
    return products.filter(p =>
        (p.title && p.title.toLowerCase().includes(simpleFilter)) ||
        (p.category && p.category.toLowerCase().includes(simpleFilter))
    );
}

export function productImage(product) {
    if (product.imageUrls && product.imageUrls.length > 0) return product.imageUrls[0];
    if (product.imageUrl) return product.imageUrl;
    return null;
}

function nl2br(html) {
    return html.replace(/\n/g, '<br>');
}

// ---------------------------------------------------------------------
// sitemap.xml
// ---------------------------------------------------------------------
export async function buildSitemapXml(req) {
    const base = getBaseUrl(req);
    const [products, menu] = await Promise.all([fetchAllProducts(), fetchMenu()]);
    const categories = flattenMenuCategories(menu);

    const urls = [];
    const add = (path, changefreq, priority) => urls.push({ loc: `${base}${path}`, changefreq, priority });

    add('/', 'daily', '1.0');
    add('/create-your-own', 'monthly', '0.6');
    for (const path of Object.keys(STATIC_PAGES)) {
        add(path, 'monthly', '0.5');
    }
    for (const p of products) {
        const slug = createSlug(p.slug || p.title);
        if (slug) add(`/products/${slug}`, 'weekly', '0.8');
    }
    const seen = new Set();
    for (const c of categories) {
        if (seen.has(c.argument)) continue;
        seen.add(c.argument);
        add(`/category/${encodeURIComponent(c.argument)}`, 'weekly', '0.7');
    }
    add('/filter/BESTSELLER', 'weekly', '0.7');

    const body = urls.map(u =>
        `  <url>\n    <loc>${escapeXml(u.loc)}</loc>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`
    ).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

// ---------------------------------------------------------------------
// JSON-LD builders
// ---------------------------------------------------------------------
function organizationJsonLd(base) {
    return {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: SITE_NAME,
        url: `${base}/`,
        logo: `${base}/assets/icons/icon-192x192.png`,
        contactPoint: [{
            '@type': 'ContactPoint',
            telephone: '+44-1666-567890',
            contactType: 'customer service',
            email: 'sales@luxuryhampers.com'
        }]
    };
}

function breadcrumbJsonLd(base, items) {
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items.map((it, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: it.name,
            item: `${base}${it.path}`
        }))
    };
}

function productJsonLd(base, product, slug) {
    const image = productImage(product);
    const price = (product.salePrice && product.salePrice < product.price) ? product.salePrice : product.price;
    const obj = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.title,
        description: toPlainText(product.professionalDescription || product.description || product.title, 500),
        sku: product.id,
        offers: {
            '@type': 'Offer',
            url: `${base}/products/${slug}`,
            priceCurrency: 'GBP',
            price: String(price),
            availability: (product.stock > 0) ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock'
        }
    };
    if (image) obj.image = [image];
    if (product.reviewCount > 0 && product.rating) {
        obj.aggregateRating = {
            '@type': 'AggregateRating',
            ratingValue: String(Number(product.rating).toFixed(2)),
            reviewCount: String(product.reviewCount)
        };
    }
    return obj;
}

function faqJsonLd(faqs) {
    return {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqs.map(f => ({
            '@type': 'Question',
            name: f.question,
            acceptedAnswer: { '@type': 'Answer', text: toPlainText(f.answer, 2000) }
        }))
    };
}

// ---------------------------------------------------------------------
// Per-route SEO metadata + content-snapshot resolution.
// Returns null for routes that aren't SEO-relevant (account/checkout/login
// etc., or an unrecognized path) -- the caller should pass those requests
// through unmodified.
// ---------------------------------------------------------------------
export async function resolveSeoMeta(path, req) {
    const base = getBaseUrl(req);

    // Home
    if (path === '/') {
        const settings = await fetchSiteSettings();
        const symbol = settings.baseCurrencySymbol || '£';
        return {
            title: `${SITE_NAME} | Luxury Gift Hampers, Delivered UK-Wide`,
            description: toPlainText(`Discover our curated collection of luxury food and wine hampers, hand-packed and delivered UK-wide. Free delivery on orders over ${symbol}${settings.freeDeliveryThreshold}.`, 300),
            canonical: `${base}/`,
            ogType: 'website',
            container: 'page-list',
            contentHtml: null,
            jsonLd: [organizationJsonLd(base)]
        };
    }

    // Product detail
    let m = path.match(/^\/products\/([^/]+)$/);
    if (m) {
        const products = await fetchAllProducts();
        // NOTE: `path` (and therefore m[1]) was already decodeURIComponent'd
        // once by renderSeoPage() before matching -- do not decode again here.
        const wantedSlug = createSlug(m[1]);
        const product = products.find(p => createSlug(p.slug || p.title) === wantedSlug);
        if (!product) return null;

        const slug = createSlug(product.slug || product.title);
        const image = productImage(product);
        const rawDescription = product.professionalDescription ||
            (Array.isArray(product.description) ? product.description.join(' ') : product.description) ||
            product.title;
        const description = toPlainText(rawDescription, 300);
        const price = (product.salePrice && product.salePrice < product.price) ? product.salePrice : product.price;

        const snapshot = `<h1>${escapeHtml(product.title)}</h1>` +
            (image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(product.title)}">` : '') +
            `<p>${nl2br(escapeHtml(description))}</p>` +
            `<p><strong>£${Number(price).toFixed(2)}</strong></p>`;

        return {
            title: `${product.title} | ${SITE_NAME}`,
            description,
            canonical: `${base}/products/${slug}`,
            ogType: 'product',
            ogImage: image,
            container: 'page-detail',
            contentHtml: snapshot,
            jsonLd: [
                organizationJsonLd(base),
                productJsonLd(base, product, slug),
                breadcrumbJsonLd(base, [{ name: 'Home', path: '/' }, { name: product.title, path: `/products/${slug}` }])
            ]
        };
    }

    // Category listing
    m = path.match(/^\/category\/([^/]+)$/);
    if (m) {
        const argument = m[1]; // already decoded -- see note above
        const products = await fetchAllProducts();
        const matches = productsForCategory(products, argument);
        const listHtml = matches.slice(0, 60).map(p => {
            const slug = createSlug(p.slug || p.title);
            return `<li><a href="/products/${slug}">${escapeHtml(p.title)}</a></li>`;
        }).join('');
        const snapshot = `<h1>${escapeHtml(argument)}</h1><ul>${listHtml}</ul>`;

        return {
            title: `${argument} | ${SITE_NAME}`,
            description: toPlainText(`Shop our ${argument} collection -- ${matches.length} luxury hampers hand-packed and delivered UK-wide.`, 300),
            canonical: `${base}/category/${encodeURIComponent(argument)}`,
            ogType: 'website',
            container: 'product-grid',
            contentHtml: snapshot,
            showListVisible: true,
            jsonLd: [
                organizationJsonLd(base),
                breadcrumbJsonLd(base, [{ name: 'Home', path: '/' }, { name: argument, path: `/category/${encodeURIComponent(argument)}` }])
            ]
        };
    }

    // Flag-driven filters (Bestsellers, Sale, etc.)
    m = path.match(/^\/filter\/([^/]+)$/);
    if (m) {
        const tag = m[1]; // already decoded -- see note above
        const label = tag.length ? (tag.charAt(0).toUpperCase() + tag.slice(1).toLowerCase()) : tag;
        return {
            title: `${label} Hampers | ${SITE_NAME}`,
            description: toPlainText(`Shop our ${label.toLowerCase()} hampers -- hand-packed and delivered UK-wide.`, 300),
            canonical: `${base}/filter/${encodeURIComponent(tag)}`,
            ogType: 'website',
            container: 'page-list',
            contentHtml: null,
            showListVisible: true,
            jsonLd: [organizationJsonLd(base)]
        };
    }

    // Create-your-own
    if (path === '/create-your-own') {
        return {
            title: `Create Your Own Hamper | ${SITE_NAME}`,
            description: 'Build your own luxury gift hamper -- choose from our finest components to create a truly unique, personal gift.',
            canonical: `${base}/create-your-own`,
            ogType: 'website',
            container: null,
            contentHtml: null,
            jsonLd: [organizationJsonLd(base)]
        };
    }

    // Static content pages (privacy policy, T&Cs, FAQs, contact us, etc.)
    const staticDef = STATIC_PAGES[path];
    if (staticDef) {
        const data = await fetchStaticPage(staticDef.key);

        if (staticDef.kind === 'faqs') {
            const faqs = (data && Array.isArray(data.faqs)) ? data.faqs : (Array.isArray(data) ? data : []);
            const bodyHtml = faqs.map(f => `<h2>${escapeHtml(f.question)}</h2><p>${nl2br(escapeHtml(f.answer))}</p>`).join('');
            const firstAnswer = faqs[0] ? toPlainText(faqs[0].answer, 250) : '';
            return {
                title: `Frequently Asked Questions | ${SITE_NAME}`,
                description: toPlainText(firstAnswer || 'Answers to common questions about ordering, delivery, and our luxury hampers.', 300),
                canonical: `${base}${path}`,
                ogType: 'website',
                container: 'page-static',
                contentHtml: `<h1>Frequently Asked Questions</h1>${bodyHtml}`,
                jsonLd: faqs.length ? [organizationJsonLd(base), faqJsonLd(faqs)] : [organizationJsonLd(base)]
            };
        }

        if (staticDef.kind === 'contact') {
            const pageTitle = (data && data.pageTitle) || staticDef.title;
            const subtitle = (data && data.pageSubtitle) || '';
            return {
                title: `${pageTitle} | ${SITE_NAME}`,
                description: toPlainText(subtitle || `Get in touch with ${SITE_NAME} -- we'd love to hear from you.`, 300),
                canonical: `${base}${path}`,
                ogType: 'website',
                container: 'page-static',
                contentHtml: `<h1>${escapeHtml(pageTitle)}</h1>` + (subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''),
                jsonLd: [organizationJsonLd(base)]
            };
        }

        // Generic { pageTitle, sections } shape
        const pageTitle = (data && data.pageTitle) || staticDef.title;
        const sections = (data && Array.isArray(data.sections)) ? data.sections : [];
        const bodyHtml = sections.map(s => `<h2>${escapeHtml(s.title || '')}</h2><p>${nl2br(escapeHtml(s.content || ''))}</p>`).join('');
        const firstSectionText = sections[0] ? toPlainText(sections[0].content, 250) : '';
        return {
            title: `${pageTitle} | ${SITE_NAME}`,
            description: toPlainText(firstSectionText || pageTitle, 300),
            canonical: `${base}${path}`,
            ogType: 'website',
            container: 'page-static',
            contentHtml: `<h1>${escapeHtml(pageTitle)}</h1>${bodyHtml}`,
            jsonLd: [organizationJsonLd(base)]
        };
    }

    return null;
}

// ---------------------------------------------------------------------
// HTML template fetch + injection
// ---------------------------------------------------------------------
export async function fetchTemplate(base) {
    // Fetches the site's own raw index.html. This literal path is excluded
    // from the bot-conditional rewrite rule in vercel.json specifically so
    // this self-fetch always gets the pristine, un-rewritten static file
    // rather than looping back into this same render function.
    const resp = await fetch(`${base}/index.html`);
    if (!resp.ok) return null;
    return await resp.text();
}

export function injectSeoIntoTemplate(html, meta) {
    let out = html;

    // <title>
    out = out.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(meta.title)}</title>`);

    // Extra <head> tags: description, canonical, robots, Open Graph,
    // Twitter Card, and any JSON-LD structured data blocks.
    const head = [];
    head.push(`<meta name="description" content="${escapeHtml(meta.description || '')}">`);
    head.push(`<link rel="canonical" href="${escapeHtml(meta.canonical)}">`);
    head.push(`<meta name="robots" content="${meta.robots || 'index, follow'}">`);
    head.push(`<meta property="og:type" content="${meta.ogType || 'website'}">`);
    head.push(`<meta property="og:site_name" content="${SITE_NAME}">`);
    head.push(`<meta property="og:title" content="${escapeHtml(meta.title)}">`);
    head.push(`<meta property="og:description" content="${escapeHtml(meta.description || '')}">`);
    head.push(`<meta property="og:url" content="${escapeHtml(meta.canonical)}">`);
    if (meta.ogImage) {
        head.push(`<meta property="og:image" content="${escapeHtml(meta.ogImage)}">`);
        head.push(`<meta name="twitter:card" content="summary_large_image">`);
        head.push(`<meta name="twitter:image" content="${escapeHtml(meta.ogImage)}">`);
    } else {
        head.push(`<meta name="twitter:card" content="summary">`);
    }
    head.push(`<meta name="twitter:title" content="${escapeHtml(meta.title)}">`);
    head.push(`<meta name="twitter:description" content="${escapeHtml(meta.description || '')}">`);
    for (const obj of (meta.jsonLd || [])) {
        // Escape "<" inside the serialized JSON so a stray "</script>" in any
        // text field (product description, FAQ answer, etc.) can't break out
        // of the script tag.
        const json = JSON.stringify(obj).replace(/</g, '\\u003c');
        head.push(`<script type="application/ld+json">${json}</script>`);
    }
    out = out.replace('</head>', `${head.join('\n    ')}\n</head>`);

    // Reveal the relevant page container(s) (all start `display: none;` in
    // the raw template -- see the 2026-08-11 page-list fix) and, for
    // currently-empty containers, inject a real content snapshot so
    // non-JS crawlers see genuine text/links instead of a blank shell.
    // app.js's own showPage()/render functions overwrite this same markup
    // the instant JS runs, so this has no effect on the real client UI.
    if (meta.container) {
        const toReveal = new Set([meta.container]);
        if (meta.showListVisible) toReveal.add('page-list');
        for (const id of toReveal) {
            out = out.replace(new RegExp(`<div id="${id}"[^>]*>`), `<div id="${id}">`);
        }

        if (meta.contentHtml) {
            const emptyDivRe = new RegExp(`<div id="${meta.container}"[^>]*></div>`);
            if (emptyDivRe.test(out)) {
                out = out.replace(emptyDivRe, `<div id="${meta.container}">${meta.contentHtml}</div>`);
            }
        }
    }

    return out;
}

// ---------------------------------------------------------------------
// Top-level orchestrator used by api/utility.js's fn=render handler.
// Returns the full HTML string to serve, or null if `path` isn't an
// SEO-relevant route (caller should fall back to serving /index.html
// unmodified in that case).
// ---------------------------------------------------------------------
export async function renderSeoPage(req, rawPath) {
    const base = getBaseUrl(req);

    let path = '/';
    try { path = decodeURIComponent(rawPath || '/'); } catch { path = rawPath || '/'; }
    if (!path.startsWith('/')) path = '/' + path;
    if (path.length > 1) path = path.replace(/\/+$/, '');

    const meta = await resolveSeoMeta(path, req);
    if (!meta) return null;

    const template = await fetchTemplate(base);
    if (!template) return null;

    return injectSeoIntoTemplate(template, meta);
}
