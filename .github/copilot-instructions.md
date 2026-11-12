# Copilot Instructions for create-html5-boilerplate

## AI-Governed Refactoring with ACM v1.1

**Version:** 1.1.0 | **Target:** Node ≥20.0.0 (ESM + JSDoc @ts-check)

This repository enforces **Assumptions & Constraints Manifest (ACM v1.1)** specification to guarantee semantic correctness and operational boundary clarity for all code changes, especially those involving:

- **Native fetch streams** and HTTP client resilience (network timeouts, 5xx responses, abort signals)
- **Archive extraction** with atomic cleanup on failure and collision safety
- **Filesystem mutations** with rollback guarantees and cross-platform path normalization
- **CLI error boundaries** with structured diagnostics and fail-closed degradation

---

## Dual-Output Requirement

**Every code change or refactoring task MUST produce two outputs:**

### 1. Source Code Implementation

- **Language & Runtime:** TypeScript JSDoc (`// @ts-check`) + Node.js ≥20 ESM only
- **APIs:** Use only Node.js native `node:*` modules (no polyfills):
  - `node:fs/promises` for atomic file operations
  - `node:stream/promises` and `node:stream` for backpressure-aware pipeline composition
  - `node:net`, `node:http`, `node:https` abstractions via `fetch()` (Node ≥18)
  - `node:util.parseArgs()` for CLI argument parsing
  - `node:os.tmpdir()` for transient staging and cleanup
- **Error Handling:** Comprehensive error classification with structured diagnostic context
- **Type Safety:** 100% JSDoc type coverage; zero implicit `any`; all function signatures fully typed
- **Code Style:** Follow existing project conventions (ESLint + Prettier; no manual formatting)

### 2. ACM v1.1 Manifest Block

For every non-trivial code change, generate a complete **Assumptions & Constraints Manifest** documenting:

```markdown
<!-- ACM-START -->

---

acm_version: "1.1"
change_type: "feature|refactor|bugfix|hotfix|infra"
risk_level: "low|medium|high|critical"
contracts:
idempotency:
status: "guaranteed|conditional|unsupported|not_applicable|unknown"
evidence: "[file:line-range] where idempotency is enforced"
conditions: "[prerequisites if conditional]"
failure_mode: "[what breaks if this fails]"

# ... (all five core contracts)

distributed_primitives:
consistency_model: "eventual|read_your_writes|monotonic_reads|linearizable|not_applicable|unknown"
delivery_semantics: "at_most_once|at_least_once|exactly_once_claimed|not_applicable|unknown"
degradation_mode: "fail_closed|fail_open|stale_reads|partial_unavailable|unknown"
backpressure_strategy: "fail_fast|queue_bounded|shed_load|unbounded_buffer_risk|not_applicable"
tags:

- "category"

---

### 1. Invariants & Data Model Boundaries

### 2. State & Runtime Topology

### 3. Environmental & Network Assumptions

### 4. Explicit Non-Goals & Unhandled Failure Modes

<!-- ACM-END -->
```

---

## Contract Definitions

### Core Contracts (Five Mandatory)

**1. Idempotency**

- **Meaning:** Can this operation be safely retried without changing its outcome?
- **Relevance:** Critical for network retry loops, webhook handlers, and recovery procedures
- **Generator Example:**
  - `guaranteed`: Operation uses deterministic idempotency keys (UUIDs) or is a pure read
  - `conditional`: Idempotent only if upstream state hasn't changed since last call
  - `unsupported`: Non-idempotent POST/mutation; caller must handle deduplication externally
  - Evidence: [src/download.js:95-120] Archive downloads are idempotent via tarball URL + integrity check

**2. Concurrency Safety**

- **Meaning:** Is this safe under simultaneous multi-threaded or multi-process access?
- **Relevance:** Detects race conditions, lost updates, and data corruption under concurrency
- **Generator Example:**
  - `guaranteed`: Uses atomic filesystem operations (Node's `fs.cp()` or single-threaded event loop isolation)
  - `conditional`: Safe only when external lock/mutex is held
  - `unsupported`: No synchronization; will corrupt shared state
  - Evidence: [src/generator.js:42-68] fs operations are event-loop-serialized; no concurrent writes to same file

**3. Horizontal Scalability**

- **Meaning:** Can multiple instances of this code run simultaneously without interference?
- **Relevance:** Determines if code can scale across replicas, containers, or serverless invocations
- **Generator Example:**
  - `guaranteed`: Fully stateless; all I/O is to external services with built-in replication (npm registry, GitHub API)
  - `conditional`: Scales if external shared store (DB, cache) is replicated
  - `unsupported`: Hard-coded singleton state or process-local in-memory assumptions
  - Evidence: [src/download.js:35] No process-local cache; each invocation independently fetches + verifies

**4. Strict Ordering**

- **Meaning:** Must operations occur in a specific sequence?
- **Relevance:** Identifies serialization requirements and potential deadlock or livelock hazards
- **Generator Example:**
  - `guaranteed`: Total ordering enforced by streaming pipelines or transaction logs
  - `conditional`: Partial ordering; some operations can reorder safely
  - `not_applicable`: This code has no ordering dependencies
  - Evidence: [src/generator.js:55-70] Temp cleanup via `finally` ensures extraction dir removal after any outcome

**5. Data Loss Safety**

- **Meaning:** Can this code lose, silently corrupt, or partially write data?
- **Relevance:** The most critical contract; violations can require customer support and data recovery
- **Generator Example:**
  - `guaranteed`: All writes are atomic or enclosed in transactions; partial writes impossible
  - `conditional`: Safe if upstream service provides guarantees (S3 PutObject is atomic)
  - `unsupported`: Dual-write without coordination; risk of torn state
  - Evidence: [src/generator.js:50-53] fs.cp() is atomic kernel operation; temp dir cleanup in finally block

---

## Risk Floor Rules (Non-Negotiable)

The following rules are mathematically enforced by the `acm-cli` validator. **Any violation fails CI:**

| Scenario                                                                        | Minimum Risk Level    |
| :------------------------------------------------------------------------------ | :-------------------- |
| `data_loss_safety: unknown`                                                     | `high`                |
| `data_loss_safety: unsupported`                                                 | `critical`            |
| `concurrency_safety: unknown` or `unsupported`                                  | `medium`              |
| `horizontal_scalability: unknown` or `unsupported` (for multi-tenant/SaaS code) | `high`                |
| Any contract with no evidence (`guaranteed` without `evidence` field)           | CI Validation Failure |

---

## Specific Guidance: create-html5-boilerplate

### Network Resilience (Fetch Streams)

When modifying `src/download.js`:

1. **Timeout Handling:**
   - `AbortSignal.timeout(15_000)` sets a hard 15-second budget
   - Catch `AbortError` and `TimeoutError` (name-based check; not instanceof)
   - Evidence: [src/download.js:27-45] timeout wrapper function

2. **HTTP Non-2xx Responses:**
   - Always check `response.ok` before reading body
   - Call `await response.body?.cancel()` to clean up the stream
   - Provide descriptive error with status code and statusText
   - Evidence: [src/download.js:23-28]

3. **Stream Integrity:**
   - Use `ssri.integrityStream()` for checksum verification during pipeline
   - Abort signal is passed through to all pipeline stages
   - Evidence: [src/download.js:56-68] pipeline with integrity validation

4. **Network Failure Modes:**
   - `fetch failed` or `terminated` → connection drop or DNS failure
   - `ECONNREFUSED` → service unavailable
   - Parse and re-throw with user-friendly message + cause chain
   - Evidence: [src/download.js:41-49]

### Archive Extraction (Atomicity & Collision Safety)

When modifying `src/generator.js`:

1. **Temp Directory Lifecycle:**
   - Create with `fs.mkdtemp(prefix)` to get unique staging area
   - All extraction and prep happens inside
   - **Cleanup is guaranteed in `finally` block** via `fs.rm(tempDir, {recursive: true, force: true})`
   - Evidence: [src/generator.js:47-49] mkdtemp call; [src/generator.js:65-70] finally cleanup

2. **Tar Extraction:**
   - `tar.extract({strict: true})` enforces strict POSIX compliance
   - Detects malformed archives and aborts before partial write
   - Evidence: [src/generator.js:61]

3. **Collision Safety (Target Directory Already Exists):**
   - `fs.cp(..., {force: true})` recursively overwrites
   - **Risk:** User may lose untracked files in destination
   - **Mitigation:** CLI prompts user interactively before proceeding if directory is non-empty
   - Evidence: [src/cli.js:218-230] pathExists + readdir check

4. **Path Normalization (Windows vs. POSIX):**
   - `path.join()` and `path.resolve()` handle platform differences
   - `glob()` patterns use forward-slash normalizer: `path.replace(/\\/g, "/")`
   - Evidence: [src/generator.js:54] glob pattern normalization

### CLI Error Boundaries

When modifying `src/cli.js`:

1. **Structured Error Classification:**
   - `describeFailure()` dispatches on error code (ETARGET, EACCES, ENOTDIR, etc.)
   - Each branch provides a user-friendly message + structured context
   - Caller (logger) renders context as formatted output
   - Evidence: [src/cli.js:10-85]

2. **Fail-Closed Behavior:**
   - CLI exits with non-zero `process.exitCode = 1` on any error
   - No silent fallbacks or partial success
   - Evidence: [src/cli.js:110, 170, 245]

3. **Argument Parsing Boundaries:**
   - `parseArgs()` with `strict: true` rejects unknown flags
   - Catch `TypeError` with code `ERR_PARSE_ARGS_*`
   - Re-throw other errors (not our problem domain)
   - Evidence: [src/cli.js:125-162]

4. **Node Version Gating:**
   - Check `process.versions.node` before any runtime code
   - Log error and exit if Node < 20
   - Evidence: [src/cli.js:115-122]

---

## ACM Validation Checklist

Before submitting a pull request with code changes:

- [ ] **Dual Output Generated:** Source code + ACM manifest block in PR description
- [ ] **Risk Floor Satisfied:** `acm-cli validate --pr-body` passes without errors
- [ ] **Evidence Anchors Complete:** Every `guaranteed` contract cites file:line-range
- [ ] **Failure Modes Explicit:** Every `unsupported` contract has a clear `failure_mode` string
- [ ] **Code Style Verified:** `npm run lint && npm run format:check` pass
- [ ] **Tests Pass:** `npm test` and `npm run coverage` meet baseline
- [ ] **Reviewer Sign-Off Required:** Template includes Boundary Audit & Evidence Verification checkboxes

---

## Example: Minimal ACM for Patch

```markdown
<!-- ACM-START -->

---

acm_version: "1.1"
change_type: "bugfix"
risk_level: "low"
contracts:
idempotency:
status: "guaranteed"
evidence: "src/download.js:35 - tarball URL is immutable; re-downloading same version is idempotent"
concurrency_safety:
status: "guaranteed"
evidence: "src/generator.js:47-49 - unique temp dir per invocation via mkdtemp; no shared mutable state"
horizontal_scalability:
status: "guaranteed"
evidence: "src/download.js:25 - all I/O to npm registry via stateless fetch; no process-local cache"
strict_ordering:
status: "not_applicable"
data_loss_safety:
status: "guaranteed"
evidence: "src/generator.js:65-70 - fs.rm() in finally block guarantees temp cleanup; fs.cp() atomic"
distributed_primitives:
consistency_model: "not_applicable"
delivery_semantics: "not_applicable"
degradation_mode: "fail_closed"
backpressure_strategy: "fail_fast"
tags:

- "cli"
- "networking"

---

### 1. Invariants & Data Model Boundaries

- No mutable state assumptions; all data flows through function parameters
- Tarball integrity is verified via ssri hash before extraction

### 2. State & Runtime Topology

- All state is local to function scope; no singletons or process-wide state
- Unique temp directory per invocation ensures isolation under concurrency

### 3. Environmental & Network Assumptions

- Assumes npm registry is reachable and responsive within 15-second budget
- Assumes filesystem permissions allow temp directory creation in system temp
- Assumes destination path is writable (checked interactively before proceeding)

### 4. Explicit Non-Goals & Unhandled Failure Modes

- Does NOT support rollback of partial target directory writes
- Does NOT retry network operations beyond built-in fetch timeout
- Network failure results in fail-closed error and full temp cleanup

<!-- ACM-END -->
```

---

## Running ACM Validation Locally

```bash
# Validate a standalone .acm.md file
npm run acm:validate -- .acm.md

# Or validate from PR description (when in CI):
npx acm-cli validate --pr-body "${{ github.event.pull_request.body }}"
```

---

## References

- **ACM v1.1 Specification:** https://github.com/roblarsen/ACM/blob/main/spec.md
- **CLI Reference:** https://github.com/roblarsen/ACM/tree/main/tooling/acm-cli
- **create-html5-boilerplate Docs:** https://github.com/h5bp/create-html5-boilerplate/blob/main/README.md
- **Node.js Stability Index:** https://nodejs.org/dist/latest-v20.x/docs/api/
