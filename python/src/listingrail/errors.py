"""Exceptions raised by the client, one per kind of error the API answers with."""
from typing import Any, Dict, List, Optional


class ListingrailError(Exception):
    """Base class. `message` is the server's own sentence where it sent one.

    status: HTTP status, or None when the request never got an answer.
    code: the server's `detail.error` value where present, e.g. "insufficient_credits".
    detail: the `detail` value of the answer as sent (a string, an object or a list).
    buy_url, upgrade_url: links the server sent with the error, else None.
    """

    def __init__(self, message: str, status: Optional[int] = None, code: Optional[str] = None, detail: Any = None) -> None:
        super().__init__(message)
        self.message = message
        self.status = status
        self.code = code
        self.detail = detail
        fields: Dict[str, Any] = detail if isinstance(detail, dict) else {}
        self.buy_url: Optional[str] = fields.get("buy_url")
        self.upgrade_url: Optional[str] = fields.get("upgrade_url")

    def __str__(self) -> str:
        return f"HTTP {self.status}: {self.message}" if self.status else self.message


class APIConnectionError(ListingrailError):
    """The request did not get an HTTP answer (network error or timeout)."""


class BadRequestError(ListingrailError):
    """400: unknown source, a type or filter the source does not take, a bad monitor."""


class UnknownLocationError(BadRequestError):
    """400 with error `unknown_location`: the portal knows no such place. Nothing was charged."""


class AuthenticationError(ListingrailError):
    """401: the key is missing or unknown."""


class InsufficientCreditsError(ListingrailError):
    """402: no credits left. `buy_url` opens the pack checkout; `plans` lists each plan with its own `buy_url`."""

    def __init__(self, message: str, status: Optional[int] = None, code: Optional[str] = None, detail: Any = None) -> None:
        super().__init__(message, status, code, detail)
        fields: Dict[str, Any] = detail if isinstance(detail, dict) else {}
        self.credits_remaining: Optional[int] = fields.get("credits_remaining")
        self.plans: List[Dict[str, Any]] = fields.get("plans") or []


class PermissionDeniedError(ListingrailError):
    """403: the plan does not include this (price history on a free key, no free monitor slot)."""


class NotFoundError(ListingrailError):
    """404: no such monitor, no stored history for the listing, no demo sample for the city."""


class ConflictError(ListingrailError):
    """409: the email already has an account (signup)."""


class ValidationError(ListingrailError):
    """422: the request body is invalid. `detail` is the list of fields the server names."""


class RateLimitError(ListingrailError):
    """429: more than 5 requests a second on one key, or the hourly demo or daily signup limit of a network."""


class SourceFailedError(ListingrailError):
    """502: the portal could not be read just now. Nothing was charged."""


_BY_STATUS = {400: BadRequestError, 401: AuthenticationError, 402: InsufficientCreditsError, 403: PermissionDeniedError,
              404: NotFoundError, 409: ConflictError, 422: ValidationError, 429: RateLimitError, 502: SourceFailedError}


def error_from_response(status: int, body: Any, text: str = "") -> ListingrailError:
    """Build the exception for an answer with a status of 400 or more. `body` is the parsed JSON, or None."""
    detail = body.get("detail") if isinstance(body, dict) else None
    code = None
    if isinstance(detail, dict):
        code = detail.get("error")
        message = detail.get("message") or code or f"HTTP {status}"
    elif isinstance(detail, str):
        message = detail
    elif isinstance(detail, list):  # 422: one entry per invalid field
        message = "; ".join(f"{'.'.join(str(p) for p in d.get('loc', []))}: {d.get('msg', '')}" for d in detail if isinstance(d, dict)) or "Invalid request."
    else:
        message = (text or "").strip()[:200] or f"HTTP {status}"
    cls = UnknownLocationError if status == 400 and code == "unknown_location" else _BY_STATUS.get(status, ListingrailError)
    return cls(str(message), status, code, detail)
