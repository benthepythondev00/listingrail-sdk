"""Shapes of the API's answers, written from real responses and the server's models.

All of them are plain dicts at runtime; these TypedDicts are for editors and type checkers. Every key is optional
to the type checker (`total=False`) because the API leaves some out: demo listings carry no `raw`, keys issued
through a marketplace get no `credits_*`, and `notice`, `upgrade_url` and `buy_url` appear only on a low balance.
"""
from typing import Any, Dict, List, Optional, TypedDict


class Agent(TypedDict, total=False):
    """Agent, agency or property manager. Keys can be null or missing; all are empty for a private seller."""
    name: Optional[str]
    phone: Optional[str]
    company: Optional[str]


class Listing(TypedDict, total=False):
    id: str  # the portal's own listing id
    url: str
    source: str
    title: Optional[str]
    address: Optional[str]
    city: Optional[str]
    region: Optional[str]
    postal_code: Optional[str]
    country: str  # ISO 3166
    lat: Optional[float]
    lng: Optional[float]
    price: Optional[float]  # asking price, or the lowest rent of a building
    currency: str  # ISO 4217
    price_period: Optional[str]  # "month" for rentals
    beds: Optional[float]  # 0 is a studio
    rooms: Optional[float]  # where the portal counts rooms, not bedrooms
    baths: Optional[float]
    area: Optional[float]
    area_unit: Optional[str]  # "sqft" or "sqm"
    property_type: Optional[str]
    listed_at: Optional[str]
    photos: List[str]
    agent: Agent
    raw: Dict[str, Any]  # the portal's own record; not in demo answers or monitor reports


class _Credits(TypedDict, total=False):
    credits_used: int
    credits_remaining: int
    notice: str  # only below the low-balance line
    upgrade_url: str  # only below the low-balance line
    buy_url: str  # only below the low-balance line


class SearchResponse(_Credits, total=False):
    source: str
    location: str
    type: str
    count: int
    listings: List[Listing]


class DetailsResponse(_Credits, total=False):
    source: str
    url: str
    count: int
    listing: Optional[Listing]
    listings: List[Listing]


class Source(TypedDict, total=False):
    source: str
    countries: List[str]
    kinds: List[str]  # "sale", "rent"; the first is the default type
    filters: List[str]  # which of minPrice, maxPrice, minBeds the source takes
    location: str  # how to write the location for this source
    details: bool  # whether details() works for it
    credits_per_row: int


class SourcesResponse(TypedDict, total=False):
    sources: List[Source]


class PriceChange(TypedDict, total=False):
    old_price: float
    new_price: float
    seen_at: str


class HistoryResponse(TypedDict, total=False):
    source: str
    id: str
    type: str
    url: Optional[str]
    address: Optional[str]
    city: Optional[str]
    region: Optional[str]
    postal_code: Optional[str]
    country: Optional[str]
    lat: Optional[float]
    lng: Optional[float]
    price: Optional[float]
    currency: Optional[str]
    price_period: Optional[str]
    beds: Optional[float]
    rooms: Optional[float]
    baths: Optional[float]
    area: Optional[float]
    area_unit: Optional[str]
    property_type: Optional[str]
    listed_at: Optional[str]
    first_seen: str
    last_seen: str
    history_since: str
    price_changes: List[PriceChange]


class ApiKeyInfo(TypedDict, total=False):
    key: str  # the first 8 characters and "..."
    created_at: str
    last_used_at: Optional[str]


class Account(TypedDict, total=False):
    email: str
    plan: str
    credits_remaining: int
    credits_period_start: str
    api_keys: List[ApiKeyInfo]


class UsageEntry(TypedDict, total=False):
    endpoint: str
    source: Optional[str]
    credits: int
    status_code: int
    at: str


class UsageResponse(TypedDict, total=False):
    plan: str
    credits_remaining: int
    credits_used_this_period: int
    recent: List[UsageEntry]


class RemovedListing(TypedDict, total=False):
    id: Optional[str]
    url: Optional[str]
    title: Optional[str]
    address: Optional[str]
    postal_code: Optional[str]
    beds: Optional[float]
    price: Optional[float]


class PriceChangedListing(RemovedListing, total=False):
    old_price: Optional[float]
    new_price: Optional[float]


class MonitorChanges(TypedDict, total=False):
    """The report of a monitor's last check. Before the first check it is only {"note": "Not checked yet."}."""
    note: str
    monitor_id: int  # in the webhook payload only
    checked_at: str
    previous_check: Optional[str]
    first_check: bool
    credits_used: int
    listings_seen: int
    search_complete: bool
    new_count: int
    removed_count: int
    price_changed_count: int
    new: List[Listing]
    removed: List[RemovedListing]
    price_changed: List[PriceChangedListing]


class Monitor(TypedDict, total=False):
    id: int
    source: str
    location: str
    filters: Dict[str, Any]
    webhook_url: Optional[str]
    created_at: str
    last_checked_at: Optional[str]
    changes: Optional[MonitorChanges]


class MonitorsResponse(TypedDict, total=False):
    slots: int  # how many monitors the plan holds
    monitors: List[Monitor]


class MonitorCreated(TypedDict, total=False):
    id: int
    source: str
    location: str
    filters: Dict[str, Any]
    note: str


class MonitorChangesResponse(TypedDict, total=False):
    id: int
    last_checked_at: Optional[str]
    changes: MonitorChanges


class MonitorDeleted(TypedDict, total=False):
    deleted: int


class SignupResponse(TypedDict, total=False):
    email: str
    plan: str
    credits_remaining: int
    api_key: str  # shown once
    note: str


class DemoSample(TypedDict, total=False):
    source: str
    city: str
    type: str


class DemoSamples(TypedDict, total=False):
    samples: List[DemoSample]


class DemoResponse(TypedDict, total=False):
    source: str
    location: str
    type: str
    count: int
    snapshot_date: str
    demo: bool
    listings: List[Listing]
    get_key: str
