# Examples

Each script reads the key from the `LISTINGRAIL_API_KEY` environment variable. The demo script needs no key.

| Script | What it does | Credits |
|--------|--------------|---------|
| `demo_no_key` | Lists the sample cities and prints the stored listings of one | 0, no key |
| `search_to_csv` | Searches one portal and writes the listings to a CSV file | 1 per listing |
| `monitor_price_cuts` | Creates a daily monitor, receives its webhook reports, prints new listings and price cuts | 1 per listing read at each daily check (none on Feed) |
| `compare_portals` | Median, lowest and highest asking price by bedrooms on two portals | 1 per listing |

Python:

```bash
pip install ./python             # from this repository
python examples/python/demo_no_key.py
export LISTINGRAIL_API_KEY=re_your_key
python examples/python/search_to_csv.py rightmove Manchester rent 20 listings.csv
```

JavaScript (Node 18 or newer). `examples/js/package.json` installs the client from the `js/` folder of this repository:

```bash
cd examples/js && npm install
node demo_no_key.mjs
export LISTINGRAIL_API_KEY=re_your_key
node search_to_csv.mjs rightmove Manchester rent 20 listings.csv
```

A webhook address must be a public http(s) address. A report is sent only when something changed, and never for the first check of a monitor.
