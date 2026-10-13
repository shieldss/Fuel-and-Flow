# USDA food lookup proxy

`food.js` is a Vercel Node serverless function in the existing Fuel-and-Flow repository. The main PWA remains on GitHub Pages. Deploy this repository to Vercel without changing the GitHub Pages workflow. Add `USDA_API_KEY` as a secret environment variable using the hosting dashboard, then redeploy. Never commit the key or include it in frontend assets, URL settings, fixtures or logs.

After deployment, copy the actual HTTPS `/api/food` endpoint into Fuel & Flow → Settings → Food search. The client sends only the food query or food ID, never the diary or profile. Open Food Facts runs directly from the browser and does not use this USDA-only proxy.

Supported GET parameters: `source=usda`, `kind=search|food`, `value=<search terms or FDC ID>`. Fixed upstreams, input validation, timeouts, origin checks and response-field filtering are included. CORS allows `https://shieldss.github.io` (an origin has no path). CORS is not authentication; other sites on that origin and non-browser clients can still make requests. The in-memory 10 requests/minute/IP throttle and result cache are best-effort per warm function instance, not a global quota guarantee. Configure hosting rate limits if opening this to broad use; USDA's own key quota remains in force. No secrets or request URLs are logged.

Registration requires the user's chosen email at https://fdc.nal.usda.gov/api-key-signup. Backend deployment requires a connected Vercel account. Until configured, USDA is explicitly unavailable in the PWA; Open Food Facts searches and barcode lookup remain usable without a key. No shared API key or bearer token is stored in the browser.
