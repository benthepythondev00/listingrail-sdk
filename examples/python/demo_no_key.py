"""No key needed: list the sample cities and print the stored listings of one of them.

    python demo_no_key.py                       # the first sample
    python demo_no_key.py rightmove London rent
"""
import sys

from listingrail import Listingrail

client = Listingrail()
samples = client.demo()["samples"]
print(f"{len(samples)} samples, for example:", ", ".join(f"{s['source']}/{s['city']}/{s['type']}" for s in samples[:5]))

if len(sys.argv) >= 3:
    source, city, kind = sys.argv[1], sys.argv[2], (sys.argv[3] if len(sys.argv) > 3 else None)
else:
    source, city, kind = samples[0]["source"], samples[0]["city"], samples[0]["type"]

demo = client.demo(source, city, kind)
print(f"\n{demo['source']} {demo['location']} ({demo['type']}), stored on {demo['snapshot_date']}:")
for home in demo["listings"]:
    period = f" per {home['price_period']}" if home.get("price_period") else ""
    print(f"  {home.get('price')} {home.get('currency')}{period} | {home.get('beds')} beds | {home.get('address') or home.get('title')}")
    print(f"    {home['url']}")
