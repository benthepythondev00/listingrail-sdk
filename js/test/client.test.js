// Unit tests against a stubbed fetch: no network.
import assert from "node:assert/strict";
import { test } from "node:test";

import Listingrail, * as lr from "../index.js";

const KEY = "re_test_key"; // not a real key
const PACK = "https://buy.stripe.com/6oUbJ33Xm8c96Gy3Ec9AA05?prefilled_email=you%40example.com";
const LISTING = { // a real Rightmove listing as GET /v1/demo returned it
  id: "94455012", url: "https://www.rightmove.co.uk/properties/94455012", source: "rightmove",
  title: "3 bedroom terraced house", address: "Martins Walk London SE28", city: null, region: null, postal_code: null,
  country: "GB", lat: 51.50131, lng: 0.08925, price: 2050, currency: "GBP", price_period: "month", beds: 3, rooms: null,
  baths: 1, area: null, area_unit: null, property_type: "Terraced", listed_at: "2026-10-19T11:28:36Z",
  photos: ["https://media.rightmove.co.uk/property-photo/604aa0ebd/94455012/604aa0ebd3fc5019b621fb4810fb378d.jpeg"],
  agent: { company: "John Payne" },
};

function stub(status = 200, body = {}, raw) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, method: init.method, headers: init.headers, body: init.body ? JSON.parse(init.body) : undefined, signal: init.signal });
    return new Response(raw ?? JSON.stringify(body), { status });
  };
  return { calls, fetch, get last() { return calls.at(-1); } };
}

const client = (s, apiKey = KEY) => new Listingrail({ apiKey, fetch: s.fetch });

test("search sends the documented body and the bearer key", async () => {
  const s = stub(200, { source: "rightmove", location: "London", type: "rent", count: 1, credits_used: 1, credits_remaining: 249, listings: [LISTING] });
  const out = await client(s).search({ source: "rightmove", location: "London", type: "rent", maxPrice: 3000, limit: 1 });
  assert.equal(s.last.method, "POST");
  assert.equal(s.last.url, "https://listingrail.com/v1/listings/search");
  assert.deepEqual(s.last.body, { source: "rightmove", location: "London", type: "rent", maxPrice: 3000, limit: 1 });
  assert.equal(s.last.headers.Authorization, `Bearer ${KEY}`);
  assert.match(s.last.headers["User-Agent"], /^listingrail-js\//);
  assert.ok(s.last.signal instanceof AbortSignal);
  assert.equal(out.credits_used, 1);
  assert.equal(out.credits_remaining, 249);
  assert.equal(out.listings[0].price, 2050);
  assert.equal(out.listings[0].agent.company, "John Payne");
});

test("low-balance fields are passed through", async () => {
  const s = stub(200, { source: "zumper", location: "Austin, TX", type: "rent", count: 0, credits_used: 0, credits_remaining: 3,
    upgrade_url: "https://listingrail.com/#fares", buy_url: PACK, notice: "3 credits left.", listings: [] });
  const out = await client(s).search({ source: "zumper", location: "Austin, TX" });
  assert.deepEqual(s.last.body, { source: "zumper", location: "Austin, TX", limit: 20 });
  assert.equal(out.notice, "3 credits left.");
  assert.equal(out.buy_url, PACK);
});

test("details", async () => {
  const s = stub(200, { source: "craigslist", count: 1, credits_used: 1, credits_remaining: 9, listings: [LISTING], url: "https://sfbay.craigslist.org/x/1.html", listing: LISTING });
  const out = await client(s).details({ source: "craigslist", url: "https://sfbay.craigslist.org/x/1.html" });
  assert.equal(s.last.url, "https://listingrail.com/v1/listings/details");
  assert.deepEqual(s.last.body, { source: "craigslist", url: "https://sfbay.craigslist.org/x/1.html" });
  assert.equal(out.listing.id, "94455012");
});

test("history encodes an id that is a link", async () => {
  const s = stub(200, { source: "idealista", id: "111379612", type: "sale", price_changes: [] });
  const c = client(s);
  assert.deepEqual((await c.history("idealista", "111379612")).price_changes, []);
  assert.equal(s.last.method, "GET");
  assert.equal(s.last.url, "https://listingrail.com/v1/listings/idealista/111379612/history");
  await c.history("craigslist", "https://x.example/a b?c=1");
  assert.equal(s.last.url, "https://listingrail.com/v1/listings/craigslist/https%3A%2F%2Fx.example%2Fa%20b%3Fc%3D1/history");
});

test("sources, demo and signup send no key", async () => {
  const s = stub(200, { sources: [] });
  const c = client(s);
  await c.sources();
  assert.equal(s.last.url, "https://listingrail.com/v1/sources");
  assert.equal(s.last.headers.Authorization, undefined);
  await c.demo();
  assert.equal(s.last.url, "https://listingrail.com/v1/demo");
  assert.equal(s.last.headers.Authorization, undefined);
  await c.demo({ source: "otodom", city: "Kraków", type: "rent" });
  assert.equal(s.last.url, "https://listingrail.com/v1/demo?source=otodom&city=Krak%C3%B3w&type=rent");
  await c.signup("you@example.com");
  assert.equal(s.last.method, "POST");
  assert.deepEqual(s.last.body, { email: "you@example.com" });
  assert.equal(s.last.headers.Authorization, undefined);
});

test("keyless calls work without a key and keyed calls refuse", async () => {
  const saved = process.env.LISTINGRAIL_API_KEY;
  delete process.env.LISTINGRAIL_API_KEY;
  try {
    const s = stub(200, { samples: [] });
    const c = new Listingrail({ fetch: s.fetch });
    assert.equal(c.hasApiKey, false);
    assert.deepEqual(await c.demo(), { samples: [] });
    await assert.rejects(c.account(), lr.AuthenticationError);
    assert.equal(s.calls.length, 1); // the keyed call was never sent
  } finally {
    if (saved !== undefined) process.env.LISTINGRAIL_API_KEY = saved;
  }
});

test("key from the environment, and not visible on the object", async () => {
  const saved = process.env.LISTINGRAIL_API_KEY;
  process.env.LISTINGRAIL_API_KEY = "re_from_env";
  try {
    const s = stub(200, { email: "you@example.com", plan: "free", credits_remaining: 250 });
    const c = new Listingrail({ fetch: s.fetch });
    assert.equal((await c.account()).plan, "free");
    assert.equal(s.last.headers.Authorization, "Bearer re_from_env");
    assert.ok(!JSON.stringify(c).includes("re_from_env"));
    assert.ok(!Object.values(c).includes("re_from_env"));
  } finally {
    if (saved === undefined) delete process.env.LISTINGRAIL_API_KEY; else process.env.LISTINGRAIL_API_KEY = saved;
  }
});

test("account and usage", async () => {
  const s = stub(200, { plan: "free", credits_remaining: 250, credits_used_this_period: 0, recent: [] });
  const c = client(s);
  await c.usage({ limit: 5 });
  assert.equal(s.last.url, "https://listingrail.com/v1/usage?limit=5");
  await c.usage();
  assert.equal(s.last.url, "https://listingrail.com/v1/usage?limit=50");
  await c.account();
  assert.equal(s.last.url, "https://listingrail.com/v1/account");
});

test("monitors", async () => {
  const s = stub(200, { id: 7, source: "zumper", location: "Austin, TX", filters: { type: "rent", maxPrice: 2000, limit: 50 }, note: "Checked by the scheduler; each check uses 1 credit per listing read." });
  const c = client(s);
  const made = await c.createMonitor({ source: "zumper", location: "Austin, TX", type: "rent", maxPrice: 2000, limit: 50, webhookUrl: "https://you.example/hooks/listings" });
  assert.equal(made.id, 7);
  assert.equal(s.last.method, "POST");
  assert.equal(s.last.url, "https://listingrail.com/v1/monitors");
  assert.deepEqual(s.last.body, { source: "zumper", location: "Austin, TX", filters: { type: "rent", maxPrice: 2000, limit: 50 }, webhook_url: "https://you.example/hooks/listings" });
  await c.createMonitor({ source: "daft", location: "dublin-city" });
  assert.deepEqual(s.last.body, { source: "daft", location: "dublin-city", filters: {} });
  await c.monitors();
  assert.equal(s.last.method, "GET");
  assert.equal(s.last.url, "https://listingrail.com/v1/monitors");
  await c.monitorChanges(7);
  assert.equal(s.last.url, "https://listingrail.com/v1/monitors/7/changes");
  await c.deleteMonitor(7);
  assert.equal(s.last.method, "DELETE");
  assert.equal(s.last.url, "https://listingrail.com/v1/monitors/7");
});

test("base url is configurable", async () => {
  const s = stub(200, { sources: [] });
  await new Listingrail({ apiKey: KEY, baseUrl: "http://localhost:8000/", fetch: s.fetch }).sources();
  assert.equal(s.last.url, "http://localhost:8000/v1/sources");
});

const CASES = [
  [400, "Unknown source 'nope'. See GET /v1/sources.", lr.BadRequestError, undefined, "Unknown source 'nope'. See GET /v1/sources."],
  [400, { error: "unknown_location", message: "The source knows no such place.", credits_used: 0 }, lr.UnknownLocationError, "unknown_location", "The source knows no such place."],
  [401, "Invalid API key.", lr.AuthenticationError, undefined, "Invalid API key."],
  [403, { error: "paid_plan_required", upgrade_url: "https://listingrail.com/#fares", message: "Price history is part of every paid plan, from Starter at $29 a month." },
    lr.PermissionDeniedError, "paid_plan_required", "Price history is part of every paid plan, from Starter at $29 a month."],
  [403, "Your free plan holds 1 monitors. Delete one or upgrade.", lr.PermissionDeniedError, undefined, "Your free plan holds 1 monitors. Delete one or upgrade."],
  [404, "No such monitor.", lr.NotFoundError, undefined, "No such monitor."],
  [409, "This email already has an account. Use its existing key.", lr.ConflictError, undefined, "This email already has an account. Use its existing key."],
  [429, "Rate limit: 5 requests per second per key.", lr.RateLimitError, undefined, "Rate limit: 5 requests per second per key."],
  [502, { error: "source_failed", message: "The portal did not answer.", credits_used: 0 }, lr.SourceFailedError, "source_failed", "The portal did not answer."],
  [503, "Could not update credits, please retry.", lr.ListingrailError, undefined, "Could not update credits, please retry."],
];

for (const [status, detail, Cls, code, message] of CASES) {
  test(`${status} ${code ?? "text"} becomes ${Cls.name} with the server's message`, async () => {
    await assert.rejects(client(stub(status, { detail })).search({ source: "rightmove", location: "London" }), (err) => {
      assert.equal(err.constructor, Cls);
      assert.ok(err instanceof lr.ListingrailError && err instanceof Error);
      assert.equal(err.name, Cls.name);
      assert.equal(err.status, status);
      assert.equal(err.code, code);
      assert.equal(err.message, message);
      assert.deepEqual(err.detail, detail);
      return true;
    });
  });
}

test("unknown location is also a bad request", () => {
  assert.ok(new lr.UnknownLocationError("x") instanceof lr.BadRequestError);
});

test("402 carries buyUrl and plans", async () => {
  const detail = { error: "insufficient_credits", credits_remaining: 0, upgrade_url: "https://listingrail.com/#fares", buy_url: PACK,
    plans: [{ name: "Pack", credits: 2500, usd: 9, billing: "once", buy_url: PACK }],
    message: "No credits left. Open buy_url to buy the 2,500-credit pack for $9; the checkout is filled with this key's email and credits land on it within a minute." };
  await assert.rejects(client(stub(402, { detail })).search({ source: "rightmove", location: "London" }), (err) => {
    assert.ok(err instanceof lr.InsufficientCreditsError);
    assert.equal(err.buyUrl, PACK);
    assert.equal(err.upgradeUrl, "https://listingrail.com/#fares");
    assert.equal(err.creditsRemaining, 0);
    assert.equal(err.plans[0].name, "Pack");
    assert.equal(err.code, "insufficient_credits");
    assert.match(err.message, /^No credits left\./);
    return true;
  });
});

test("402 through a marketplace has no buyUrl", async () => {
  const detail = { error: "insufficient_credits", credits_remaining: 0, upgrade_url: "https://listingrail.com/#fares", plans: [], message: "No credits left." };
  await assert.rejects(client(stub(402, { detail })).search({ source: "rightmove", location: "London" }), (err) => err.buyUrl === undefined && err.plans.length === 0);
});

test("422 names the field", async () => {
  const detail = [{ type: "less_than_equal", loc: ["body", "limit"], msg: "Input should be less than or equal to 500", input: 900 }];
  await assert.rejects(client(stub(422, { detail })).search({ source: "rightmove", location: "London", limit: 900 }), (err) => {
    assert.ok(err instanceof lr.ValidationError);
    assert.equal(err.message, "body.limit: Input should be less than or equal to 500");
    assert.deepEqual(err.detail, detail);
    return true;
  });
});

test("an error page that is not JSON", async () => {
  await assert.rejects(client(stub(502, null, "<html>Bad Gateway</html>")).search({ source: "rightmove", location: "London" }),
    (err) => err instanceof lr.SourceFailedError && err.status === 502 && err.message.includes("Bad Gateway"));
  await assert.rejects(client(stub(200, null, "<html>ok</html>")).sources(), lr.ListingrailError);
});

test("a network failure becomes APIConnectionError", async () => {
  const down = async () => { throw new TypeError("fetch failed"); };
  await assert.rejects(new Listingrail({ apiKey: KEY, fetch: down }).sources(),
    (err) => err instanceof lr.APIConnectionError && err.status === undefined && err.message.includes("fetch failed") && err.cause instanceof TypeError);
});
