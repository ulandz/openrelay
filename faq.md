# OpenRelay 常见问题与解答 (FAQ)

> 遇到问题先查这里。如果未解决，请到 [GitHub Issues](https://github.com/romgX/openrelay/issues) 提问。
>
> 维护说明：发现新的用户问题时，及时更新本文档。

---

## 目录

1. [安装与启动](#安装与启动)
2. [连接与配置](#连接与配置)
3. [Provider 与配额](#provider-与配额)
4. [报错排查](#报错排查)
5. [IDE 集成](#ide-集成)

---

## 安装与启动

### Q: 怎么安装 OpenRelay？

从 GitHub 下载最新版本：https://github.com/romgX/openrelay/releases

支持平台：macOS (arm64/x64)、Windows (x64)。

打包版本不需要 Node.js；源码运行需要 Node.js >= 18。

### Q: 怎么启动？

```bash
openrelay start
```

检查运行状态：

```bash
openrelay status
```

默认监听端口：`18765`。

### Q: 怎么设置开机自启？

macOS：

```bash
openrelay service install
```

会创建 LaunchAgent，登录后自动启动。

---

## 连接与配置

### Q: 怎么连接 Claude Code？

方法一：一键配置

```bash
openrelay config set-app claude-code claude-sonnet-4-6
```

方法二：手动设置环境变量

```bash
export ANTHROPIC_BASE_URL=http://localhost:18765
export ANTHROPIC_API_KEY=unused
```

### Q: 怎么连接 Cursor / Windsurf / Cline？

```bash
openrelay config set-app cursor claude-sonnet-4-6
openrelay config set-app windsurf claude-sonnet-4-6
```

或在对应 IDE 的设置中，将 API Base URL 指向 `http://localhost:18765`。

### Q: 怎么查看当前配置？

```bash
openrelay config list
```

---

## Provider 与配额

### Q: 怎么添加免费 Provider？

```bash
openrelay provider add
```

交互式引导添加。推荐优先添加：
- **Groq** — 14,400 次/天，Llama 3.3 70B，速度极快
- **Cerebras** — 100万 token/天，Llama 70B
- **Google AI Studio** — Gemini 系列，免费额度大
- **SambaNova** — Llama 405B，200K token/天

### Q: 免费配额用完了怎么办？

OpenRelay 会自动切换到下一个可用 Provider（failover）。如果所有 Provider 都限流，等几分钟后会自动恢复。建议多注册几个 Provider，配额叠加更稳。

### Q: 怎么查看各 Provider 状态？

```bash
openrelay provider list
```

或打开 Web 管理面板：`http://localhost:18765`。

---

## 报错排查

### Q: `impit not available (Cannot find module 'impit/index.wrapper.js')`

**这是正常的提示信息，不是错误。**

impit 是可选的 Chrome TLS 指纹模拟库，用于绕过 CloudFlare 的 JA3/JA4 检测。没有它，OpenRelay 会自动降级到原生 fetch，**不影响正常使用**。

不需要手动安装 impit。只有在使用 Claude Desktop provider 时遇到持续 403 错误才需要关注。

### Q: `connection refused localhost:18765`

OpenRelay 没有运行。启动它：

```bash
openrelay start
```

如果已经启动但仍报错，检查端口是否被占用：

```bash
lsof -i :18765
```

### Q: `401 Unauthorized`

API Key 过期或无效。检查对应 Provider 的 Key：

```bash
openrelay config list
```

如果是 Claude Code 的 OAuth token 过期：

```bash
claude auth login
```

重新认证后，OpenRelay 会自动读取新 token。

### Q: `rate limit exceeded`

当前 Provider 配额用完了。OpenRelay 会自动切换到下一个可用 Provider。

如果所有 Provider 都限流：
1. 等几分钟后重试
2. 添加更多 Provider：`openrelay provider add`
3. 检查是否有 Provider 的 Key 失效了：`openrelay provider list`

### Q: `403 Forbidden`（CloudFlare 拦截）

部分 Provider（如 Claude Desktop）使用 CloudFlare 防护。OpenRelay 会自动刷新 Cookie 并重试。

如果持续 403：
1. 确认 impit 是否已加载（启动日志中查看）
2. 尝试重启 OpenRelay：`openrelay restart`
3. 清除 Cookie 缓存后重试

### Q: `ECONNRESET` 或 `socket hang up`

网络不稳定或 Provider 服务端断开连接。通常是临时问题，OpenRelay 会自动重试。

如果频繁出现：
1. 检查网络连接
2. 检查是否需要代理（`openrelay config set proxy http://...`）
3. 切换到其他 Provider

### Q: 启动时报 `EADDRINUSE`

端口 18765 已被占用。可能是另一个 OpenRelay 实例在运行：

```bash
openrelay status
# 如果显示已运行，不需要再次启动

# 如果要强制重启
openrelay restart
```

---

## IDE 集成

### Q: Claude Code 显示 `model not found`

确认 OpenRelay 已启动且模型名称正确：

```bash
openrelay status
curl http://localhost:18765/v1/models
```

确保环境变量设置正确（`ANTHROPIC_BASE_URL` 和 `ANTHROPIC_API_KEY`）。

### Q: Cursor 连不上 OpenRelay

1. 确认 OpenRelay 已启动：`openrelay status`
2. 在 Cursor Settings → Models 中设置：
   - API Base URL: `http://localhost:18765/v1`
   - API Key: `unused`（任意值即可）
3. 测试连接：`curl http://localhost:18765/v1/models`

### Q: 响应速度很慢

1. 检查当前使用的 Provider 和模型：大模型（如 405B）比小模型慢
2. 切换到速度更快的 Provider（Groq、Cerebras 速度最快）
3. 检查网络延迟（`ping` 对应 Provider 的域名）

---

> 最后更新：2026-03-11
>
> 如果你的问题不在列表中，请到 [GitHub Issues](https://github.com/romgX/openrelay/issues) 提问，我们会及时补充到本文档。
