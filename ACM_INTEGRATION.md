# ACM v1.1 Integration for create-html5-boilerplate

> **Assumptions & Constraints Manifest (v1.1) Configuration for AI-Governed Refactoring**

This repository has been configured to enforce **ACM v1.1 semantic contracts** on all pull requests, ensuring every code change—especially those involving network I/O, archive extraction, filesystem mutations, and CLI error handling—is validated against typed operational boundaries.

---

## Quick Start

### For Developers

1. **Read the Instructions:**

   ```bash
   cat .github/copilot-instructions.md
   ```

2. **Create a PR with ACM Manifest:**
   - Implement your feature in `src/`
   - Use the PR template (auto-populated) which includes ACM section
   - Fill in YAML frontmatter (acm_version, change_type, risk_level, contracts, primitives)
   - Complete 4 narrative sections (Invariants, State Topology, Network Assumptions, Non-Goals)
   - Add evidence anchors for `guaranteed` contracts (e.g., `src/file.js:10-25`)

3. **Validate Locally:**

   ```bash
   npm run acm:validate -- .acm.md
   ```

4. **Submit PR:**
   - CI automatically validates manifest structure, contracts, and risk-floor compliance
   - Reviewers audit boundaries using checklist in PR template

### For Reviewers

1. **Check PR Description** has ACM block (<!--ACM-START-->...<!--ACM-END-->)
2. **Review Manifest:**
   - Is risk_level justified by contract statuses?
   - Do unsupported/unknown contracts have clear failure_mode descriptions?
   - Do guaranteed contracts cite actual code evidence?
3. **Sign Reviewer Checklist** (4 required approvals):
   - [ ] Boundary Audit
   - [ ] Unsupported/Unknown Contract Acceptance
   - [ ] Evidence Verification
   - [ ] Risk Floor Compliance

---

## Key Files

| File                                   | Purpose                                                           |
| -------------------------------------- | ----------------------------------------------------------------- |
| `.github/copilot-instructions.md`      | Complete ACM v1.1 instruction set for AI & developers             |
| `.github/PULL_REQUEST_TEMPLATE.md`     | PR template with ACM manifest section + reviewer checklist        |
| `.github/workflows/acm-governance.yml` | CI gate validating PR descriptions against ACM v1.1 spec          |
| `.acm.md`                              | Baseline manifest for current codebase (all contracts guaranteed) |
| `package.json`                         | Added `@roblarsen/acm-cli` + `acm:validate` script                |

---

## Five Core Contracts (Required in All Manifests)

1. **Idempotency:** Can this operation be safely retried without changing its outcome?
2. **Concurrency Safety:** Is this safe under simultaneous multi-threaded or multi-process access?
3. **Horizontal Scalability:** Can multiple instances run simultaneously without interference?
4. **Strict Ordering:** Do operations have serialization requirements?
5. **Data Loss Safety:** Can this code lose, corrupt, or partially write data?

Each contract must be marked: `guaranteed | conditional | unsupported | not_applicable | unknown`

---

## Contract Status Rules

- **`guaranteed`**: Must provide `evidence` citing exact code location (e.g., `src/file.js:42-68`)
- **`conditional`**: Must provide `conditions` describing runtime prerequisites
- **`unsupported`**: Must provide `failure_mode` explaining how it fails
- **`not_applicable`**: No additional fields needed
- **`unknown`**: Rare; indicates insufficient analysis

---

## Risk Floor Enforcement

The CI validator mathematically enforces minimum risk levels:

| Scenario                                                              | Minimum Risk Level    |
| :-------------------------------------------------------------------- | :-------------------- |
| `data_loss_safety: unsupported`                                       | `critical`            |
| `data_loss_safety: unknown`                                           | `high`                |
| `concurrency_safety: unknown` or `unsupported`                        | `medium`              |
| Any contract with no evidence (`guaranteed` without `evidence` field) | CI Validation Failure |

---

## Baseline Manifest Status ✅

The current codebase (src/cli.js, src/generator.js, src/download.js) is **fully ACM v1.1 compliant**:

| Contract               | Status            | Evidence                                                                              |
| ---------------------- | ----------------- | ------------------------------------------------------------------------------------- |
| Idempotency            | ✅ GUARANTEED     | `src/download.js:35-54` – immutable tarball URL + integrity verification              |
| Concurrency Safety     | ✅ GUARANTEED     | `src/generator.js:47-49` – unique temp directory per invocation                       |
| Horizontal Scalability | ✅ GUARANTEED     | `src/download.js:25,35-54` – stateless fetch, no process-local caching                |
| Strict Ordering        | ✅ NOT_APPLICABLE | Single-threaded CLI with synchronous boundaries                                       |
| Data Loss Safety       | ✅ GUARANTEED     | `src/generator.js:65-70`, `src/download.js:56-68` – atomic cleanup + integrity checks |

**Risk Level:** `medium` (appropriate for production scaffolding tool)

---

## Validation Commands

```bash
# Validate a standalone .acm.md file
npm run acm:validate -- .acm.md

# Or validate from PR description (simulating CI)
npx @roblarsen/acm-cli validate --pr-body "$(cat .github/PULL_REQUEST_TEMPLATE.md)"

# Check structure only (no risk-floor validation)
npx @roblarsen/acm-cli validate --file .acm.md

# Strict validation (enforces risk floors)
npx @roblarsen/acm-cli validate --file .acm.md --strict
```

---

## Example: Minimal ACM Manifest

```markdown
<!-- ACM-START -->

---

acm_version: "1.1"
change_type: "bugfix"
risk_level: "low"
contracts:
idempotency:
status: "guaranteed"
evidence: "src/download.js:35 - tarball URL is immutable"
concurrency_safety:
status: "guaranteed"
evidence: "src/generator.js:47-49 - unique temp dir per invocation"
horizontal_scalability:
status: "guaranteed"
evidence: "src/download.js:25 - stateless fetch operations"
strict_ordering:
status: "not_applicable"
data_loss_safety:
status: "guaranteed"
evidence: "src/generator.js:65-70 - fs.rm() in finally guarantees cleanup"
distributed_primitives:
consistency_model: "not_applicable"
delivery_semantics: "at_most_once"
degradation_mode: "fail_closed"
backpressure_strategy: "fail_fast"
tags:

- "cli"
- "networking"

---

### 1. Invariants & Data Model Boundaries

- Tarball URL is immutable per package@version; SSRI integrity verified before extraction

### 2. State & Runtime Topology

- No shared mutable state; unique temp directory per invocation ensures isolation

### 3. Environmental & Network Assumptions

- 15-second timeout for all network operations; no retry loop; fail-closed on timeout

### 4. Explicit Non-Goals & Unhandled Failure Modes

- No exponential backoff or circuit breaker; user must retry manually on network failure
- Destination rollback not implemented; pre-flight check mitigates accidental overwrites

<!-- ACM-END -->
```

---

## CI Integration

Pull requests trigger `.github/workflows/acm-governance.yml`:

1. Checks PR body contains valid ACM v1.1 YAML frontmatter
2. Validates all 4 narrative sections are present
3. Enforces risk-floor rules (e.g., `data_loss_safety: unsupported` requires `risk_level ≥ critical`)
4. Comments on PR with pass/fail status
5. **Blocks merge if validation fails**

---

## References

- **ACM v1.1 Specification:** https://github.com/roblarsen/ACM/blob/main/spec.md
- **ACM CLI Documentation:** https://github.com/roblarsen/ACM/tree/main/tooling/acm-cli
- **create-html5-boilerplate:** https://github.com/h5bp/create-html5-boilerplate
- **Node.js API Documentation:** https://nodejs.org/dist/latest-v20.x/docs/api/

---

## Support

For questions about ACM v1.1 or this integration:

1. Review `.github/copilot-instructions.md` (comprehensive guide)
2. Check `.acm.md` (baseline implementation example)
3. Visit https://github.com/roblarsen/ACM (official specification repo)
