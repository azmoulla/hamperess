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
// any excluded path) passes through untouched via next() -- same
// zero-added-latency-for-humans behavior as before.
import { rewrite, next } from '@vercel/functions';

const BOT_UA_RE = /(?:[Bb]ot|[Cc]rawl|[Ss]pider|[Ss]lurp|facebookexternalhit|[Tt]witterbot|[Ll]inked[Ii]n[Bb]ot|[Ww]hats[Aa]pp|[Ss]lackbot|[Tt]elegram[Bb]ot|[Dd]iscordbot|[Pp]interest|[Aa]pplebot|[Ss]kype[Uu]ri[Pp]review|Google-InspectionTool|AdsBot|Mediapartners|[Yy]andex|ia_archiver|[Ee]mbedly|Quora Link Preview|W3C_Validator)/;

// Path prefixes that must never be intercepted -- existing API/static/data
// routes.
const EXCLUDED_PREFIXES = ['/api/', '/assets/', '/data/'];

export const config = {
    // Deliberately broad -- matches every request. The exclusion logic lives
    // in the function body below (plain JS checks) instead of a clever
    // negative-lookahead regex in this config, because embedding a "does
    // this path have a file extension" pattern directly into the matcher
    // caused MIDDLEWARE_INVOCATION_FAILED in local `vercel dev` (2026-08-12)
    // -- see [[feedback_dev_deploy_workflow]]. Checking in plain JS is
    // easier to reason about and debug, and the function itself is cheap (a
    // couple of string checks + one regex test), so running it on every
    // request costs nothing meaningful.
    matcher: '/(.*)',
};

export default function middleware(request) {
    try {
        const url = new URL(request.url);
        const path = url.pathname;

        if (EXCLUDED_PREFIXES.some(prefix => path.startsWith(prefix))) {
            return next();
        }

        // Any path whose last segment has a file extension (app.js,
        // style.css, index.html, robots.txt, sitemap.xml, favicon.ico,
        // manifest.json, ...) is a real static asset, not an SPA route --
        // never intercept it. SPA routes never contain a dot (e.g. "/",
        // "/product/some-slug", "/category/Birthday Hampers").
        const lastSegment = path.slice(path.lastIndexOf('/') + 1);
        if (lastSegment.includes('.')) {
            return next();
        }

        const ua = request.headers.get('user-agent') || '';
        if (!BOT_UA_RE.test(ua)) {
            return next();
        }

        const target = new URL('/api/utility', url);
        target.searchParams.set('fn', 'render');
        target.searchParams.set('p', path);
        return rewrite(target);
    } catch (error) {
        // Never let a middleware bug take the whole site down -- fall
        // through to normal routing on any unexpected error, same
        // fail-open philosophy as handleRender()'s own fallback in
        // api/utility.js.
        console.error('middleware error:', error);
        return next();
    }
}
