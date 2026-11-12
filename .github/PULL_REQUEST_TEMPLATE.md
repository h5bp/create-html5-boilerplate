## Summary of Changes

<!-- Provide a concise description of what this PR does and why. Focus on business intent. -->

-

---

<!-- ACM-START -->
<!--
  ASSUMPTIONS & CONSTRAINTS MANIFEST (ACM) v1.1

  Instructions for Create-HTML5-Boilerplate:
  - This project enforces ACM v1.1 for all code changes involving network I/O, filesystem mutations, or CLI error handling.
  - Fill out the typed frontmatter contracts and distributed primitives below.
  - Contract status options: guaranteed | conditional | unsupported | not_applicable | unknown
  - If "guaranteed", provide an 'evidence' string citing exact code location (file:line-range).
  - If "conditional", provide a 'conditions' string citing required runtime prerequisites.
  - If "unsupported", provide a 'failure_mode' string explaining how the operation fails.
  - Complete all four narrative sections (1-4) with concrete technical details.
  - Risk floor rules: data_loss_safety=unsupported → risk_level≥critical; data_loss_safety=unknown → risk_level≥high
-->

---

acm_version: "1.1"
change_type: "feature" # Options: feature | refactor | bugfix | hotfix | infra
risk_level: "medium" # Options: low | medium | high | critical
contracts:
idempotency:
status: "unsupported" # evidence: "file.js:10-25" # conditions: "only if X is true"
failure_mode: "Retrying this operation may cause duplicate side effects"
concurrency_safety:
status: "unsupported"
failure_mode: "Concurrent invocations may corrupt shared state"
horizontal_scalability:
status: "unsupported"
failure_mode: "Multiple instances cannot safely run in parallel"
strict_ordering:
status: "not_applicable" # If applicable, describe ordering dependencies here
data_loss_safety:
status: "unsupported"
failure_mode: "Partial writes or unrecovered temp files may occur on failure"
distributed_primitives:
consistency_model: "eventual" # Options: eventual | read_your_writes | monotonic_reads | linearizable | not_applicable | unknown
delivery_semantics: "at_least_once" # Options: at_most_once | at_least_once | exactly_once_claimed | not_applicable | unknown
degradation_mode: "fail_closed" # Options: fail_closed | fail_open | stale_reads | partial_unavailable | unknown
backpressure_strategy: "fail_fast" # Options: fail_fast | queue_bounded | shed_load | unbounded_buffer_risk | not_applicable
tags:

- "networking"
- "cli"
- "filesystem"

---

### 1. Invariants & Data Model Boundaries

<!-- What assumptions are made about payloads, schema invariants, uniqueness, and temporal/clock semantics? -->

- **Payload & Input Validation:**
- **Temporal Semantics (Timezone/Clock Skew):**
- **Identity & Duplication:**

### 2. State & Runtime Topology

<!-- Where does state live (heap vs. shared store)? How does this behave under concurrency and multi-pod auto-scaling? -->

- **Memory & Persistence:**
- **Concurrency & Locking:**
- **Clustering & Replicas:**

### 3. Environmental & Network Assumptions

<!-- What downstream/upstream latency, SLAs, network delivery guarantees, timeout budgets, and cross-boundary atomicity are assumed? -->

- **Network Timeouts & Retry Logic:**
- **Delivery Guarantees & HTTP Error Handling:**
- **Atomicity Across Boundaries (Filesystem, Archive, Multi-Step Workflows):**

### 4. Explicit Non-Goals & Unhandled Failure Modes

<!-- What edge cases, failure states, or disaster scenarios are intentionally OUT OF SCOPE? -->

- **Unhandled Failure Modes:**
- **Degradation Behavior (Fail-Closed vs. Fail-Open):**
- **Partial Recovery & Compensating Transactions:**

<!-- ACM-END -->

---

## Reviewer Contract Sign-Off

<!--
  Mandatory review gate:
  - Required if any contract status is "unsupported" or "unknown".
  - Required if risk_level is "high" or "critical".

  Reviewers MUST verify:
  1. The declared boundaries match the diff
  2. Any "unsupported" contracts have acceptable failure modes
  3. Evidence citations (guaranteed) actually exist and work
-->

- [ ] **Boundary Audit:** I have reviewed the declared **Assumptions & Constraints Manifest** above and verified that the stated contracts, failure modes, and distributed primitives align with our Node ≥20 environment and production infrastructure.

- [ ] **Unsupported / Unknown Contract Acceptance:** All contracts marked `unsupported` or `unknown` (e.g., non-idempotent operations, race conditions, partial writes, dual-write risks) have been evaluated and deemed acceptable for this release cycle. Associated follow-up issues exist if remediation is needed.

- [ ] **Evidence Verification:** For all contracts marked `guaranteed`, I have confirmed the cited code mechanisms (atomic operations, timeouts, cleanup guarantees, error handling) are present and functional in the diff.

- [ ] **Risk Floor Compliance:** The declared `risk_level` matches or exceeds the minimum mandated by ACM v1.1 risk-floor rules (e.g., `data_loss_safety: unsupported` requires `risk_level ≥ critical`).

---

## Additional Checklist

- [ ] My code follows the code style of this project (see `npm run lint` and `npm run format:check`).
- [ ] My change requires a change to the documentation (in which case see next item).
- [ ] I have updated the documentation accordingly (README.md, CONTRIBUTING.md, etc.).
- [ ] I have read the **CONTRIBUTING** document.
- [ ] I have added or updated tests to cover my changes.
- [ ] All new and existing tests passed (`npm test`).
- [ ] Type checking passes (`npm run typecheck`).
- [ ] ACM manifest is structurally valid (`npm run acm:validate` if applicable).

---

Pull requests should be thought of as a conversation. There will be some back and forth when trying to get code merged into this or any other project. With all but the simplest changes you can and should expect that the maintainers of the project will request changes to your code. Please be aware of that and check in after you open your PR in order to get your code merged in cleanly.

Thanks!
