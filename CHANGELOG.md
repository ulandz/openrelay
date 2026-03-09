# Changelog

## [0.8.3] - 2026-03-07

### Initial Release

**Providers (29 total)**
- 7 IDE providers: Claude Desktop, Claude Code, Kiro (AWS Q), Windsurf, Antigravity, OpenCode, VS Code Copilot
- 22 direct API providers: Groq, Cerebras, OpenRouter, SambaNova, DashScope, DeepSeek, Gemini, Mistral, xAI, SiliconFlow, Zhipu, Together, Fireworks, NVIDIA NIM, GitHub Models, Volcengine, Moonshot, Baichuan, Stepfun, MiniMax, Hunyuan, Ollama

**API Compatibility**
- Anthropic Messages API (streaming + non-streaming)
- OpenAI Chat Completions API (streaming + non-streaming)
- Azure OpenAI compatible endpoint
- Bidirectional format translation with full tool/function calling support

**Consumer Access Methods**
- IDE RPC proxy servers: Windsurf (18766), Antigravity (18767), Cursor (18780), VS Code Copilot (18769)
- Shell environment functions for CLI tools (Claude Code, OpenCode, Aider, Goose, Amp)
- API key auth: `sk-or-{provider}-{hex}` format for SDK/curl access
- Custom model groups with round-robin routing

**Platform**
- macOS (ARM64 / x64) + Windows (x64)
- Single-file binary (Node.js SEA) — no runtime dependencies
- Web management dashboard (bilingual EN/ZH)
- Auto-detection of installed AI apps and credentials
- License system: Free (50 req/day) / Pro (unlimited)
