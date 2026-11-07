"""PostgreSQL first-start recovery (item 2) half of guest-receipt-reads.py, parsed inside the guest.

Pushed next to guest-receipt-reads.py and imported by it; Python 3.9+ standard
library only. Uses no key: it reads `docker logs` in memory and returns fixed
event tokens with their timestamp and LSN, plus severity counts.
"""

import re
import subprocess

from guest_receipt_metadata import Rejected

PG_PREFIX = re.compile(r"^(?P<ts>\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)? [A-Z]{2,5}) \[\d+\] (?P<sev>[A-Z]+):  (?P<msg>.*)$")
PG_EVENTS = (
    ("interrupted", re.compile(r"database system was interrupted; last known up at (\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} [A-Z]{2,5})")),
    ("clean_shutdown_at", re.compile(r"database system was shut down at (\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} [A-Z]{2,5})")),
    ("automatic_recovery_in_progress", re.compile(r"database system was not properly shut down; automatic recovery in progress")),
    ("redo_starts_at", re.compile(r"redo starts at ([0-9A-F]{1,8}/[0-9A-F]{1,8})")),
    ("redo_done_at", re.compile(r"redo done at ([0-9A-F]{1,8}/[0-9A-F]{1,8}) system usage: .*")),
    ("wal_end_invalid_record_length_at", re.compile(r"invalid record length at ([0-9A-F]{1,8}/[0-9A-F]{1,8}): expected at least \d+, got \d+")),
    ("end_of_recovery_checkpoint_started", re.compile(r"checkpoint starting: end-of-recovery(?: [a-z-]+)*")),
    ("ready_to_accept_connections", re.compile(r"database system is ready to accept connections")),
)


def parse_postgres_recovery(lines):
    """Fixed event tokens with their timestamp and an LSN or timestamp value; nothing else."""
    events, severities, total = [], {"FATAL": 0, "PANIC": 0, "ERROR": 0, "WARNING": 0}, 0
    for line in lines:
        total += 1
        match = PG_PREFIX.match(line.rstrip("\n"))
        if not match:
            continue
        if match["sev"] in severities:
            severities[match["sev"]] += 1
        if match["sev"] != "LOG":
            continue
        for name, pattern in PG_EVENTS:
            found = pattern.fullmatch(match["msg"])
            if found:
                event = {"at": match["ts"], "event": name}
                if found.groups():
                    event["value"] = found.group(1)
                events.append(event)
                break
    return {"events": events, "severityCounts": severities, "linesScanned": total}


def postgres_recovery(since):
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z", since):
        raise Rejected("invalid_since")
    try:
        logs = subprocess.run(["docker", "logs", "--since", since, "app-postgres-1"], stdout=subprocess.PIPE,
                              stderr=subprocess.STDOUT, timeout=30, check=True).stdout
    except Exception:  # noqa: BLE001
        raise Rejected("log_read_failed") from None
    return parse_postgres_recovery(logs.decode("utf-8", "replace").splitlines())
