// JavaScript client for the Listingrail real estate listings API (https://listingrail.com).
// No dependencies: uses the global fetch of Node 18+, browsers, Deno and Bun.

export const VERSION = "0.1.0";
export const DEFAULT_BASE_URL = "https://listingrail.com";
export const DEFAULT_TIMEOUT_MS = 180_000; // a large search can take up to two minutes; the docs ask for 180 seconds

/**
 * Base class of every error the client throws. `message` is the server's own sentence where it sent one.
 * status: HTTP status, or undefined when the request got no answer.
 * code: the server's `detail.error` where present, e.g. "insufficient_credits".
 * detail: the `detail` value of the answer as sent (a string, an object or an array).
 * buyUrl, upgradeUrl: links the server sent with the error.
 */
export class ListingrailError extends Error {
  constructor(message, { status, code, detail, cause } = {}) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = this.constructor.name;
    this.status = status;
    this.code = code;
    this.detail = detail;
    const fields = detail && typeof detail === "object" && !Array.isArray(detail) ? detail : {};
    this.buyUrl = fields.buy_url;
    this.upgradeUrl = fields.upgrade_url;
  }
}

/** The request did not get an HTTP answer (network error or timeout). */
export class APIConnectionError extends ListingrailError {}
/** 400: unknown source, a type or filter the source does not take, a bad monitor. */
export class BadRequestError extends ListingrailError {}
/** 400 with error `unknown_location`: the portal knows no such place. Nothing was charged. */
export class UnknownLocationError extends BadRequestError {}
/** 401: the key is missing or unknown. */
export class AuthenticationError extends ListingrailError {}
/** 402: no credits left. `buyUrl` opens the pack checkout; `plans` lists each plan with its own `buy_url`. */
export class InsufficientCreditsError extends ListingrailError {
  constructor(message, options = {}) {
    super(message, options);
    const fields = options.detail && typeof options.detail === "object" && !Array.isArray(options.detail) ? options.detail : {};
    this.creditsRemaining = fields.credits_remaining;
    this.plans = fields.plans ?? [];
  }
}
/** 403: the plan does not include this (price history on a free key, no free monitor slot). */
export class PermissionDeniedError extends ListingrailError {}
/** 404: no such monitor, no stored history for the listing, no demo sample for the city. */
export class NotFoundError extends ListingrailError {}
/** 409: the email already has an account (signup). */
export class ConflictError extends ListingrailError {}
/** 422: the request body is invalid. `detail` is the list of fields the server names. */
export class ValidationError extends ListingrailError {}
/** 429: more than 5 requests a second on one key, or the hourly demo or daily signup limit of a network. */
export class RateLimitError extends ListingrailError {}
/** 502: the portal could not be read just now. Nothing was charged. */
export class SourceFailedError extends ListingrailError {}

const BY_STATUS = {
  400: BadRequestError, 401: AuthenticationError, 402: InsufficientCreditsError, 403: PermissionDeniedError,
  404: NotFoundError, 409: ConflictError, 422: ValidationError, 429: RateLimitError, 502: SourceFailedError,
};

function errorFromResponse(status, body, text) {
  const detail = body && typeof body === "object" && !Array.isArray(body) ? body.detail : undefined;
  let code;
  let message;
  if (Array.isArray(detail)) { // 422: one entry per invalid field
    message = detail.filter((d) => d && typeof d === "object").map((d) => `${(d.loc ?? []).join(".")}: ${d.msg ?? ""}`).join("; ") || "Invalid request.";
  } else if (detail && typeof detail === "object") {
    code = detail.error;
    message = detail.message || code || `HTTP ${status}`;
  } else if (typeof detail === "string") {
    message = detail;
  } else {
    message = (text ?? "").trim().slice(0, 200) || `HTTP ${status}`;
  }
  const Cls = status === 400 && code === "unknown_location" ? UnknownLocationError : BY_STATUS[status] ?? ListingrailError;
  return new Cls(String(message), { status, code, detail });
}

const dropEmpty = (values) => Object.fromEntries(Object.entries(values).filter(([, v]) => v !== undefined && v !== null));

export class Listingrail {
  #apiKey;
  #fetch;

  /**
   * apiKey: your key (`re_...`). Left out, it is read from the LISTINGRAIL_API_KEY environment variable where
   *   there is one. `sources()`, `demo()` and `signup()` work without a key.
   * timeout: milliseconds to wait for an answer (default 180000).
   * fetch: a fetch function, for tests or a custom HTTP stack.
   *
   * The client never retries: the server sends no Retry-After, and a search sent twice is charged twice.
   */
  constructor({ apiKey, baseUrl = DEFAULT_BASE_URL, timeout = DEFAULT_TIMEOUT_MS, fetch: fetchFn } = {}) {
    this.#apiKey = apiKey || globalThis.process?.env?.LISTINGRAIL_API_KEY || undefined;
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.timeout = timeout;
    this.#fetch = fetchFn ?? globalThis.fetch;
    if (typeof this.#fetch !== "function") throw new ListingrailError("No fetch function. Use Node 18 or newer, or pass { fetch }.");
  }

  /** Whether the client has a key. The key itself is private, so it does not show up in logs of the object. */
  get hasApiKey() {
    return Boolean(this.#apiKey);
  }

  async #request(method, path, { params, body, auth = true } = {}) {
    const headers = { Accept: "application/json", "User-Agent": `listingrail-js/${VERSION}` };
    if (auth) {
      if (!this.#apiKey) {
        throw new AuthenticationError("No API key. Pass { apiKey } or set LISTINGRAIL_API_KEY. A free key: https://listingrail.com/#key");
      }
      headers.Authorization = `Bearer ${this.#apiKey}`;
    }
    let url = this.baseUrl + path;
    const query = new URLSearchParams(dropEmpty(params ?? {})).toString();
    if (query) url += `?${query}`;
    const init = { method, headers, signal: AbortSignal.timeout(this.timeout) };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }
    let response;
    let text;
    try {
      response = await this.#fetch(url, init);
      text = await response.text();
    } catch (cause) {
      throw new APIConnectionError(`Could not reach ${this.baseUrl}: ${cause?.message ?? cause}`, { cause });
    }
    let parsed;
    try {
      parsed = text ? JSON.parse(text) : undefined;
    } catch {
      parsed = undefined;
    }
    if (response.status >= 400) throw errorFromResponse(response.status, parsed, text);
    if (parsed === undefined) throw new ListingrailError(`The answer was not JSON: ${text.slice(0, 200)}`, { status: response.status });
    return parsed;
  }

  // listings

  /** Every source key with its countries, sale or rent, accepted filters and location format. No key, no credits. */
  sources() {
    return this.#request("GET", "/v1/sources", { auth: false });
  }

  /**
   * Live listings of one source for one place. 1 credit per listing returned; an empty or failed search is free.
   * type: "rent" or "sale"; left out, the source's first kind is used (see `sources()`).
   * minPrice, maxPrice, minBeds: only where the source takes them (`filters` in `sources()`), else the API answers 400.
   * limit: 1 to 500 (default 20). The REST API has no offset or page parameter: for more than 500, split the
   *   search by price range or area.
   */
  search({ source, location, type, minPrice, maxPrice, minBeds, limit = 20 }) {
    return this.#request("POST", "/v1/listings/search", { body: dropEmpty({ source, location, type, minPrice, maxPrice, minBeds, limit }) });
  }

  /** One listing by its link, 1 credit. Only for sources with `details: true` in `sources()`. */
  details({ source, url }) {
    return this.#request("POST", "/v1/listings/details", { body: { source, url } });
  }

  /**
   * First seen, last seen and the price changes stored for one listing. Paid plans (403 on a free key), no credits.
   * 404 when no search, details call or monitor check has fetched the listing.
   */
  history(source, listingId) {
    return this.#request("GET", `/v1/listings/${encodeURIComponent(source)}/${encodeURIComponent(String(listingId))}/history`);
  }

  /**
   * Stored real listings of a sample city. No key, no credits, never starts a portal search.
   * Without arguments it returns the list of samples (`{ samples: [{ source, city, type }] }`).
   * With `source` and `city` of one sample it returns up to five listings. 30 sample calls an hour per network.
   */
  demo({ source, city, type } = {}) {
    return this.#request("GET", "/v1/demo", { params: { source, city, type }, auth: false });
  }

  // account

  /** Email, plan, credit balance and the keys of the account (first characters only). */
  account() {
    return this.#request("GET", "/v1/account");
  }

  /** Credits used in this period and the most recent requests (`limit` 1 to 500, default 50). */
  usage({ limit = 50 } = {}) {
    return this.#request("GET", "/v1/usage", { params: { limit } });
  }

  /** Create a free key for an email address. The key is in `api_key` and is shown once. 409 if the email has one. */
  signup(email) {
    return this.#request("POST", "/v1/signup", { body: { email }, auth: false });
  }

  // monitors

  /**
   * Save a search that is checked once a day for new, removed and price-changed listings.
   * limit: listings read per check, 1 to 500 (server default 50). Each check costs 1 credit per listing read,
   *   except on the Feed plan.
   * webhookUrl: a public http(s) address that gets the report by POST when something changed.
   */
  createMonitor({ source, location, type, minPrice, maxPrice, minBeds, limit, webhookUrl, email }) {
    const filters = dropEmpty({ type, minPrice, maxPrice, minBeds, limit });
    return this.#request("POST", "/v1/monitors", { body: dropEmpty({ source, location, filters, webhook_url: webhookUrl, email }) });
  }

  /** Your monitors with their last report, and how many your plan holds (`slots`). */
  monitors() {
    return this.#request("GET", "/v1/monitors");
  }

  /** New, removed and price-changed listings from the last check of one monitor. */
  monitorChanges(monitorId) {
    return this.#request("GET", `/v1/monitors/${encodeURIComponent(String(monitorId))}/changes`);
  }

  /** Delete a monitor and free its slot. */
  deleteMonitor(monitorId) {
    return this.#request("DELETE", `/v1/monitors/${encodeURIComponent(String(monitorId))}`);
  }
}

export default Listingrail;
