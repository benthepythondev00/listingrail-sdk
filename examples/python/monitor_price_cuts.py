"""Daily new listings and price cuts with a monitor and a webhook.

A monitor stores a search and is checked once a day. Each check costs 1 credit per listing read (none on the
Feed plan). When something changed, the report is POSTed to the webhook address.

    export LISTINGRAIL_API_KEY=re_your_key

    # 1. Receive reports: run this on a machine the internet can reach (or behind a tunnel)
    python monitor_price_cuts.py serve 8000

    # 2. Create the monitor once, with the public address of that receiver
    python monitor_price_cuts.py create rightmove Manchester rent https://you.example/hooks/listings

    # 3. Or read the last report yourself, without a webhook
    python monitor_price_cuts.py report

    # Free the monitor slot again
    python monitor_price_cuts.py delete 7
"""
import json
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer

from listingrail import Listingrail, ListingrailError


def print_report(report: dict) -> None:
    """Print the new listings and the price cuts of one report (a webhook body or `changes` of a monitor)."""
    if report.get("note"):  # {"note": "Not checked yet."}
        print(report["note"])
        return
    print(f"Checked at {report.get('checked_at')}: {report.get('new_count')} new, {report.get('removed_count')} removed, "
          f"{report.get('price_changed_count')} price changes")
    if report.get("first_check"):
        print("First check: it records what is listed; changes are reported from the next check on.")
        return
    for home in report.get("new") or []:
        print(f"  NEW  {home.get('price')} {home.get('currency', '')} | {home.get('beds')} beds | {home.get('address')} | {home.get('url')}")
    for home in report.get("price_changed") or []:
        old, new = home.get("old_price"), home.get("new_price")
        if old and new and new < old:
            print(f"  CUT  {old} -> {new} ({(new - old) / old:+.1%}) | {home.get('address')} | {home.get('url')}")


class Hook(BaseHTTPRequestHandler):
    def do_POST(self) -> None:
        body = self.rfile.read(int(self.headers.get("Content-Length") or 0))
        try:
            report = json.loads(body)
            print(f"Report of monitor {report.get('monitor_id')}:")
            print_report(report)
            self.send_response(200)
        except ValueError:
            self.send_response(400)
        self.end_headers()


def main() -> None:
    command = sys.argv[1] if len(sys.argv) > 1 else "report"
    if command == "serve":
        port = int(sys.argv[2]) if len(sys.argv) > 2 else 8000
        print(f"Waiting for reports on port {port}")
        HTTPServer(("", port), Hook).serve_forever()
    client = Listingrail()  # reads LISTINGRAIL_API_KEY
    try:
        if command == "create":
            source, location, kind, webhook = sys.argv[2], sys.argv[3], sys.argv[4], (sys.argv[5] if len(sys.argv) > 5 else None)
            made = client.create_monitor(source, location, type=kind, limit=50, webhook_url=webhook)
            print(f"Monitor {made['id']} created. {made['note']}")
        elif command == "delete":
            print(client.delete_monitor(int(sys.argv[2])))
        else:
            answer = client.monitors()
            print(f"{len(answer['monitors'])} of {answer['slots']} monitor slots used")
            for monitor in answer["monitors"]:
                print(f"\nMonitor {monitor['id']}: {monitor['source']} {monitor['location']} {monitor['filters']}")
                print_report(client.monitor_changes(monitor["id"])["changes"])
    except ListingrailError as err:
        sys.exit(str(err))


if __name__ == "__main__":
    main()
