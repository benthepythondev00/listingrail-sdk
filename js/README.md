# listingrail (JavaScript)

JavaScript client for the [Listingrail](https://listingrail.com) real estate listings API. One key returns live sale and rental listings from 22 property portals (Zillow, Realtor.com, Redfin, Rightmove, Zoopla, Idealista, ImmoScout24, Daft.ie, Otodom, Bayut and others) in one JSON shape.

ESM, Node 18 or newer. No dependencies: it uses the global `fetch`. Types are in `index.d.ts`.

## Install

```bash
npm install https://github.com/benthepythondev00/listingrail-sdk/releases/download/v0.1.0/listingrail-0.1.0.tgz
```

A free key gives 250 listings a month for an email address, no card: https://listingrail.com/#key

## Examples

Try it without a key. `demo()` returns stored real listings and uses no credits:

```js
import Listingrail from "listingrail";

const client = new Listingrail();
console.log((await client.demo()).samples.slice(0, 3)); // which sample cities exist
const { listings } = await client.demo({ source: "rightmove", city: "London", type: "rent" });
for (const home of listings) console.log(home.price, home.currency, home.address);
```

Search a portal. One credit per listing returned:

```js
const client = new Listingrail({ apiKey: process.env.LISTINGRAIL_API_KEY });
const result = await client.search({ source: "idealista", location: "madrid", type: "rent", maxPrice: 2000, limit: 50 });
console.log(result.count, "listings,", result.credits_remaining, "credits left");
for (const home of result.listings) console.log(home.price, home.currency, home.beds, home.address, home.url);
```

List the sources, with the location format and the filters each one takes:

```js
for (const s of (await client.sources()).sources) console.log(s.source, s.countries, s.kinds, s.filters, s.location);
```

Handle errors. Each one carries the server's message:

```js
import { InsufficientCreditsError, RateLimitError, SourceFailedError, UnknownLocationError } from "listingrail";

try {
  await client.search({ source: "rightmove", location: "SW11", type: "rent", limit: 20 });
} catch (err) {
  if (err instanceof InsufficientCreditsError) console.log(err.message, err.buyUrl); // checkout link for more credits
  else if (err instanceof UnknownLocationError) console.log(err.message);           // nothing charged
  else if (err instanceof SourceFailedError) { /* the portal could not be read; nothing charged, retry in a minute */ }
  else if (err instanceof RateLimitError) { /* more than 5 requests a second on one key */ }
  else throw err;
}
```

## Methods

| Method | Endpoint | Key | Credits |
|--------|----------|-----|---------|
| `sources()` | `GET /v1/sources` | no | 0 |
| `demo()`, `demo({ source, city, type })` | `GET /v1/demo` | no | 0 |
| `search({ source, location, type, minPrice, maxPrice, minBeds, limit })` | `POST /v1/listings/search` | yes | 1 per listing |
| `details({ source, url })` | `POST /v1/listings/details` | yes | 1 |
| `history(source, listingId)` | `GET /v1/listings/{source}/{id}/history` | yes, paid plan | 0 |
| `account()` | `GET /v1/account` | yes | 0 |
| `usage({ limit })` | `GET /v1/usage` | yes | 0 |
| `createMonitor({ source, location, type, minPrice, maxPrice, minBeds, limit, webhookUrl, email })` | `POST /v1/monitors` | yes | 1 per listing read at each daily check (none on Feed) |
| `monitors()` | `GET /v1/monitors` | yes | 0 |
| `monitorChanges(monitorId)` | `GET /v1/monitors/{id}/changes` | yes | 0 |
| `deleteMonitor(monitorId)` | `DELETE /v1/monitors/{id}` | yes | 0 |
| `signup(email)` | `POST /v1/signup` | no | 0 |

Answers are the API's JSON, with the API's own field names (`credits_remaining`, `postal_code`).

## Things to know

- A search returns at most 500 listings, and the REST API has no offset or page parameter, so this client has no paging iterator. For more, split the search by price range or area.
- A search answer has `credits_used` and `credits_remaining`. Below the low-balance line (20 credits, 50 on a free key) it also has `notice`, `upgrade_url` and `buy_url`.
- `minPrice`, `maxPrice` and `minBeds` work only on sources that list them under `filters` in `sources()`. Elsewhere the API answers 400.
- Requests can take up to two minutes on large searches. The default timeout is 180 seconds: `new Listingrail({ timeout: 60_000 })` changes it.
- The client does not retry. A search sent twice is charged twice, so retries are left to you.
- Keep the key on a server. In a browser page everyone who opens it can read the key.

## Errors

All extend `ListingrailError` and have `status`, `code`, `message`, `detail`, `buyUrl` and `upgradeUrl`.

| Status | Class |
|--------|-------|
| 400 | `BadRequestError`, and `UnknownLocationError` for `unknown_location` |
| 401 | `AuthenticationError` |
| 402 | `InsufficientCreditsError` (`buyUrl`, `upgradeUrl`, `plans`, `creditsRemaining`) |
| 403 | `PermissionDeniedError` |
| 404 | `NotFoundError` |
| 409 | `ConflictError` |
| 422 | `ValidationError` |
| 429 | `RateLimitError` |
| 502 | `SourceFailedError` |
| no answer | `APIConnectionError` |

## Tests

```bash
npm test             # unit tests, no network
npm run test:live    # also calls /v1/sources and /v1/demo (no key, no credits)
```

Docs: https://listingrail.com/docs/ . MIT license.
