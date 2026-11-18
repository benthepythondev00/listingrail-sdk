// Daily new listings and price cuts with a monitor and a webhook.
//
// A monitor stores a search and is checked once a day. Each check costs 1 credit per listing read (none on the
// Feed plan). When something changed, the report is POSTed to the webhook address.
//
//   export LISTINGRAIL_API_KEY=re_your_key
//
//   # 1. Receive reports: run this on a machine the internet can reach (or behind a tunnel)
//   node monitor_price_cuts.mjs serve 8000
//
//   # 2. Create the monitor once, with the public address of that receiver
//   node monitor_price_cuts.mjs create rightmove Manchester rent https://you.example/hooks/listings
//
//   # 3. Or read the last report yourself, without a webhook
//   node monitor_price_cuts.mjs report
//
//   # Free the monitor slot again
//   node monitor_price_cuts.mjs delete 7
import { createServer } from "node:http";

import Listingrail, { ListingrailError } from "listingrail";

// Print the new listings and the price cuts of one report (a webhook body or `changes` of a monitor).
function printReport(report) {
  if (report.note) return console.log(report.note); // { note: "Not checked yet." }
  console.log(`Checked at ${report.checked_at}: ${report.new_count} new, ${report.removed_count} removed, ${report.price_changed_count} price changes`);
  if (report.first_check) return console.log("First check: it records what is listed; changes are reported from the next check on.");
  for (const home of report.new ?? []) {
    console.log(`  NEW  ${home.price} ${home.currency ?? ""} | ${home.beds} beds | ${home.address} | ${home.url}`);
  }
  for (const home of report.price_changed ?? []) {
    const { old_price: old, new_price: now } = home;
    if (old && now && now < old) {
      console.log(`  CUT  ${old} -> ${now} (${(((now - old) / old) * 100).toFixed(1)}%) | ${home.address} | ${home.url}`);
    }
  }
}

const [command = "report", ...args] = process.argv.slice(2);

if (command === "serve") {
  const port = Number(args[0] ?? 8000);
  createServer((req, res) => {
    if (req.method !== "POST") return res.writeHead(405).end();
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try {
        const report = JSON.parse(body);
        console.log(`Report of monitor ${report.monitor_id}:`);
        printReport(report);
        res.writeHead(200).end();
      } catch {
        res.writeHead(400).end();
      }
    });
  }).listen(port, () => console.log(`Waiting for reports on port ${port}`));
} else {
  const client = new Listingrail(); // reads LISTINGRAIL_API_KEY
  try {
    if (command === "create") {
      const [source, location, type, webhookUrl] = args;
      const made = await client.createMonitor({ source, location, type, limit: 50, webhookUrl });
      console.log(`Monitor ${made.id} created. ${made.note}`);
    } else if (command === "delete") {
      console.log(await client.deleteMonitor(Number(args[0])));
    } else {
      const answer = await client.monitors();
      console.log(`${answer.monitors.length} of ${answer.slots} monitor slots used`);
      for (const monitor of answer.monitors) {
        console.log(`\nMonitor ${monitor.id}: ${monitor.source} ${monitor.location} ${JSON.stringify(monitor.filters)}`);
        printReport((await client.monitorChanges(monitor.id)).changes);
      }
    }
  } catch (err) {
    if (!(err instanceof ListingrailError)) throw err;
    console.error(err.status ? `HTTP ${err.status}: ${err.message}` : err.message);
    process.exit(1);
  }
}
