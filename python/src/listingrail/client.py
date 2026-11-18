"""The Listingrail client. Standard library only."""
import http.client
import json
import os
import urllib.error
import urllib.request
from typing import Any, Callable, Dict, Optional, Tuple, Union, overload
from urllib.parse import quote, urlencode

from .errors import APIConnectionError, AuthenticationError, ListingrailError, error_from_response
from .types import (
    Account,
    DemoResponse,
    DemoSamples,
    DetailsResponse,
    HistoryResponse,
    MonitorChangesResponse,
    MonitorCreated,
    MonitorDeleted,
    MonitorsResponse,
    SearchResponse,
    SignupResponse,
    SourcesResponse,
    UsageResponse,
)

__version__ = "0.1.0"
DEFAULT_BASE_URL = "https://listingrail.com"
DEFAULT_TIMEOUT = 180.0  # a large search can take up to two minutes; the docs ask for 180 seconds

# (method, url, headers, body or None, timeout in seconds) -> (status, body)
Transport = Callable[[str, str, Dict[str, str], Optional[bytes], float], Tuple[int, bytes]]


def _urllib_transport(method: str, url: str, headers: Dict[str, str], body: Optional[bytes], timeout: float) -> Tuple[int, bytes]:
    request = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.status, response.read()
    except urllib.error.HTTPError as exc:  # an answer with a status of 400 or more
        return exc.code, exc.read()


def _drop_none(values: Dict[str, Any]) -> Dict[str, Any]:
    return {k: v for k, v in values.items() if v is not None}


class Listingrail:
    """Client for https://listingrail.com.

    api_key: your key (`re_...`). Left out, it is read from the LISTINGRAIL_API_KEY environment variable.
        `sources()`, `demo()` and `signup()` work without one.
    timeout: seconds to wait for an answer (default 180).
    transport: a function that sends one request, for tests or a custom HTTP stack.

    The client never retries: the server sends no Retry-After, and a search sent twice is charged twice.
    """

    def __init__(self, api_key: Optional[str] = None, *, base_url: str = DEFAULT_BASE_URL, timeout: float = DEFAULT_TIMEOUT,
                 transport: Optional[Transport] = None) -> None:
        self.api_key = api_key or os.environ.get("LISTINGRAIL_API_KEY") or None
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self._transport: Transport = transport or _urllib_transport

    def __repr__(self) -> str:  # never shows the key
        return f"Listingrail(base_url={self.base_url!r}, api_key={'set' if self.api_key else 'not set'})"

    def _request(self, method: str, path: str, *, params: Optional[Dict[str, Any]] = None, body: Optional[Dict[str, Any]] = None,
                 auth: bool = True) -> Any:
        headers = {"Accept": "application/json", "User-Agent": f"listingrail-python/{__version__}"}
        if auth:
            if not self.api_key:
                raise AuthenticationError("No API key. Pass api_key or set LISTINGRAIL_API_KEY. A free key: https://listingrail.com/#key")
            headers["Authorization"] = f"Bearer {self.api_key}"
        url = self.base_url + path
        query = _drop_none(params or {})
        if query:
            url += "?" + urlencode(query)
        data = None
        if body is not None:
            data = json.dumps(body).encode()
            headers["Content-Type"] = "application/json"
        try:
            status, raw = self._transport(method, url, headers, data, self.timeout)
        except ListingrailError:
            raise
        except (OSError, ValueError, http.client.HTTPException) as exc:  # URLError, timeouts and refused connections are OSError
            raise APIConnectionError(f"Could not reach {self.base_url}: {exc}") from exc
        text = raw.decode("utf-8", "replace") if raw else ""
        try:
            parsed = json.loads(text) if text else None
        except ValueError:
            parsed = None
        if status >= 400:
            raise error_from_response(status, parsed, text)
        if parsed is None:
            raise ListingrailError(f"The answer was not JSON: {text[:200]!r}", status)
        return parsed

    # listings

    def sources(self) -> SourcesResponse:
        """Every source key with its countries, sale or rent, accepted filters and location format. No key, no credits."""
        return self._request("GET", "/v1/sources", auth=False)

    def search(self, source: str, location: str, *, type: Optional[str] = None, min_price: Optional[int] = None,
               max_price: Optional[int] = None, min_beds: Optional[int] = None, limit: int = 20) -> SearchResponse:
        """Live listings of one source for one place. 1 credit per listing returned; an empty or failed search is free.

        type: "rent" or "sale"; left out, the source's first kind is used (see `sources()`).
        min_price, max_price, min_beds: only where the source takes them (`filters` in `sources()`), else the API answers 400.
        limit: 1 to 500. The REST API has no offset or page parameter: for more than 500, split the search by
            price range or area.
        """
        body = _drop_none({"source": source, "location": location, "type": type, "minPrice": min_price, "maxPrice": max_price,
                           "minBeds": min_beds, "limit": limit})
        return self._request("POST", "/v1/listings/search", body=body)

    def details(self, source: str, url: str) -> DetailsResponse:
        """One listing by its link, 1 credit. Only for sources with `details: true` in `sources()`."""
        return self._request("POST", "/v1/listings/details", body={"source": source, "url": url})

    def history(self, source: str, listing_id: str) -> HistoryResponse:
        """First seen, last seen and the price changes stored for one listing. Paid plans (403 on a free key), no credits.

        404 when no search, details call or monitor check has fetched the listing."""
        return self._request("GET", f"/v1/listings/{quote(source, safe='')}/{quote(str(listing_id), safe='')}/history")

    @overload
    def demo(self) -> DemoSamples: ...
    @overload
    def demo(self, source: str, city: str, type: Optional[str] = None) -> DemoResponse: ...

    def demo(self, source: Optional[str] = None, city: Optional[str] = None, type: Optional[str] = None) -> Union[DemoSamples, DemoResponse]:
        """Stored real listings of a sample city. No key, no credits, never starts a portal search.

        Without arguments it returns the list of samples (`{"samples": [{"source", "city", "type"}, ...]}`).
        With `source` and `city` of one sample it returns up to five listings. 30 sample calls an hour per network."""
        return self._request("GET", "/v1/demo", params={"source": source, "city": city, "type": type}, auth=False)

    # account

    def account(self) -> Account:
        """Email, plan, credit balance and the keys of the account (first characters only)."""
        return self._request("GET", "/v1/account")

    def usage(self, limit: int = 50) -> UsageResponse:
        """Credits used in this period and the most recent requests (`limit` 1 to 500)."""
        return self._request("GET", "/v1/usage", params={"limit": limit})

    def signup(self, email: str) -> SignupResponse:
        """Create a free key for an email address. The key is in `api_key` and is shown once. 409 if the email has one."""
        return self._request("POST", "/v1/signup", body={"email": email}, auth=False)

    # monitors

    def create_monitor(self, source: str, location: str, *, type: Optional[str] = None, min_price: Optional[int] = None,
                       max_price: Optional[int] = None, min_beds: Optional[int] = None, limit: Optional[int] = None,
                       webhook_url: Optional[str] = None, email: Optional[str] = None) -> MonitorCreated:
        """Save a search that is checked once a day for new, removed and price-changed listings.

        limit: listings read per check, 1 to 500 (server default 50). Each check costs 1 credit per listing read,
            except on the Feed plan.
        webhook_url: a public http(s) address that gets the report by POST when something changed."""
        filters = _drop_none({"type": type, "minPrice": min_price, "maxPrice": max_price, "minBeds": min_beds, "limit": limit})
        body = _drop_none({"source": source, "location": location, "filters": filters, "webhook_url": webhook_url, "email": email})
        return self._request("POST", "/v1/monitors", body=body)

    def monitors(self) -> MonitorsResponse:
        """Your monitors with their last report, and how many your plan holds (`slots`)."""
        return self._request("GET", "/v1/monitors")

    def monitor_changes(self, monitor_id: int) -> MonitorChangesResponse:
        """New, removed and price-changed listings from the last check of one monitor."""
        return self._request("GET", f"/v1/monitors/{int(monitor_id)}/changes")

    def delete_monitor(self, monitor_id: int) -> MonitorDeleted:
        """Delete a monitor and free its slot."""
        return self._request("DELETE", f"/v1/monitors/{int(monitor_id)}")
