"""Compare asking prices for one place across two portals. Costs 1 credit per listing returned (2 x limit at most).

Pick two portals of one country, so the prices are in one currency.

    export LISTINGRAIL_API_KEY=re_your_key
    python compare_portals.py rightmove zoopla Manchester rent 25
"""
import statistics
import sys

from listingrail import Listingrail, ListingrailError

first = sys.argv[1] if len(sys.argv) > 1 else "rightmove"
second = sys.argv[2] if len(sys.argv) > 2 else "zoopla"
location = sys.argv[3] if len(sys.argv) > 3 else "Manchester"
kind = sys.argv[4] if len(sys.argv) > 4 else "rent"
limit = int(sys.argv[5]) if len(sys.argv) > 5 else 25

client = Listingrail()  # reads LISTINGRAIL_API_KEY
print(f"{kind} in {location}, up to {limit} listings per portal\n")
print(f"{'portal':<14}{'beds':<6}{'count':>6}{'median':>12}{'lowest':>12}{'highest':>12}  currency")
for source in (first, second):
    try:
        result = client.search(source, location, type=kind, limit=limit)
    except ListingrailError as err:
        print(f"{source:<14}{err}")
        continue
    by_beds: dict = {}
    for home in result["listings"]:
        if home.get("price"):
            by_beds.setdefault(home.get("beds"), []).append(home["price"])
    currency = next((h["currency"] for h in result["listings"] if h.get("currency")), "")
    everything = [p for prices in by_beds.values() for p in prices]
    rows = sorted(by_beds.items(), key=lambda kv: (kv[0] is None, kv[0] or 0)) + ([("all", everything)] if everything else [])
    for beds, prices in rows:
        label = "?" if beds is None else str(beds)
        print(f"{source:<14}{label:<6}{len(prices):>6}{statistics.median(prices):>12,.0f}{min(prices):>12,.0f}{max(prices):>12,.0f}  {currency}")
    print(f"{'':<14}credits used: {result.get('credits_used')}, left: {result.get('credits_remaining')}\n")
