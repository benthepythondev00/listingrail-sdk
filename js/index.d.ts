// Types for the Listingrail client, written from real responses and the server's models.
// Fields the API can leave out are optional: demo listings carry no `raw`, keys issued through a marketplace
// get no `credits_*`, and `notice`, `upgrade_url` and `buy_url` appear only on a low balance.

export declare const VERSION: string;
export declare const DEFAULT_BASE_URL: string;
export declare const DEFAULT_TIMEOUT_MS: number;

export type ListingType = "rent" | "sale";

/** Agent, agency or property manager. Keys can be null or missing; all are empty for a private seller. */
export interface Agent {
  name?: string | null;
  phone?: string | null;
  company?: string | null;
}

export interface Listing {
  /** The portal's own listing id. */
  id: string;
  url: string;
  source: string;
  title: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  /** ISO 3166 code. */
  country: string;
  lat: number | null;
  lng: number | null;
  /** Asking price, or the lowest rent of a building. */
  price: number | null;
  /** ISO 4217 code. */
  currency: string;
  /** "month" for rentals. */
  price_period: string | null;
  /** 0 is a studio. */
  beds: number | null;
  /** Where the portal counts rooms, not bedrooms. */
  rooms: number | null;
  baths: number | null;
  area: number | null;
  area_unit: "sqft" | "sqm" | null;
  property_type: string | null;
  listed_at: string | null;
  photos: string[];
  agent: Agent;
  /** The portal's own record. Not in demo answers or monitor reports. */
  raw?: Record<string, unknown>;
}

export interface Credits {
  credits_used?: number;
  credits_remaining?: number;
  /** Only below the low-balance line. */
  notice?: string;
  /** Only below the low-balance line. */
  upgrade_url?: string;
  /** Only below the low-balance line. */
  buy_url?: string;
}

export interface SearchResponse extends Credits {
  source: string;
  location: string;
  type: ListingType;
  count: number;
  listings: Listing[];
}

export interface DetailsResponse extends Credits {
  source: string;
  url: string;
  count: number;
  listing: Listing | null;
  listings: Listing[];
}

export interface Source {
  source: string;
  countries: string[];
  /** The first is the default type. */
  kinds: ListingType[];
  /** Which of minPrice, maxPrice, minBeds the source takes. */
  filters: string[];
  /** How to write the location for this source. */
  location: string;
  /** Whether details() works for it. */
  details: boolean;
  credits_per_row: number;
}

export interface SourcesResponse {
  sources: Source[];
}

export interface PriceChange {
  old_price: number;
  new_price: number;
  seen_at: string;
}

export interface HistoryResponse {
  source: string;
  id: string;
  type: ListingType;
  url?: string | null;
  address?: string | null;
  city?: string | null;
  region?: string | null;
  postal_code?: string | null;
  country?: string | null;
  lat?: number | null;
  lng?: number | null;
  price?: number | null;
  currency?: string | null;
  price_period?: string | null;
  beds?: number | null;
  rooms?: number | null;
  baths?: number | null;
  area?: number | null;
  area_unit?: string | null;
  property_type?: string | null;
  listed_at?: string | null;
  first_seen: string;
  last_seen: string;
  history_since: string;
  price_changes: PriceChange[];
}

export interface Account {
  email: string;
  plan: string;
  credits_remaining: number;
  credits_period_start: string;
  /** `key` is the first 8 characters and "...". */
  api_keys: { key: string; created_at: string; last_used_at: string | null }[];
}

export interface UsageResponse {
  plan: string;
  credits_remaining: number;
  credits_used_this_period: number;
  recent: { endpoint: string; source: string | null; credits: number; status_code: number; at: string }[];
}

export interface RemovedListing {
  id: string | null;
  url: string | null;
  title: string | null;
  address: string | null;
  postal_code: string | null;
  beds: number | null;
  price: number | null;
}

export interface PriceChangedListing extends RemovedListing {
  old_price: number | null;
  new_price: number | null;
}

/** The report of a monitor's last check. Before the first check it is only `{ note: "Not checked yet." }`. */
export interface MonitorChanges {
  note?: string;
  /** In the webhook payload only. */
  monitor_id?: number;
  checked_at?: string;
  previous_check?: string | null;
  first_check?: boolean;
  credits_used?: number;
  listings_seen?: number;
  search_complete?: boolean;
  new_count?: number;
  removed_count?: number;
  price_changed_count?: number;
  new?: Listing[];
  removed?: RemovedListing[];
  price_changed?: PriceChangedListing[];
}

export interface Monitor {
  id: number;
  source: string;
  location: string;
  filters: Record<string, unknown>;
  webhook_url: string | null;
  created_at: string;
  last_checked_at: string | null;
  changes: MonitorChanges | null;
}

export interface MonitorsResponse {
  /** How many monitors the plan holds. */
  slots: number;
  monitors: Monitor[];
}

export interface MonitorCreated {
  id: number;
  source: string;
  location: string;
  filters: Record<string, unknown>;
  note: string;
}

export interface MonitorChangesResponse {
  id: number;
  last_checked_at: string | null;
  changes: MonitorChanges;
}

export interface SignupResponse {
  email: string;
  plan: string;
  credits_remaining: number;
  /** Shown once. */
  api_key: string;
  note: string;
}

export interface DemoSample {
  source: string;
  city: string;
  type: ListingType;
}

export interface DemoSamples {
  samples: DemoSample[];
}

export interface DemoResponse {
  source: string;
  location: string;
  type: ListingType;
  count: number;
  snapshot_date: string;
  demo: true;
  listings: Listing[];
  get_key: string;
}

export interface Plan {
  name: string;
  credits: number;
  usd: number;
  billing: string;
  monitors?: number;
  buy_url?: string;
}

export interface ListingrailOptions {
  /** Your key (`re_...`). Left out, LISTINGRAIL_API_KEY is read from the environment where there is one. */
  apiKey?: string;
  baseUrl?: string;
  /** Milliseconds to wait for an answer. Default 180000. */
  timeout?: number;
  /** A fetch function, for tests or a custom HTTP stack. Default: the global fetch. */
  fetch?: typeof fetch;
}

export interface SearchParams {
  source: string;
  location: string;
  type?: ListingType;
  minPrice?: number;
  maxPrice?: number;
  minBeds?: number;
  /** 1 to 500, default 20. */
  limit?: number;
}

export interface MonitorParams {
  source: string;
  location: string;
  type?: ListingType;
  minPrice?: number;
  maxPrice?: number;
  minBeds?: number;
  /** Listings read per check, 1 to 500. Server default 50. */
  limit?: number;
  /** A public http(s) address that gets the report by POST when something changed. */
  webhookUrl?: string;
  email?: string;
}

export declare class Listingrail {
  constructor(options?: ListingrailOptions);
  readonly baseUrl: string;
  timeout: number;
  readonly hasApiKey: boolean;

  /** GET /v1/sources. No key, no credits. */
  sources(): Promise<SourcesResponse>;
  /** POST /v1/listings/search. 1 credit per listing returned. */
  search(params: SearchParams): Promise<SearchResponse>;
  /** POST /v1/listings/details. 1 credit. Only sources with `details: true`. */
  details(params: { source: string; url: string }): Promise<DetailsResponse>;
  /** GET /v1/listings/{source}/{id}/history. Paid plans, no credits. */
  history(source: string, listingId: string): Promise<HistoryResponse>;
  /** GET /v1/demo without parameters: the list of samples. No key. */
  demo(): Promise<DemoSamples>;
  /** GET /v1/demo for one sample: up to five stored real listings. No key, no credits. */
  demo(params: { source: string; city: string; type?: ListingType }): Promise<DemoResponse>;
  /** GET /v1/account. */
  account(): Promise<Account>;
  /** GET /v1/usage. */
  usage(params?: { limit?: number }): Promise<UsageResponse>;
  /** POST /v1/signup. No key. */
  signup(email: string): Promise<SignupResponse>;
  /** POST /v1/monitors. */
  createMonitor(params: MonitorParams): Promise<MonitorCreated>;
  /** GET /v1/monitors. */
  monitors(): Promise<MonitorsResponse>;
  /** GET /v1/monitors/{id}/changes. */
  monitorChanges(monitorId: number): Promise<MonitorChangesResponse>;
  /** DELETE /v1/monitors/{id}. */
  deleteMonitor(monitorId: number): Promise<{ deleted: number }>;
}

export default Listingrail;

export interface ListingrailErrorOptions {
  status?: number;
  code?: string;
  detail?: unknown;
  cause?: unknown;
}

export declare class ListingrailError extends Error {
  constructor(message: string, options?: ListingrailErrorOptions);
  /** HTTP status; undefined when the request got no answer. */
  status?: number;
  /** The server's `detail.error` where present, e.g. "insufficient_credits". */
  code?: string;
  /** The `detail` value of the answer as sent. */
  detail?: unknown;
  buyUrl?: string;
  upgradeUrl?: string;
}
export declare class APIConnectionError extends ListingrailError {}
export declare class BadRequestError extends ListingrailError {}
export declare class UnknownLocationError extends BadRequestError {}
export declare class AuthenticationError extends ListingrailError {}
export declare class InsufficientCreditsError extends ListingrailError {
  creditsRemaining?: number;
  plans: Plan[];
}
export declare class PermissionDeniedError extends ListingrailError {}
export declare class NotFoundError extends ListingrailError {}
export declare class ConflictError extends ListingrailError {}
export declare class ValidationError extends ListingrailError {}
export declare class RateLimitError extends ListingrailError {}
export declare class SourceFailedError extends ListingrailError {}
