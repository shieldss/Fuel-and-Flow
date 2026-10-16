# Food lookup backend

`food.js` is the existing Vercel Node function. The PWA stays on GitHub Pages. Deploy the repository to Vercel and set `USDA_API_KEY` only as a hosting secret. Never put a key in frontend assets, settings URLs, fixtures or logs.

Supported GET parameters:

- `source=usda&kind=search&value=<food query>`
- `source=usda&kind=food&value=<FDC ID>`
- `source=off&kind=search&value=<food query>` (no API key required)

Open Food Facts name search uses the dedicated `https://search.openfoodfacts.org/search` service through this backend because that service is not directly CORS-enabled for the PWA. Keep search queries as full text; do not substitute the v2 structured-search endpoint, which does not support ordinary keyword search. The deployed field-projection option can return empty objects, so the backend filters response fields locally. Product/barcode details continue to use the direct public Open Food Facts v3 product API. Only the query or food ID is sent, never profile or diary data.

CORS allows `https://shieldss.github.io`. The endpoint validates sources, request kinds and bounded inputs; upstream hosts are fixed. OFF requests use an identifying application User-Agent. Responses are filtered and cached per source; malformed/timed-out/error responses are not cached as empty searches. USDA access alone requires the secret key. Timeouts fit within the 30-second Vercel function limit. The per-instance throttle/cache are best effort, not a global quota guarantee; CORS is not authentication. No secrets or upstream request URLs are logged.

The deployed OFF name-search URL is independent of custom USDA proxy settings. Existing barcode and per-food caches remain usable offline; refreshed name-search caches use the new transport key. The app reports service errors and offers other sources/manual entry. Barcode selection retrieves current product details before portion review, including serving size and nutrition basis.
