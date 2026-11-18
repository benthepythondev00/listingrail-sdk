// Live test without a key: only /v1/sources and /v1/demo, which use no credits. Run with LISTINGRAIL_LIVE=1.
import assert from "node:assert/strict";
import { test } from "node:test";

import Listingrail from "../index.js";

test("sources and demo without a key", { skip: !process.env.LISTINGRAIL_LIVE && "set LISTINGRAIL_LIVE=1 to call the real API" }, async () => {
  delete process.env.LISTINGRAIL_API_KEY;
  const client = new Listingrail();
  assert.equal(client.hasApiKey, false);

  const { sources } = await client.sources();
  const keys = new Set(sources.map((s) => s.source));
  for (const key of ["zillow", "rightmove", "idealista"]) assert.ok(keys.has(key));
  for (const s of sources) {
    assert.ok(s.countries.length > 0);
    assert.ok(s.kinds.every((k) => k === "sale" || k === "rent"));
    assert.ok(Array.isArray(s.filters));
    assert.equal(typeof s.location, "string");
    assert.equal(typeof s.details, "boolean");
  }

  const { samples } = await client.demo();
  assert.ok(samples.length > 0 && samples.every((s) => keys.has(s.source)));
  const first = samples[0];
  const demo = await client.demo({ source: first.source, city: first.city, type: first.type });
  assert.equal(demo.demo, true);
  assert.equal(demo.source, first.source);
  assert.equal(demo.count, demo.listings.length);
  assert.ok(demo.count >= 1 && demo.count <= 5);
  for (const listing of demo.listings) {
    assert.ok(listing.id && listing.url.startsWith("http"));
    assert.equal(listing.source, first.source);
    assert.ok(Array.isArray(listing.photos));
    assert.equal(typeof listing.agent, "object");
    assert.equal("raw" in listing, false); // demo listings come without the portal's own record
  }
});
