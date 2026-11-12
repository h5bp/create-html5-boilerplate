## Summary of Changes

<!-- Provide a concise description of what this PR does and why. Focus on user-facing behavior or maintainer intent. -->

-

## Contributor Checklist

- [ ] My code follows the style guidelines of this project (`npm run lint` and `npm run format:check`).[cite: 1]
- [ ] I have added or updated tests using `node:test` to cover my changes (`npm test`).[cite: 1]
- [ ] Type checking passes (`npm run typecheck`).[cite: 1]
- [ ] I have updated the documentation (`README.md`, `CONTRIBUTING.md`, etc.) if needed.[cite: 1]
- [ ] I have read the **CONTRIBUTING** document.[cite: 1]

> **Note for Human Contributors:** Pull requests are a conversation—expect a little back and forth to get things merged cleanly[cite: 1]. **You do not need to manually fill out the YAML manifest below** unless you are making high-risk changes to CLI filesystem mutations, archive extraction, or network I/O (and even then, a plain-English note in your summary is fine—maintainers will help with the rest).
>
> **Note for AI Agents & Automated Workflows:** If this PR was generated or authored with an AI coding agent (Copilot, Cursor, Claude, etc.), the agent **MUST** populate the complete **Assumptions & Constraints Manifest (ACM v1.1)** below[cite: 1].

---

## Assumptions & Constraints Manifest (ACM v1.1)

<!--
  What is this?
  An Assumptions & Constraints Manifest (ACM) is an open standard (https://github.com/roblarsen/ACM) that surfaces hidden runtime assumptions, failure modes, and side effects in AI-generated code so maintainers don't have to reverse-engineer them during review.

  Agent Instructions for create-html5-boilerplate:
  - Required for all agent-authored changes, especially those touching network I/O, filesystem mutations, archive extraction, or CLI error handling.
  - Contract status options: guaranteed | conditional | unsupported | not_applicable | unknown
  - If "guaranteed", provide an 'evidence' string citing exact code location (file:line-range).
  - If "conditional", provide a 'conditions' string citing required runtime prerequisites.
  - If "unsupported", provide a 'failure_mode' string explaining how the operation fails.
  - Risk floor rules: data_loss_safety=unsupported -> risk_level >= critical; data_loss_safety=unknown -> risk_level >= high.
-->

<!-- ACM-START -->

---

acm_version: "1.1"
change_type: "feature" # Options: feature | refactor | bugfix | hotfix | infra
risk_level: "low" # Options: low | medium | high | critical
contracts:
idempotency:
status: "not_applicable" # evidence: "src/generator.js:10-25" # conditions: "Requires clean target directory" # failure_mode: "Re-running overwrites existing user files without prompting"
concurrency_safety:
status: "not_applicable" # failure_mode: "Concurrent invocations in the same working directory may collide on temp files"
horizontal_scalability:
status: "not_applicable"
strict_ordering:
status: "not_applicable"
data_loss_safety:
status: "not_applicable" # failure_mode: "Partial writes or unrecovered temp directories may remain on failure"
distributed_primitives:
consistency_model: "not_applicable" # Options: eventual | read_your_writes | monotonic_reads | linearizable | not_applicable | unknown
delivery_semantics: "not_applicable" # Options: at_most_once | at_least_once | exactly_once_claimed | not_applicable | unknown
degradation_mode: "fail_closed" # Options: fail_closed | fail_open | stale_reads | partial_unavailable | unknown
backpressure_strategy: "not_applicable" # Options: fail_fast | queue_bounded | shed_load | unbounded_buffer_risk | not_applicable
tags:

- "cli"
- "filesystem"
- "networking"

---

### 1. Invariants & Data Model Boundaries

<!-- What assumptions are made about CLI flags, user paths, package metadata, or input shapes? -->

- **Payload & Input Validation:**
- **Temporal Semantics (Timezone/Clock Skew):**
- **Identity & Duplication:**

### 2. State & Runtime Topology

<!-- Where does state live during CLI execution? Are temp directories or file locks used? -->

- **Memory & Persistence:**
- **Concurrency & Locking:**
- **Environment & Runtime (Node >= 20):**

### 3. Environmental & Network Assumptions

<!-- What upstream registry/tarball latency, network timeouts, or filesystem atomicity are assumed? -->

- **Network Timeouts & Retry Logic:**
- **Delivery Guarantees & HTTP Error Handling:**
- **Atomicity Across Boundaries (Filesystem, Archive Extraction, Multi-Step Cleanup):**

### 4. Explicit Non-Goals & Unhandled Failure Modes

<!-- What edge cases, permission errors, or partial-write states are intentionally OUT OF SCOPE? -->

- **Unhandled Failure Modes:**
- **Degradation Behavior (Fail-Closed vs. Fail-Open):**
- **Partial Recovery & Rollback Cleanup:**

<!-- ACM-END -->

---

## Maintainer Contract Sign-Off (For Agent / High-Risk PRs)

<!--
  Maintainers: Check these when merging agent-generated PRs or changes touching core I/O.
-->

- [ ] **Boundary Audit:** Declared boundaries, failure modes, and primitives align with our Node ≥ 20 CLI runtime environment[cite: 1].
- [ ] **Unsupported / Unknown Acceptance:** Any contracts marked `unsupported` or `unknown` have acceptable failure modes for this release[cite: 1].
- [ ] **Evidence Verification:** Cited mechanisms for any `guaranteed` contracts exist and function in the diff[cite: 1].
- [ ] **Risk Floor Compliance:** Declared `risk_level` meets or exceeds ACM v1.1 risk-floor rules (`npm run acm:validate` passes)[cite: 1].
