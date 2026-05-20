# n8n-code-node-snippets
# n8n Code Node Snippets

> A collection of battle-tested JavaScript snippets for n8n Code nodes. Every snippet was extracted from real production workflows and refined through actual bugs.

[![n8n](https://img.shields.io/badge/n8n-Code%20Node-EA4B71?style=flat&logo=n8n)](https://n8n.io)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## Why This Repo Exists

n8n's visual nodes cover ~80% of typical workflow needs. The remaining 20% — data sanitization, complex transformations, schema validation, defensive coding — lives in Code nodes.

This repo is what I wish existed when I started: real snippets, with comments explaining *why* the code is shaped the way it is, including the production bugs that motivated each line.

## Snippets

### 🧹 Data Sanitization

- [`unicode-sanitizer.js`](./snippets/unicode-sanitizer.js) — Strip variation selectors, zero-width spaces, and BOMs that break downstream APIs
- [`url-normalizer.js`](./snippets/url-normalizer.js) — Bypass CRM link trackers that rewrite `https://` URLs
- [`whitespace-cleaner.js`](./snippets/whitespace-cleaner.js) — Normalize whitespace without destroying intentional formatting

### 🏗️ Data Transformation

- [`json-from-llm-output.js`](./snippets/json-from-llm-output.js) — Safely extract JSON blocks from LLM free-form responses
- [`hierarchy-builder.js`](./snippets/hierarchy-builder.js) — Construct CRM-shaped payloads from flat field maps
- [`schema-normalizer.js`](./snippets/schema-normalizer.js) — Handle case-sensitive field name mismatches between systems

### 🛡️ Validation & Safety

- [`payload-validator.js`](./snippets/payload-validator.js) — Fail-fast validation with structured error messages
- [`secret-stripper.js`](./snippets/secret-stripper.js) — Remove tokens, API keys, and PII before logging
- [`idempotency-key-builder.js`](./snippets/idempotency-key-builder.js) — Deterministic keys to prevent duplicate writes on retry

### 🔁 Flow Control

- [`exponential-backoff.js`](./snippets/exponential-backoff.js) — Retry logic with jitter for transient API failures
- [`batch-chunker.js`](./snippets/batch-chunker.js) — Split large arrays into rate-limit-safe chunks

## How to Use

Each snippet is a self-contained `.js` file. Copy the relevant function into your n8n Code node and adapt the input/output shape to match your workflow.

Snippets are written to be:
- **Defensive** — they handle null, undefined, and malformed input gracefully
- **Observable** — they log what they're doing for debugging
- **Composable** — they don't reach into n8n globals unless necessary
- **Annotated** — every non-obvious decision has a comment explaining why

## Contributing

If you've debugged something that should be here, open a PR. The best snippets come from someone's worst weekend.

## About

Built by [Eduardo Noyola](https://www.linkedin.com/in/eduardo-noyola-contreras-1b629a151/) while shipping AI automation workflows for B2B clients at ENC System Apps.

---

*All snippets are MIT licensed. Use them, fork them, ship them.*
