"""PayU payment gateway helpers (hashing + verify_payment API)."""

import hashlib
import uuid
from decimal import Decimal

import httpx
from django.conf import settings


def _sha512(value: str) -> str:
    return hashlib.sha512(value.encode("utf-8")).hexdigest().lower()


def paise_to_amount_str(amount_paise: int) -> str:
    """PayU expects rupee amount as a string with two decimal places."""
    return f"{Decimal(amount_paise) / Decimal(100):.2f}"


def generate_txnid() -> str:
    return f"IX{uuid.uuid4().hex[:20]}"


def payment_request_hash(
    *,
    key: str,
    txnid: str,
    amount: str,
    productinfo: str,
    firstname: str,
    email: str,
    salt: str,
    udf1: str = "",
    udf2: str = "",
    udf3: str = "",
    udf4: str = "",
    udf5: str = "",
) -> str:
    """
    sha512(key|txnid|amount|productinfo|firstname|email|udf1..udf5||||||SALT)
    """
    plain = "|".join(
        [
            key,
            txnid,
            amount,
            productinfo,
            firstname,
            email,
            udf1,
            udf2,
            udf3,
            udf4,
            udf5,
            "",
            "",
            "",
            "",
            "",
            salt,
        ]
    )
    return _sha512(plain)


def payment_response_hash(
    *,
    salt: str,
    status: str,
    key: str,
    txnid: str,
    amount: str,
    productinfo: str,
    firstname: str,
    email: str,
    udf1: str = "",
    udf2: str = "",
    udf3: str = "",
    udf4: str = "",
    udf5: str = "",
    additional_charges: str = "",
) -> str:
    """
    Reverse hash from PayU callback:
    sha512([additional_charges|]SALT|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key)
    """
    parts = []
    if additional_charges:
        parts.append(additional_charges)
    parts.extend(
        [
            salt,
            status,
            "",
            "",
            "",
            "",
            "",
            udf5,
            udf4,
            udf3,
            udf2,
            udf1,
            email,
            firstname,
            productinfo,
            amount,
            txnid,
            key,
        ]
    )
    return _sha512("|".join(parts))


def command_hash(command: str, var1: str) -> str:
    key = settings.PAYU_MERCHANT_KEY
    salt = settings.PAYU_MERCHANT_SALT
    return _sha512(f"{key}|{command}|{var1}|{salt}")


def verify_payment_status(txnid: str) -> dict | None:
    """
    Call PayU's verify_payment command API. Returns the transaction detail dict
    on success, or None if the call fails / txn not found.
    """
    key = settings.PAYU_MERCHANT_KEY
    salt = settings.PAYU_MERCHANT_SALT
    if not key or not salt:
        return None

    command = "verify_payment"
    payload = {
        "key": key,
        "command": command,
        "var1": txnid,
        "hash": _sha512(f"{key}|{command}|{txnid}|{salt}"),
    }
    url = f"{settings.PAYU_POSTSERVICE_URL.rstrip('/')}/merchant/postservice?form=2"

    try:
        response = httpx.post(url, data=payload, timeout=15.0)
        response.raise_for_status()
        data = response.json()
    except Exception:
        return None

    # PayU wraps details under transaction_details[txnid]
    details = (data.get("transaction_details") or {}).get(txnid)
    if not details:
        return None
    return details
