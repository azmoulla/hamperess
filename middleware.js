// FILE: middleware.js (Vercel Routing Middleware, project root)
//
// Replaces the old vercel.json `has` (header-condition) rewrite for bot
// detection. That approach worked in production but could NOT be tested in
// local `vercel dev` -- confirmed by isolating the rule, it caused a hard
// "Failed to fetch" on unrelated static paths locally, and Vercel's own docs
// confirm `has` conditions are a known local-dev gap. See
// api/_lib/seo-helper.js and [[project_seo_overhaul]] memory for the wider
// context.
//
// Routing Middleware (this file) is the supported, testable replacement:
// Vercel explicitly documents it as workable in both local dev and
// production. It runs on every matched request, sniffs the User-Agent, and
// rewrites recognized crawler/bot/link-preview requests to the SSR render
// endpoint (api/utility.js?fn=render). Everything else (real visitors, and
// any request that doesn't match `config.matcher` below) passes through
// untouched via next() -- same zero-added-latency-for-humans behavior as
// before.
import { rewrite, next } from '@vercel/functions';

const BOT_UA_RE = /(?:[Bb]ot|[Cc]rawl|[Ss]pider|[Ss]lurp|facebookexternalhit|[Tt]witterbot|[Ll]inked[Ii]n[Bb]ot|[Ww]hats[Aa]pp|[Ss]lackbot|[Tt]elegram[Bb]ot|[Dd]iscordbot|[Pp]interest|[Aa]pplebot|[Ss]kype[Uu]ri[Pp]review|Google-InspectionTool|AdsBot|Mediapartners|[Yy]andex|ia_archiver|[Ee]mbedly|Quora Link Preview|W3C_Validator/;

// Matches every path EXCEPT: api/, assets/, data/ (existing static/dynamic
// content that must never be intercepted) and any path with a file
// extension (a dot anywhere in it) -- that covers index.html, robots.txt,
// sitemap.xml, admin.html, favicon.ico, manifest.json, service-worker.js,
// app.js, style.css, etc. without having to name each one. Anything left
// (e.g. "/", "/product/foo-slug", "/category/Birthday Hampers") is a real
// SPA route, exactly the set the old vercel.json rule targeted.
export const config = {
    matcher: '/((?!api/|assets/|data/|.*\\..*).*)',
};

export default function middleware(request) {
    const ua = request.headers.get('user-agent') || '';

    if (!BOT_UA_RE.test(ua)) {
        return next();
    }

    const url = new URL(request.url);
    const target = new URL('/api/utility', url);
    target.searchParams.set('fn', 'render');
    target.searchParams.set('p', url.pathname);

    return rewrite(target);
}
