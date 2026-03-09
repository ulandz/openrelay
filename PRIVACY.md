# Privacy Policy

## Overview

OpenRelay is a local proxy tool that runs entirely on your machine. Your privacy is fundamental to its design.

## Credential Handling

OpenRelay reads authentication credentials (cookies, tokens, API keys) from AI desktop applications you have already installed and logged into. These credentials are:

- **Read-only** — OpenRelay reads but never modifies your stored credentials
- **In-memory only** — credentials are held in process memory during runtime, never written to OpenRelay's own files
- **Never transmitted** — credentials are only used to authenticate requests directly to the original AI service backends, never sent to OpenRelay servers or any third party

## Data Handling

### What stays on your machine

- **All authentication credentials** — read from your local filesystem, used in-memory only
- **All AI conversations** — pass directly from your client to the AI backend; OpenRelay does not store, log, or inspect message content
- **Configuration data** — stored locally at `~/.openrelay/`

### What is never collected

- Message content is never logged, stored, or analyzed
- No usage telemetry, analytics, or behavioral data is collected
- Your credentials are never sent to OpenRelay servers

## Network Connections

OpenRelay makes the following network connections:

1. **AI service backends** (e.g., api.anthropic.com, amazonaws.com, server.codeium.com) — to forward your requests using your own credentials
2. **License verification server** (`license.limitlessmeto.com`, hosted on Cloudflare) — periodic license status check
   - **Sent**: anonymous device identifier and license token
   - **NOT sent**: credentials, conversation content, usage details, or personal information
   - **Purpose**: verify license tier (Free / Pro) and active device count
3. **GitHub Releases API** (optional) — to check for software updates

## Local Logging

- The `openrelay.log` file may contain request metadata (timestamps, model names, token counts) for debugging purposes
- Log files never contain message content, credentials, or personal information
- Logs are stored locally and are never transmitted

## Data Deletion

To completely remove all OpenRelay data:

```bash
rm -rf ~/.openrelay/
```

## Contact

For privacy-related questions, please open an issue on GitHub.
