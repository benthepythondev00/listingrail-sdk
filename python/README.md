# listingrail (Python)

Python client for the [Listingrail](https://listingrail.com) real estate listings API. One key returns live sale and rental listings from 22 property portals (Zillow, Realtor.com, Redfin, Rightmove, Zoopla, Idealista, ImmoScout24, Daft.ie, Otodom, Bayut and others) in one JSON shape.

Python 3.9 or newer. No dependencies: it uses the standard library.

## Install

```bash
pip install listingrail
```

A free key gives 250 listings a month for an email address, no card: https://listingrail.com/#key

## Examples

Try it without a key. `demo()` returns stored real listings and uses no credits:

```python
from listingrail import Listingrail

client = Listingrail()
print(client.demo()["samples"][:3])           # which sample cities exist
for home in client.demo("rightmove", "London", "rent")["listings"]:
    print(home["price"], home["currency"], home["address"])
```

Search a portal. One credit per listing returned:

```python
client = Listingrail("re_your_key")           # or set LISTINGRAIL_API_KEY
result = client.search("idealista", "madrid", type="rent", max_price=2000, limit=50)
print(result["count"], "listings,", result["credits_remaining"], "credits left")
for home in result["listings"]:
    print(home["price"], home["currency"], home["beds"], home["address"], home["url"])
```

List the sources, with the location format and the filters each one takes:

```python
for s in client.sources()["sources"]:
    print(s["source"], s["countries"], s["kinds"], s["filters"], s["location"])
```

Handle errors. Each one carries the server's message:

```python
from listingrail import InsufficientCreditsError, RateLimitError, SourceFailedError, UnknownLocationError

try:
    client.search("rightmove", "SW11", type="rent", limit=20)
except InsufficientCreditsError as err:
    print(err.message, err.buy_url)           # checkout link for more credits
except UnknownLocationError as err:
    print(err.message)                        # the portal knows no such place; nothing charged
except SourceFailedError:
    pass                                      # the portal could not be read; nothing charged, retry in a minute
except RateLimitError:
    pass                                      # more than 5 requests a second on one key
```

## Methods

| Method | Endpoint | Key | Credits |
|--------|----------|-----|---------|
| `sources()` | `GET /v1/sources` | no | 0 |
| `demo()`, `demo(source, city, type=None)` | `GET /v1/demo` | no | 0 |
| `search(source, location, *, type, min_price, max_price, min_beds, limit=20)` | `POST /v1/listings/search` | yes | 1 per listing |
| `details(source, url)` | `POST /v1/listings/details` | yes | 1 |
| `history(source, listing_id)` | `GET /v1/listings/{source}/{id}/history` | yes, paid plan | 0 |
| `account()` | `GET /v1/account` | yes | 0 |
| `usage(limit=50)` | `GET /v1/usage` | yes | 0 |
| `create_monitor(source, location, *, type, min_price, max_price, min_beds, limit, webhook_url, email)` | `POST /v1/monitors` | yes | 1 per listing read at each daily check (none on Feed) |
| `monitors()` | `GET /v1/monitors` | yes | 0 |
| `monitor_changes(monitor_id)` | `GET /v1/monitors/{id}/changes` | yes | 0 |
| `delete_monitor(monitor_id)` | `DELETE /v1/monitors/{id}` | yes | 0 |
| `signup(email)` | `POST /v1/signup` | no | 0 |

Answers are the API's JSON as plain dicts. `listingrail.types` has a `TypedDict` for each (`Listing`, `SearchResponse`, `Source`, `MonitorChanges` and so on) for editors and type checkers.

## Things to know

- A search returns at most 500 listings, and the REST API has no offset or page parameter, so this client has no paging iterator. For more, split the search by price range or area.
- A search answer has `credits_used` and `credits_remaining`. Below the low-balance line (20 credits, 50 on a free key) it also has `notice`, `upgrade_url` and `buy_url`.
- `min_price`, `max_price` and `min_beds` work only on sources that list them under `filters` in `sources()`. Elsewhere the API answers 400.
- Requests can take up to two minutes on large searches. The default timeout is 180 seconds: `Listingrail(key, timeout=60)` changes it.
- The client does not retry. A search sent twice is charged twice, so retries are left to you.
- `details()` works only for sources with `details: true` in `sources()`.
- `history()` needs a paid plan and returns 404 for a listing that no search or monitor check has fetched.

## Errors

All inherit from `ListingrailError` and have `status`, `code`, `message`, `detail`, `buy_url` and `upgrade_url`.

| Status | Exception |
|--------|-----------|
| 400 | `BadRequestError`, and `UnknownLocationError` for `unknown_location` |
| 401 | `AuthenticationError` |
| 402 | `InsufficientCreditsError` (`buy_url`, `upgrade_url`, `plans`, `credits_remaining`) |
| 403 | `PermissionDeniedError` |
| 404 | `NotFoundError` |
| 409 | `ConflictError` |
| 422 | `ValidationError` |
| 429 | `RateLimitError` |
| 502 | `SourceFailedError` |
| no answer | `APIConnectionError` |

## Tests

```bash
pip install -e ".[test]"
pytest                          # unit tests, no network
LISTINGRAIL_LIVE=1 pytest       # also calls /v1/sources and /v1/demo (no key, no credits)
```

Docs: https://listingrail.com/docs/ . MIT license.
