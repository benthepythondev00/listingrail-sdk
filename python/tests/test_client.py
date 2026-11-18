"""Unit tests against a stubbed transport: no network."""
import json

import pytest

import listingrail
from listingrail import Listingrail

KEY = "re_test_key"  # not a real key

LISTING = {  # a real Rightmove listing as GET /v1/demo returned it
    "id": "94455012", "url": "https://www.rightmove.co.uk/properties/94455012", "source": "rightmove",
    "title": "3 bedroom terraced house", "address": "Martins Walk London SE28", "city": None, "region": None,
    "postal_code": None, "country": "GB", "lat": 51.50131, "lng": 0.08925, "price": 2050, "currency": "GBP",
    "price_period": "month", "beds": 3, "rooms": None, "baths": 1, "area": None, "area_unit": None,
    "property_type": "Terraced", "listed_at": "2026-10-19T11:28:36Z",
    "photos": ["https://media.rightmove.co.uk/property-photo/604aa0ebd/94455012/604aa0ebd3fc5019b621fb4810fb378d.jpeg"],
    "agent": {"company": "John Payne"},
}
PACK = "https://buy.stripe.com/6oUbJ33Xm8c96Gy3Ec9AA05?prefilled_email=you%40example.com"


class Stub:
    def __init__(self, status=200, body=None, raw=None):
        self.status, self.body, self.raw, self.calls = status, body, raw, []

    def __call__(self, method, url, headers, body, timeout):
        self.calls.append({"method": method, "url": url, "headers": headers, "body": json.loads(body) if body else None, "timeout": timeout})
        return self.status, self.raw if self.raw is not None else json.dumps(self.body).encode()

    @property
    def last(self):
        return self.calls[-1]


def client(stub, key=KEY):
    return Listingrail(key, transport=stub)


def test_search_sends_the_documented_body_and_bearer_key():
    stub = Stub(body={"source": "rightmove", "location": "London", "type": "rent", "count": 1, "credits_used": 1,
                      "credits_remaining": 249, "listings": [LISTING]})
    out = client(stub).search("rightmove", "London", type="rent", max_price=3000, limit=1)
    assert stub.last["method"] == "POST"
    assert stub.last["url"] == "https://listingrail.com/v1/listings/search"
    assert stub.last["body"] == {"source": "rightmove", "location": "London", "type": "rent", "maxPrice": 3000, "limit": 1}
    assert stub.last["headers"]["Authorization"] == "Bearer " + KEY
    assert stub.last["headers"]["User-Agent"].startswith("listingrail-python/")
    assert stub.last["timeout"] == 180.0
    assert out["credits_used"] == 1 and out["credits_remaining"] == 249
    assert out["listings"][0]["price"] == 2050 and out["listings"][0]["agent"]["company"] == "John Payne"


def test_low_balance_fields_are_passed_through():
    stub = Stub(body={"source": "zumper", "location": "Austin, TX", "type": "rent", "count": 0, "credits_used": 0, "credits_remaining": 3,
                      "upgrade_url": "https://listingrail.com/#fares", "buy_url": PACK, "notice": "3 credits left.", "listings": []})
    out = client(stub).search("zumper", "Austin, TX")
    assert stub.last["body"] == {"source": "zumper", "location": "Austin, TX", "limit": 20}
    assert out["notice"] == "3 credits left." and out["buy_url"] == PACK and out["upgrade_url"].endswith("#fares")


def test_details():
    stub = Stub(body={"source": "craigslist", "count": 1, "credits_used": 1, "credits_remaining": 9, "listings": [LISTING],
                      "url": "https://sfbay.craigslist.org/x/1.html", "listing": LISTING})
    out = client(stub).details("craigslist", "https://sfbay.craigslist.org/x/1.html")
    assert stub.last["url"].endswith("/v1/listings/details")
    assert stub.last["body"] == {"source": "craigslist", "url": "https://sfbay.craigslist.org/x/1.html"}
    assert out["listing"]["id"] == "94455012"


def test_history_encodes_an_id_that_is_a_link():
    stub = Stub(body={"source": "idealista", "id": "111379612", "type": "sale", "price": 990000.0, "currency": "EUR",
                      "first_seen": "2026-11-13T19:02:47.113932", "last_seen": "2026-11-13T19:02:47.113932",
                      "history_since": "2026-11-13", "price_changes": []})
    c = client(stub)
    assert c.history("idealista", "111379612")["price_changes"] == []
    assert stub.last["method"] == "GET" and stub.last["url"] == "https://listingrail.com/v1/listings/idealista/111379612/history"
    c.history("craigslist", "https://x.example/a b?c=1")
    assert stub.last["url"] == "https://listingrail.com/v1/listings/craigslist/https%3A%2F%2Fx.example%2Fa%20b%3Fc%3D1/history"


def test_sources_demo_and_signup_send_no_key():
    stub = Stub(body={"sources": []})
    c = client(stub)
    c.sources()
    assert stub.last["url"].endswith("/v1/sources") and "Authorization" not in stub.last["headers"]
    c.demo()
    assert stub.last["url"] == "https://listingrail.com/v1/demo" and "Authorization" not in stub.last["headers"]
    c.demo("otodom", "Kraków", "rent")
    assert stub.last["url"] == "https://listingrail.com/v1/demo?source=otodom&city=Krak%C3%B3w&type=rent"
    c.signup("you@example.com")
    assert stub.last["method"] == "POST" and stub.last["body"] == {"email": "you@example.com"}
    assert "Authorization" not in stub.last["headers"]


def test_keyless_calls_work_without_a_key_and_keyed_calls_refuse(monkeypatch):
    monkeypatch.delenv("LISTINGRAIL_API_KEY", raising=False)
    stub = Stub(body={"samples": []})
    c = Listingrail(transport=stub)
    assert c.demo() == {"samples": []}
    with pytest.raises(listingrail.AuthenticationError):
        c.account()
    assert len(stub.calls) == 1  # the keyed call was never sent


def test_key_from_the_environment_and_not_in_repr(monkeypatch):
    monkeypatch.setenv("LISTINGRAIL_API_KEY", "re_from_env")
    stub = Stub(body={"email": "you@example.com", "plan": "free", "credits_remaining": 250})
    c = Listingrail(transport=stub)
    assert c.account()["plan"] == "free"
    assert stub.last["headers"]["Authorization"] == "Bearer re_from_env"
    assert "re_from_env" not in repr(c)


def test_account_and_usage():
    stub = Stub(body={"plan": "free", "credits_remaining": 250, "credits_used_this_period": 0, "recent": []})
    c = client(stub)
    c.usage(limit=5)
    assert stub.last["url"] == "https://listingrail.com/v1/usage?limit=5"
    c.account()
    assert stub.last["url"] == "https://listingrail.com/v1/account"


def test_monitors():
    stub = Stub(body={"id": 7, "source": "zumper", "location": "Austin, TX", "filters": {"type": "rent", "maxPrice": 2000, "limit": 50},
                      "note": "Checked by the scheduler; each check uses 1 credit per listing read."})
    c = client(stub)
    assert c.create_monitor("zumper", "Austin, TX", type="rent", max_price=2000, limit=50, webhook_url="https://you.example/hooks/listings")["id"] == 7
    assert stub.last["method"] == "POST" and stub.last["url"].endswith("/v1/monitors")
    assert stub.last["body"] == {"source": "zumper", "location": "Austin, TX", "filters": {"type": "rent", "maxPrice": 2000, "limit": 50},
                                 "webhook_url": "https://you.example/hooks/listings"}
    c.create_monitor("daft", "dublin-city")
    assert stub.last["body"] == {"source": "daft", "location": "dublin-city", "filters": {}}
    c.monitors()
    assert stub.last["method"] == "GET" and stub.last["url"].endswith("/v1/monitors")
    c.monitor_changes(7)
    assert stub.last["url"].endswith("/v1/monitors/7/changes")
    c.delete_monitor(7)
    assert stub.last["method"] == "DELETE" and stub.last["url"].endswith("/v1/monitors/7")


def test_base_url_is_configurable():
    stub = Stub(body={"sources": []})
    Listingrail(KEY, base_url="http://localhost:8000/", transport=stub).sources()
    assert stub.last["url"] == "http://localhost:8000/v1/sources"


@pytest.mark.parametrize("status, detail, cls, code, message", [
    (400, "Unknown source 'nope'. See GET /v1/sources.", listingrail.BadRequestError, None, "Unknown source 'nope'. See GET /v1/sources."),
    (400, {"error": "unknown_location", "message": "The source knows no such place.", "credits_used": 0},
     listingrail.UnknownLocationError, "unknown_location", "The source knows no such place."),
    (401, "Invalid API key.", listingrail.AuthenticationError, None, "Invalid API key."),
    (403, {"error": "paid_plan_required", "upgrade_url": "https://listingrail.com/#fares",
           "message": "Price history is part of every paid plan, from Starter at $29 a month."},
     listingrail.PermissionDeniedError, "paid_plan_required", "Price history is part of every paid plan, from Starter at $29 a month."),
    (403, "Your free plan holds 1 monitors. Delete one or upgrade.", listingrail.PermissionDeniedError, None,
     "Your free plan holds 1 monitors. Delete one or upgrade."),
    (404, "No such monitor.", listingrail.NotFoundError, None, "No such monitor."),
    (409, "This email already has an account. Use its existing key.", listingrail.ConflictError, None,
     "This email already has an account. Use its existing key."),
    (429, "Rate limit: 5 requests per second per key.", listingrail.RateLimitError, None, "Rate limit: 5 requests per second per key."),
    (502, {"error": "source_failed", "message": "The portal did not answer.", "credits_used": 0},
     listingrail.SourceFailedError, "source_failed", "The portal did not answer."),
    (503, "Could not update credits, please retry.", listingrail.ListingrailError, None, "Could not update credits, please retry."),
])
def test_errors_carry_the_servers_message(status, detail, cls, code, message):
    with pytest.raises(cls) as caught:
        client(Stub(status, {"detail": detail})).search("rightmove", "London")
    err = caught.value
    assert type(err) is cls and isinstance(err, listingrail.ListingrailError)
    assert (err.status, err.code, err.message, err.detail) == (status, code, message, detail)
    assert message in str(err)


def test_unknown_location_is_also_a_bad_request():
    assert issubclass(listingrail.UnknownLocationError, listingrail.BadRequestError)


def test_402_carries_buy_url_and_plans():
    detail = {"error": "insufficient_credits", "credits_remaining": 0, "upgrade_url": "https://listingrail.com/#fares", "buy_url": PACK,
              "plans": [{"name": "Pack", "credits": 2500, "usd": 9, "billing": "once", "buy_url": PACK}],
              "message": "No credits left. Open buy_url to buy the 2,500-credit pack for $9; the checkout is filled with this key's email and credits land on it within a minute."}
    with pytest.raises(listingrail.InsufficientCreditsError) as caught:
        client(Stub(402, {"detail": detail})).search("rightmove", "London")
    err = caught.value
    assert err.buy_url == PACK and err.upgrade_url == "https://listingrail.com/#fares"
    assert err.credits_remaining == 0 and err.plans[0]["name"] == "Pack" and err.code == "insufficient_credits"
    assert err.message.startswith("No credits left.")


def test_402_through_a_marketplace_has_no_buy_url():
    detail = {"error": "insufficient_credits", "credits_remaining": 0, "upgrade_url": "https://listingrail.com/#fares", "plans": [],
              "message": "No credits left."}
    with pytest.raises(listingrail.InsufficientCreditsError) as caught:
        client(Stub(402, {"detail": detail})).search("rightmove", "London")
    assert caught.value.buy_url is None


def test_422_names_the_field():
    detail = [{"type": "less_than_equal", "loc": ["body", "limit"], "msg": "Input should be less than or equal to 500", "input": 900}]
    with pytest.raises(listingrail.ValidationError) as caught:
        client(Stub(422, {"detail": detail})).search("rightmove", "London", limit=900)
    assert caught.value.message == "body.limit: Input should be less than or equal to 500"
    assert caught.value.detail == detail


def test_an_error_page_that_is_not_json():
    with pytest.raises(listingrail.SourceFailedError) as caught:
        client(Stub(502, raw=b"<html>Bad Gateway</html>")).search("rightmove", "London")
    assert caught.value.status == 502 and "Bad Gateway" in caught.value.message
    with pytest.raises(listingrail.ListingrailError):
        client(Stub(200, raw=b"<html>ok</html>")).sources()


def test_a_network_failure_becomes_api_connection_error():
    def down(method, url, headers, body, timeout):
        raise TimeoutError("timed out")
    with pytest.raises(listingrail.APIConnectionError) as caught:
        Listingrail(KEY, transport=down).sources()
    assert caught.value.status is None and "timed out" in str(caught.value)
