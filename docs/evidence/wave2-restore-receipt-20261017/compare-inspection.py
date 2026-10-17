"""Offline: compare the guest receipt reads' inspection with the live deployment inspection.

Prints counts and per-section equality only. Usage: compare-inspection.py <live.json> <receipt-reads.json>
"""
import json
import sys

live = json.load(open(sys.argv[1]))
guest = json.load(open(sys.argv[2]))["inspection"]
out = {}
for key in ("components", "modules", "schemas"):
    out[key + "Equal"] = live[key] == guest.get(key)
out["componentPathsLive"] = sorted(c["path"] for c in live["components"])
out["componentPathsGuest"] = sorted(c["path"] for c in guest.get("components", []))
out["componentStatesGuest"] = sorted({c["state"] for c in guest.get("components", [])})
out["moduleCountsGuest"] = {str(m["componentId"]): len(m["modules"]) for m in guest.get("modules", [])}
out["functionCountGuest"] = sum(len(mod["functions"]) for m in guest.get("modules", []) for mod in m["modules"])
out["functionCountLive"] = sum(len(mod["functions"]) for m in live["modules"] for mod in m["modules"])
out["cronCountGuest"] = sum(len(mod["crons"]) for m in guest.get("modules", []) for mod in m["modules"])
out["cronCountLive"] = sum(len(mod["crons"]) for m in live["modules"] for mod in m["modules"])
out["inProgressSchemasGuest"] = sum(1 for s in guest.get("schemas", []) if s["inProgressHash"] is not None)
if not out["modulesEqual"] and "modules" in guest:
    lm = {str(m["componentId"]): {mod["path"]: mod for mod in m["modules"]} for m in live["modules"]}
    gm = {str(m["componentId"]): {mod["path"]: mod for mod in m["modules"]} for m in guest["modules"]}
    out["moduleOrderOnlyDifference"] = lm == gm
    out["modulePathsDiffering"] = sorted(f"{c}:{p}" for c in set(lm) | set(gm) for p in set(lm.get(c, {})) | set(gm.get(c, {}))
                                         if lm.get(c, {}).get(p) != gm.get(c, {}).get(p))
if not out["schemasEqual"] and "schemas" in guest:
    out["schemaComponentsDiffering"] = [s["componentId"] for s, t in zip(live["schemas"], guest["schemas"]) if s != t]
print(json.dumps(out, indent=2))
