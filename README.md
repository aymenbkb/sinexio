# SINEXIO — Landing Page

Premium static landing page for Sinexio.

## Stack
- HTML5 / CSS3 / Vanilla JavaScript
- GSAP 3 + ScrollTrigger via CDN
- Responsive/mobile layout
- Provided Sinexio logo assets
- No build step required

## Run
Open `index.html` directly, or serve the folder with any static server.

## Main sections
Hero / Dashboard → Workflow → Technician mobile app → AI reports → Visio / Billing / Donneurs d'ordre → CTA / Demo form.

## Production notes
- The demo form uses native Netlify Forms (`demo-sinexio`) with a honeypot and Netlify's built-in spam filtering. Enable form detection in the site's Netlify Forms settings before deploying.
- `netlify/functions/send-demo-email.js` is an optional SMTP endpoint. Browser code never contains SMTP credentials; switch the form handler to this endpoint only if custom transactional email is required.
- For the optional endpoint, set `SMTP_HOST`, `SMTP_PORT` (`465` or `587`), `SMTP_USER`, `SMTP_PASS`, `DEMO_EMAIL_TO`, `UPSTASH_REDIS_REST_URL`, and `UPSTASH_REDIS_REST_TOKEN` in Netlify Site Settings, scoped to Functions where available, then redeploy.
- The authenticated SMTP account must be permitted to send as `noreply@sinexio.fr`. The endpoint rejects cross-origin requests, validates and bounds input, ignores honeypot submissions, and limits each client IP to three requests per ten minutes using Upstash Redis. Missing SMTP or rate-limit configuration fails closed.
- To enable Netlify-provided reCAPTCHA v2, follow the placeholder comment in `index.html` and update the Content Security Policy for the required Google origins. For Cloudflare Turnstile, verify the token server-side in the SMTP function before sending mail; do not rely on client-side validation alone.
- For maximum production performance, self-host GSAP and fonts.
- For maximum production performance, self-host GSAP and fonts.
