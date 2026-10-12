# Park completed concept classifier proposals until explicit retry

Unknown-domain and empty-domain responses previously left concepts without a completion timestamp, causing the hourly sweep to spend repeatedly on the same first 20 concepts and block newer ones. We record completed responses in `classifiedAt` even when the concept remains unreviewed, and reserve automatic recovery for concepts without that marker. Human triage can then resolve registry proposals before an explicit, bounded retry spends on them again.

Existing outcomes without timestamps receive one more automatic attempt to establish completion. Provider failures and malformed or missing rows remain retryable under the existing policy. We chose explicit retries over an automatic cooldown because waiting alone does not resolve domain triage; `--retry-unreviewed` supplies a documented recovery command without reclassifying concepts already marked on or off mission.
