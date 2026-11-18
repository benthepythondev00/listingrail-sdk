# Listingrail SDK

Python and JavaScript clients for [Listingrail](https://listingrail.com), a real estate listings API: one key returns live sale and rental listings from 22 property portals in one JSON shape. One credit is one listing returned, and a free key gives 250 listings a month for an email address, no card.

- Python package: [`python/`](python/) (Python 3.9+, no dependencies)
- JavaScript package: [`js/`](js/) (ESM, Node 18+, no dependencies, with TypeScript types)
- Runnable scripts: [`examples/`](examples/)

## Portals

22 portals, 24 source keys (Zillow and Redfin each have one for sale and one for rent). Taken from `GET /v1/sources`, which also gives the location format and the filters each source takes.

| Portal | Source key | Country | Listings |
|--------|------------|---------|----------|
| Zillow | `zillow`, `zillow-rentals` | US | sale, rent |
| Realtor.com | `realtor` | US | sale, rent |
| Redfin | `redfin`, `redfin-rentals` | US | sale, rent |
| Zumper | `zumper` | US | rent |
| PadMapper | `padmapper` | US, CA | rent |
| Apartments.com | `apartments-com` | US | rent |
| Craigslist | `craigslist` | US | sale, rent |
| Rightmove | `rightmove` | GB | sale, rent |
| Zoopla | `zoopla` | GB | sale, rent |
| Idealista | `idealista` | ES, IT, PT | sale, rent |
| Immobiliare.it | `immobiliare` | IT | sale, rent |
| Funda | `funda` | NL | sale, rent |
| Leboncoin | `leboncoin` | FR | sale, rent |
| ImmoScout24 | `immobilienscout24` | DE | sale, rent |
| Kleinanzeigen | `kleinanzeigen` | DE | sale, rent |
| Fotocasa | `fotocasa` | ES | sale, rent |
| Daft.ie | `daft` | IE | sale, rent |
| Otodom | `otodom` | PL | sale, rent |
| Imovirtual | `imovirtual` | PT | sale, rent |
| Hemnet | `hemnet` | SE | sale |
| Bayut | `bayut` | AE | sale, rent |
| Property Finder | `propertyfinder` | AE | sale, rent |

`zillow` and `redfin` are the sale keys; `zillow-rentals` and `redfin-rentals` are the rent keys.

## Install

```bash
pip install listingrail      # Python
npm install listingrail      # JavaScript
```

## Quick start

Without a key, `demo` returns stored real listings of a sample city. It uses no credits.

Python:

```python
from listingrail import Listingrail

client = Listingrail()                        # no key needed for demo() and sources()
for home in client.demo("rightmove", "London", "rent")["listings"]:
    print(home["price"], home["currency"], home["address"])

client = Listingrail("re_your_key")           # or set LISTINGRAIL_API_KEY
result = client.search("rightmove", "Manchester", type="rent", limit=20)
for home in result["listings"]:
    print(home["price"], home["currency"], home["beds"], home["address"], home["url"])
print(result["credits_used"], "credits used,", result["credits_remaining"], "left")
```

JavaScript:

```js
import Listingrail from "listingrail";

let client = new Listingrail();               // no key needed for demo() and sources()
const demo = await client.demo({ source: "rightmove", city: "London", type: "rent" });
for (const home of demo.listings) console.log(home.price, home.currency, home.address);

client = new Listingrail({ apiKey: process.env.LISTINGRAIL_API_KEY });
const result = await client.search({ source: "rightmove", location: "Manchester", type: "rent", limit: 20 });
for (const home of result.listings) console.log(home.price, home.currency, home.beds, home.address, home.url);
console.log(result.credits_used, "credits used,", result.credits_remaining, "left");
```

Get a free key at https://listingrail.com/#key and send it as `Authorization: Bearer re_...` (the clients do this) or `X-API-Key`.

## What the clients cover

| Call | Endpoint |
|------|----------|
| sources | `GET /v1/sources` (no key) |
| demo | `GET /v1/demo` (no key) |
| search | `POST /v1/listings/search` |
| details | `POST /v1/listings/details` |
| history | `GET /v1/listings/{source}/{id}/history` (paid plans) |
| account, usage | `GET /v1/account`, `GET /v1/usage` |
| monitors | `POST`, `GET`, `DELETE /v1/monitors`, `GET /v1/monitors/{id}/changes` |
| signup | `POST /v1/signup` (no key) |

Every listing has the same fields: `id`, `url`, `source`, `title`, `address`, `city`, `region`, `postal_code`, `country`, `lat`, `lng`, `price`, `currency`, `price_period`, `beds`, `rooms`, `baths`, `area`, `area_unit`, `property_type`, `listed_at`, `photos`, `agent` and, in search answers, `raw` (the portal's own record). A field a portal does not show is `null`.

Limits to know:

- A search returns at most 500 listings. The REST API has no offset or page parameter, so the clients have no paging iterator. For more, split the search by price range or area.
- 5 requests a second per key. Above that the API answers 429.
- A large search can take up to two minutes. Both clients wait 180 seconds by default.
- The clients do not retry. A search sent twice is charged twice.
- Errors are raised as typed exceptions with the server's message. A 402 carries `buy_url`, the checkout link for more credits.

## Pricing

Free: 250 listings a month, no card. Pack: $9 once for 2,500 listings. Starter: $29 a month for 10,000. Pro: $99 a month for 50,000. Scale: $299 a month for 250,000. Feed: $499 a month for 250,000 plus 25 daily monitors. Current prices: https://listingrail.com/pricing/

## Docs

- API documentation: https://listingrail.com/docs/
- OpenAPI specification: https://listingrail.com/openapi.json
- Summary for AI assistants: https://listingrail.com/llms.txt

## MCP server

AI agents can use the same key with the remote MCP server at `https://listingrail.com/mcp` (streamable HTTP). It has three tools: `list_sources` (free), `search_listings` and `get_listing`. Credits are spent as in the API. Setup steps: https://listingrail.com/mcp/

This repository does not contain the MCP server; it runs at the address above.

## Development

```bash
# Python
cd python && pip install -e ".[test]" && pytest
LISTINGRAIL_LIVE=1 pytest        # also calls /v1/sources and /v1/demo (no key, no credits)

# JavaScript
cd js && npm test
npm run test:live                # the same keyless live test
```

## License

MIT. See [LICENSE](LICENSE).
