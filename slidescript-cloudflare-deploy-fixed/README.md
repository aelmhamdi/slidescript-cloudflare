# SlideScript — Cloudflare Workers + Static Assets

This package is configured for the Cloudflare deployment mode shown in the dashboard screenshot: `npx wrangler deploy`. It deploys the static HTML from `public/` and a small Worker API handler together.

The Gemini API key is **not** included in the HTML or source control. The Worker reads it from the encrypted `GEMINI_API_KEY` secret.

## Fix for “Could not detect a directory containing static files”

That error happened because the project ran `npx wrangler deploy` without a Wrangler configuration telling Wrangler where the website files live. `wrangler.jsonc` now specifies `main: src/index.js` and `assets.directory: ./public`, and routes `/api/*` through the Worker.

## Update the existing GitHub repository

1. Extract this ZIP directly into a local clone of the GitHub repository already connected to Cloudflare (or upload the extracted files to the repository root). Do not put the files inside an extra nested `slidescript-cloudflare/` folder. The repository root must contain `wrangler.jsonc`, `src/index.js`, and `public/index.html`.
3. Keep the Cloudflare deployment settings consistent with the current setup:
   - Root directory: `/` (repository root)
   - Build command: `None` / blank
   - Deploy command: `npx wrangler deploy`
4. Commit the changes and allow Cloudflare to redeploy. The new config should allow Wrangler to find `./public` and bundle the worker and assets in one deployment.

If you instead decide to create a **Cloudflare Pages** project (not a Worker with static assets), use the Pages-specific flow and Pages Functions conventions; do not use the Worker deploy command shown in your screenshot.

## Set the Gemini key

1. Revoke the Gemini API key previously embedded in a browser-facing HTML file.
2. Create a replacement key in Google AI Studio.
3. In the Cloudflare Worker, open **Settings → Variables and Secrets** and add an encrypted secret named `GEMINI_API_KEY`.
4. Save, then redeploy.

Do not put the API key into `public/index.html` or a GitHub file.

## Notes

- The web UI still runs slide parsing and Word generation in the browser. `/api/generate` forwards each slide's Gemini request using the server-side secret.
- The API proxy limits request bodies to 10 MiB and allows only configured model names.
- A public endpoint can still consume Gemini quota if strangers use it. Before sharing broadly, add Cloudflare Turnstile or another access control/rate limit. Keep the Google project billing disabled if you need to avoid API charges.
