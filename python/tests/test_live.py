"""Live test without a key: only /v1/sources and /v1/demo, which use no credits. Run with LISTINGRAIL_LIVE=1."""
import os

import pytest

from listingrail import Listingrail

pytestmark = [pytest.mark.live, pytest.mark.skipif(not os.environ.get("LISTINGRAIL_LIVE"), reason="set LISTINGRAIL_LIVE=1 to call the real API")]


def test_sources_and_demo_without_a_key(monkeypatch):
    monkeypatch.delenv("LISTINGRAIL_API_KEY", raising=False)
    client = Listingrail()
    assert client.api_key is None

    sources = client.sources()["sources"]
    keys = {s["source"] for s in sources}
    assert {"zillow", "rightmove", "idealista"} <= keys
    for s in sources:
        assert s["countries"] and set(s["kinds"]) <= {"sale", "rent"} and isinstance(s["filters"], list)
        assert isinstance(s["location"], str) and isinstance(s["details"], bool)

    samples = client.demo()["samples"]
    assert samples and all(s["source"] in keys for s in samples)
    first = samples[0]
    demo = client.demo(first["source"], first["city"], first["type"])
    assert demo["demo"] is True and demo["source"] == first["source"]
    assert 1 <= demo["count"] == len(demo["listings"]) <= 5
    for listing in demo["listings"]:
        assert listing["id"] and listing["url"].startswith("http") and listing["source"] == first["source"]
        assert isinstance(listing["photos"], list) and isinstance(listing["agent"], dict)
        assert "raw" not in listing  # demo listings come without the portal's own record
