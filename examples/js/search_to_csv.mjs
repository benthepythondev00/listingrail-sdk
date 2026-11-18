// Search one portal and write the listings to a CSV file. Costs 1 credit per listing returned.
//
//   export LISTINGRAIL_API_KEY=re_your_key
//   node search_to_csv.mjs rightmove Manchester rent 20 listings.csv
import { writeFileSync } from "node:fs";

import Listingrail, { InsufficientCreditsError, ListingrailError } from "listingrail";

const COLUMNS = ["id", "source", "url", "title", "address", "city", "region", "postal_code", "country", "lat", "lng", "price", "currency",
  "price_period", "beds", "rooms", "baths", "area", "area_unit", "property_type", "listed_at"];
const [source = "rightmove", location = "Manchester", type = "rent", limit = "20", path = "listings.csv"] = process.argv.slice(2);

const cell = (value) => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const client = new Listingrail(); // reads LISTINGRAIL_API_KEY
let result;
try {
  result = await client.search({ source, location, type, limit: Number(limit) });
} catch (err) {
  if (err instanceof InsufficientCreditsError) console.error(`${err.message}\n${err.buyUrl ?? err.upgradeUrl}`);
  else if (err instanceof ListingrailError) console.error(`HTTP ${err.status}: ${err.message}`);
  else throw err;
  process.exit(1);
}

const rows = [[...COLUMNS, "agent_name", "agent_company", "agent_phone", "first_photo"]];
for (const home of result.listings) {
  rows.push([...COLUMNS.map((c) => home[c]), home.agent?.name, home.agent?.company, home.agent?.phone, home.photos?.[0]]);
}
writeFileSync(path, rows.map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n");

console.log(`${result.count} listings written to ${path}. Credits used: ${result.credits_used}, left: ${result.credits_remaining}`);
if (result.notice) console.log(result.notice);
