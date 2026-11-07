"""Deployment metadata half of guest-receipt-reads.py: same output shape as inspectDeployment().

Pushed next to guest-receipt-reads.py and imported by it; Python 3.9+ standard
library only. `inspect` takes a `query(path, args)` callable, so this module
holds no key and opens no connection.
"""

import base64
import decimal
import hashlib
import json
import re
import struct

UDF_TYPES = ("Query", "Mutation", "Action", "HttpAction")
INTEGER = re.compile(r"^[A-Za-z0-9+/]{11}=$")


class Rejected(Exception):
    """Carries a fixed classification code, never backend text."""


def js_number(value):
    """JSON.stringify(number): ECMAScript Number::toString over the shortest round-trip digits.

    JSON.parse yields an IEEE double, so integers beyond 2**53 are rounded first.
    """
    if isinstance(value, int):
        if abs(value) <= 2 ** 53:
            return str(value)
        value = float(value)
    if value != value or value in (float("inf"), float("-inf")):
        return "null"
    if value == 0:
        return "0"
    sign = "-" if value < 0 else ""
    shortest = decimal.Decimal(repr(abs(value))).as_tuple()
    raw = "".join(str(d) for d in shortest.digits)
    n = len(raw) + shortest.exponent  # value = 0.<digits> * 10**n
    digits = raw.rstrip("0") or "0"
    k = len(digits)
    if k <= n <= 21:
        text = digits + "0" * (n - k)
    elif 0 < n <= 21:
        text = digits[:n] + "." + digits[n:]
    elif -6 < n <= 0:
        text = "0." + "0" * -n + digits
    else:
        exponent = n - 1
        text = digits[0] + ("." + digits[1:] if k > 1 else "") + "e" + ("+" if exponent >= 0 else "-") + str(abs(exponent))
    return sign + text


def utf16_order(key):
    """JavaScript compares strings by UTF-16 code unit; big-endian UTF-16 bytes sort the same way."""
    return key.encode("utf-16-be", "surrogatepass")


def canonical(item, depth=0):
    """Port of metadataHash()'s canonical form in convex-deployment-inspect.ts."""
    if depth > 64:
        raise Rejected("metadata_depth")
    if item is None:
        return "null"
    if isinstance(item, bool):
        return "true" if item else "false"
    if isinstance(item, str):
        return json.dumps(item, ensure_ascii=False)
    if isinstance(item, (int, float)):
        return js_number(item)
    if isinstance(item, list):
        return "[" + ",".join(canonical(child, depth + 1) for child in item) + "]"
    if isinstance(item, dict):
        return "{" + ",".join(
            json.dumps(k, ensure_ascii=False) + ":" + canonical(item[k], depth + 1) for k in sorted(item, key=utf16_order)) + "}"
    raise Rejected("metadata_type")


def metadata_hash(value):
    return hashlib.sha256(canonical(value).encode("utf-8")).hexdigest()


def label(value, nullable=False):
    if value is None and nullable:
        return None
    if not isinstance(value, str) or len(value) > 1024:
        raise Rejected("invalid_metadata")
    return value


def schedule_integer(value, low, high):
    if not isinstance(value, dict) or set(value) != {"$integer"} or not isinstance(value["$integer"], str) \
            or not INTEGER.match(value["$integer"]):
        raise Rejected("invalid_schedule")
    integer = struct.unpack("<q", base64.b64decode(value["$integer"]))[0]
    if not low <= integer <= high:
        raise Rejected("invalid_schedule")
    return integer


def cron_schedule(spec):
    kind = spec.get("type") if isinstance(spec, dict) else None
    out = {"type": kind}
    def optional_minute():
        if "minuteUTC" in spec and spec["minuteUTC"] is not None:
            out["minuteUTC"] = schedule_integer(spec["minuteUTC"], 0, 59)
    if kind == "interval":
        out["seconds"] = schedule_integer(spec.get("seconds"), 0, 2**53 - 1)
    elif kind == "hourly":
        optional_minute()
    elif kind == "daily":
        out["hourUTC"] = schedule_integer(spec.get("hourUTC"), 0, 23)
        optional_minute()
    elif kind == "weekly":
        out["dayOfWeek"] = schedule_integer(spec.get("dayOfWeek"), 0, 6)
        out["hourUTC"] = schedule_integer(spec.get("hourUTC"), 0, 23)
        optional_minute()
    elif kind == "monthly":
        out["day"] = schedule_integer(spec.get("day"), 1, 31)
        out["hourUTC"] = schedule_integer(spec.get("hourUTC"), 0, 23)
        optional_minute()
    elif kind == "cron":
        expr = spec.get("cronExpr")
        if not isinstance(expr, str) or len(expr) > 256 or not re.match(r"^[0-9*,/-]+(?:[ \t]+[0-9*,/-]+){4}$", expr):
            raise Rejected("invalid_schedule")
        out["cronExpr"] = expr
    else:
        raise Rejected("invalid_schedule")
    return out


def inspect(query):
    raw_components = query("_system/frontend/components:list", {})
    if not isinstance(raw_components, list) or len(raw_components) > 100:
        raise Rejected("invalid_components")
    components = []
    for item in raw_components:
        if not isinstance(item, dict) or not isinstance(item.get("args"), dict):
            raise Rejected("invalid_components")
        component = {"id": label(item.get("id")), "path": label(item.get("path")), "state": label(item.get("state"))}
        if "name" in item:
            component["name"] = label(item["name"], nullable=True)
        if "httpPrefix" in item:
            component["httpPrefix"] = label(item["httpPrefix"], nullable=True)
        component["argsCount"] = len(item["args"])
        component["argsOmitted"] = True
        components.append(component)
    if len({c["id"] for c in components}) != len(components) or len({c["path"] for c in components}) != len(components):
        raise Rejected("duplicate_components")
    component_ids = [None] + [c["id"] for c in components if c["path"] != ""]

    raw_modules = query("_system/frontend/modules:listForAllComponents", {})
    if not isinstance(raw_modules, list) or len(raw_modules) != len(component_ids):
        raise Rejected("incomplete_module_inventory")
    modules = []
    for entry in raw_modules:
        if not isinstance(entry, list) or len(entry) != 2 or not isinstance(entry[1], list):
            raise Rejected("invalid_modules")
        component_id = label(entry[0], nullable=True)
        if component_id not in component_ids:
            raise Rejected("incomplete_module_inventory")
        out_modules = []
        for module_entry in entry[1]:
            if not isinstance(module_entry, list) or len(module_entry) != 2 or not isinstance(module_entry[1], dict):
                raise Rejected("invalid_modules")
            path, module = label(module_entry[0]), module_entry[1]
            functions = []
            for fn in module.get("functions", []):
                if fn.get("udfType") not in UDF_TYPES or fn.get("visibility", {}).get("kind") not in ("public", "internal"):
                    raise Rejected("invalid_function")
                functions.append({"name": label(fn.get("name")), "udfType": fn["udfType"],
                                  "visibility": {"kind": fn["visibility"]["kind"]}})
            if len({f["name"] for f in functions}) != len(functions):
                raise Rejected("duplicate_functions")
            crons = []
            for cron in module.get("cronSpecs") or []:
                identifier, spec = cron[0], cron[1]
                crons.append({"identifier": label(identifier), "udfPath": label(spec.get("udfPath")),
                              "schedule": cron_schedule(spec.get("cronSchedule")), "argsOmitted": True})
            out_modules.append({"path": path, "functions": functions, "crons": crons})
        if len({m["path"] for m in out_modules}) != len(out_modules):
            raise Rejected("duplicate_modules")
        modules.append({"componentId": component_id, "modules": out_modules})
    if len({m["componentId"] for m in modules}) != len(modules):
        raise Rejected("incomplete_module_inventory")

    schemas = []
    for component_id in component_ids:
        value = query("_system/frontend/getSchemas", {"componentId": component_id})
        if not isinstance(value, dict):
            raise Rejected("invalid_schema")
        def fingerprint(field):
            text = value.get(field)
            if text is None:
                return None
            if not isinstance(text, str):
                raise Rejected("invalid_schema")
            return metadata_hash(json.loads(text))
        schemas.append({"componentId": component_id, "activeHash": fingerprint("active"),
                        "inProgressHash": fingerprint("inProgress")})
    return {"components": components, "modules": modules, "schemas": schemas}
