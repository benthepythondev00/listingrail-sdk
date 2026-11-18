// No key needed: list the sample cities and print the stored listings of one of them.
//
//   node demo_no_key.mjs                       # the first sample
//   node demo_no_key.mjs rightmove London rent
import Listingrail from "listingrail";

const client = new Listingrail();
const { samples } = await client.demo();
console.log(`${samples.length} samples, for example:`, samples.slice(0, 5).map((s) => `${s.source}/${s.city}/${s.type}`).join(", "));

const [source, city, type] = process.argv.length >= 4 ? process.argv.slice(2) : [samples[0].source, samples[0].city, samples[0].type];
const demo = await client.demo({ source, city, type });
console.log(`\n${demo.source} ${demo.location} (${demo.type}), stored on ${demo.snapshot_date}:`);
for (const home of demo.listings) {
  const period = home.price_period ? ` per ${home.price_period}` : "";
  console.log(`  ${home.price} ${home.currency}${period} | ${home.beds} beds | ${home.address ?? home.title}`);
  console.log(`    ${home.url}`);
}
