"""Search one portal and write the listings to a CSV file. Costs 1 credit per listing returned.

    export LISTINGRAIL_API_KEY=re_your_key
    python search_to_csv.py rightmove Manchester rent 20 listings.csv
"""
import csv
import sys

from listingrail import InsufficientCreditsError, Listingrail, ListingrailError

COLUMNS = ["id", "source", "url", "title", "address", "city", "region", "postal_code", "country", "lat", "lng", "price", "currency",
           "price_period", "beds", "rooms", "baths", "area", "area_unit", "property_type", "listed_at"]

source = sys.argv[1] if len(sys.argv) > 1 else "rightmove"
location = sys.argv[2] if len(sys.argv) > 2 else "Manchester"
kind = sys.argv[3] if len(sys.argv) > 3 else "rent"
limit = int(sys.argv[4]) if len(sys.argv) > 4 else 20
path = sys.argv[5] if len(sys.argv) > 5 else "listings.csv"

client = Listingrail()  # reads LISTINGRAIL_API_KEY
try:
    result = client.search(source, location, type=kind, limit=limit)
except InsufficientCreditsError as err:
    sys.exit(f"{err.message}\n{err.buy_url or err.upgrade_url}")
except ListingrailError as err:
    sys.exit(str(err))

with open(path, "w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerow(COLUMNS + ["agent_name", "agent_company", "agent_phone", "first_photo"])
    for home in result["listings"]:
        agent = home.get("agent") or {}
        photos = home.get("photos") or []
        writer.writerow([home.get(c) for c in COLUMNS] + [agent.get("name"), agent.get("company"), agent.get("phone"), photos[0] if photos else None])

print(f"{result['count']} listings written to {path}. Credits used: {result.get('credits_used')}, left: {result.get('credits_remaining')}")
if result.get("notice"):
    print(result["notice"])
