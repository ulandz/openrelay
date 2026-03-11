# OpenRelay FAQ (Frequently Asked Questions)

> Check here first when you run into issues. If your question isn't covered, please open a [GitHub Issue](https://github.com/romgX/openrelay/issues).

---

## Table of Contents

1. [Installation & Startup](#installation--startup)
2. [Connection & Configuration](#connection--configuration)
3. [Providers & Quotas](#providers--quotas)
4. [Error Troubleshooting](#error-troubleshooting)
5. [IDE Integration](#ide-integration)

---

## Installation & Startup

### Q: How do I install OpenRelay?

Download the latest release from GitHub: https://github.com/romgX/openrelay/releases

Supported platforms: macOS (arm64/x64), Windows (x64).

The binary release requires no Node.js. Running from source requires Node.js >= 18.

### Q: How do I start it?

```bash
openrelay start
```

Check status:

```bash
openrelay status
```

Default port: `18765`.

### Q: How do I set it to start on boot?

macOS:

```bash
openrelay service install
```

This creates a LaunchAgent that starts automatically after login.

---

## Connection & Configuration

### Q: How do I connect Claude Code?

Option 1: One-click setup

```bash
openrelay config set-app claude-code claude-sonnet-4-6
```

Option 2: Set environment variables manually

```bash
export ANTHROPIC_BASE_URL=http://localhost:18765
export ANTHROPIC_API_KEY=unused
```

### Q: How do I connect Cursor / Windsurf / Cline?

```bash
openrelay config set-app cursor claude-sonnet-4-6
openrelay config set-app windsurf claude-sonnet-4-6
```

Or set the API Base URL to `http://localhost:18765` in your IDE settings.

### Q: How do I view current configuration?

```bash
openrelay config list
```

---

## Providers & Quotas

### Q: How do I add free providers?

```bash
openrelay provider add
```

Interactive setup will guide you. Recommended free providers:
- **Groq** — 14,400 req/day, Llama 3.3 70B, extremely fast
- **Cerebras** — 1M tokens/day, Llama 70B
- **Google AI Studio** — Gemini series, generous free tier
- **SambaNova** — Llama 405B, 200K tokens/day

### Q: What happens when free quota runs out?

OpenRelay automatically fails over to the next available provider. If all providers are rate-limited, they'll recover in a few minutes. We recommend registering multiple providers for better reliability.

### Q: How do I check provider status?

```bash
openrelay provider list
```

Or open the Web dashboard at `http://localhost:18765`.

---

## Error Troubleshooting

### Q: `impit not available (Cannot find module 'impit/index.wrapper.js')`

**This is a normal informational message, not an error.**

impit is an optional Chrome TLS fingerprint library used to bypass CloudFlare JA3/JA4 detection. Without it, OpenRelay automatically falls back to native fetch — **everything works normally**.

You do NOT need to install impit manually. Only relevant if you encounter persistent 403 errors with the Claude Desktop provider.

### Q: `connection refused localhost:18765`

OpenRelay is not running. Start it:

```bash
openrelay start
```

If already started but still getting errors, check if the port is in use:

```bash
lsof -i :18765
```

### Q: `401 Unauthorized`

API key expired or invalid. Check your provider keys:

```bash
openrelay config list
```

If it's a Claude Code OAuth token expiration:

```bash
claude auth login
```

OpenRelay will automatically pick up the new token after re-authentication.

### Q: `rate limit exceeded`

Current provider quota is exhausted. OpenRelay automatically switches to the next available provider.

If all providers are rate-limited:
1. Wait a few minutes and retry
2. Add more providers: `openrelay provider add`
3. Check if any provider keys have expired: `openrelay provider list`

### Q: `403 Forbidden` (CloudFlare block)

Some providers (e.g., Claude Desktop) use CloudFlare protection. OpenRelay automatically refreshes cookies and retries.

If 403 persists:
1. Check if impit is loaded (look in startup logs)
2. Try restarting: `openrelay restart`
3. Clear cookie cache and retry

### Q: `ECONNRESET` or `socket hang up`

Network instability or provider-side disconnection. Usually temporary — OpenRelay retries automatically.

If it happens frequently:
1. Check your network connection
2. Check if you need a proxy (`openrelay config set proxy http://...`)
3. Switch to a different provider

### Q: `EADDRINUSE` on startup

Port 18765 is already in use. Another OpenRelay instance may be running:

```bash
openrelay status
# If it shows running, no need to start again

# To force restart
openrelay restart
```

---

## IDE Integration

### Q: Claude Code shows `model not found`

Confirm OpenRelay is running and the model name is correct:

```bash
openrelay status
curl http://localhost:18765/v1/models
```

Make sure environment variables are set correctly (`ANTHROPIC_BASE_URL` and `ANTHROPIC_API_KEY`).

### Q: Cursor can't connect to OpenRelay

1. Confirm OpenRelay is running: `openrelay status`
2. In Cursor Settings → Models:
   - API Base URL: `http://localhost:18765/v1`
   - API Key: `unused` (any value works)
3. Test connection: `curl http://localhost:18765/v1/models`

### Q: Responses are very slow

1. Check which provider/model is in use — larger models (e.g., 405B) are slower
2. Switch to faster providers (Groq and Cerebras are the fastest)
3. Check network latency (`ping` the provider's domain)

---

> Last updated: 2026-03-11
>
> If your question isn't listed here, please open a [GitHub Issue](https://github.com/romgX/openrelay/issues) and we'll add it to this FAQ.
