// Compare asking prices for one place across two portals. Costs 1 credit per listing returned (2 x limit at most).
// Pick two portals of one country, so the prices are in one currency.
//
//   export LISTINGRAIL_API_KEY=re_your_key
//   node compare_portals.mjs rightmove zoopla Manchester rent 25
import Listingrail, { ListingrailError } from "listingrail";

const [first = "rightmove", second = "zoopla", location = "Manchester", type = "rent", limit = "25"] = process.argv.slice(2);

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const money = (n) => Math.round(n).toLocaleString("en-US").padStart(12);

const client = new Listingrail(); // reads LISTINGRAIL_API_KEY
console.log(`${type} in ${location}, up to ${limit} listings per portal\n`);
console.log(`${"portal".padEnd(14)}${"beds".padEnd(6)}${"count".padStart(6)}${"median".padStart(12)}${"lowest".padStart(12)}${"highest".padStart(12)}  currency`);
for (const source of [first, second]) {
  let result;
  try {
    result = await client.search({ source, location, type, limit: Number(limit) });
  } catch (err) {
    if (!(err instanceof ListingrailError)) throw err;
    console.log(`${source.padEnd(14)}${err.status ? `HTTP ${err.status}: ` : ""}${err.message}`);
    continue;
  }
  const byBeds = new Map();
  for (const home of result.listings) {
    if (!home.price) continue;
    const key = home.beds ?? "?";
    byBeds.set(key, [...(byBeds.get(key) ?? []), home.price]);
  }
  const currency = result.listings.find((h) => h.currency)?.currency ?? "";
  const rows = [...byBeds.entries()].sort(([a], [b]) => (a === "?") - (b === "?") || a - b);
  const all = rows.flatMap(([, prices]) => prices);
  if (all.length) rows.push(["all", all]);
  for (const [beds, prices] of rows) {
    console.log(`${source.padEnd(14)}${String(beds).padEnd(6)}${String(prices.length).padStart(6)}${money(median(prices))}${money(Math.min(...prices))}${money(Math.max(...prices))}  ${currency}`);
  }
  console.log(`${"".padEnd(14)}credits used: ${result.credits_used}, left: ${result.credits_remaining}\n`);
}
