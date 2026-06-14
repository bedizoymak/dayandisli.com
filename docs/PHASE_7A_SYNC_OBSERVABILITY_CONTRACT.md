# Phase 7A — Sync Observability Contract

## Objective

Define safe, structured observability summaries for Paraşüt sync runs without
changing synchronization behavior or introducing an external logging service.

## Allowed Summary Fields

Run summaries contain only:

- run ID
- resource type
- status
- page and record counters
- last completed checkpoint page
- duration in milliseconds

Error summaries contain only:

- sanitized error code
- sanitized and truncated message
- retryable flag

Raw payloads and arbitrary metadata are never copied into summaries.

## Redaction

The sanitizer redacts:

- bearer tokens
- access and refresh tokens
- API keys and common secret assignments
- email addresses
- phone-number-like values
- sensitive URL query parameters

Untrusted text is normalized and deterministically truncated.

## Scope

This phase contains pure helpers and deterministic tests only. It does not
change sync execution, call Paraşüt, access Supabase, add migrations, schedule
work, map ERP data, commit, or push.

