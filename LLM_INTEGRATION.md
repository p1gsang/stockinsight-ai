# Groq 真实 LLM 接入与验证

2026-10-08。保留 React / Worker、财报数据、确定性计算、证据钻取和追问架构；复用现有 Chat Completions 适配器，没有引入模型 SDK 或另建服务。

## 提供商与配置

优先试用了 Groq `openai/gpt-oss-20b`，发生过成功调用，也出现核验问题数量越界、裸数字和未知结论漏引用，均被拦截。最终配置为同免费档支持严格结构化输出的 `openai/gpt-oss-120b`，配合更明确的占位符示例及解读阶段 medium reasoning。模型名称中的 `openai/` 是 Groq 托管模型标识，不需要 OpenAI API Key。

| 服务端变量 | 配置 |
|---|---|
| LLM_API_KEY | Groq Key，标记为 Secret |
| LLM_BASE_URL | `https://api.groq.com/openai/v1` |
| LLM_MODEL | `openai/gpt-oss-120b` |
| RESEARCH_ACCESS_CODE | 独立随机访问口令，标记为 Secret |

生产变量通过 Sites 服务端 Secrets 配置。`.env.local`、`.dev.vars`、`.sites-runtime/` 被 Git 忽略；不使用 VITE_ / NEXT_PUBLIC_ 保存秘密。页面只接收独立访问口令，刷新清除，API Key 不传入前端。

Gemini 作为手动备选：将同一 LLM_API_KEY 换为 Gemini Key、base 换为 `https://generativelanguage.googleapis.com/v1beta/openai`、model 换为账户可用的免费模型，例如 `gemini-3.5-flash-lite`。目前没有 Gemini Key，**未进行 Gemini 实测，也没有静默自动切换到另一提供商**。新项目不默认选已限制新用户访问的 Gemini 2.5 模型。

## JSON、引用与数字

- 两阶段都使用 `response_format.type=json_schema`、`strict=true`、required 字段和封闭对象；数量、长度限制同步到模型 Schema。
- 解读按 INFERENCE / UNKNOWN 的 `anyOf` 分支限制已知 / 未知引用。默认采用定性解释；明确询问数值时，Schema 只允许服务端提供的完整“指标标题为 `{{evidence_id}}`”表达。未知原因不能变成数值或混进已验证推断，服务端仍独立检查。
- Groq 实测仍出现 HTTP 400 / json_validate_failed，不能仅凭 strict 参数宣称所有输出一定正确。任何错误、拒绝、截断或校验失败都会明确降级为规则说明。
- 程序替换已经计算的完整显示值，不重复添加单位；不同单位追加会被拦截。现金覆盖代理的股东口径边界由服务端补充到校验说明。
- `model_usage` 记录实际响应 ID、提供商返回的模型名、时间和 Token 用量；只有规划、解读和校验都通过才显示“本次调用成功”。配置状态不是健康检查，首页初始规则摘要不触发匿名模型调用。
- 引用、指标绑定及已覆盖的同比方向 / 增速比较校验不能证明全部语义、因果或估值判断正确，仍需人工复核。研究边界审计、实际失败和修正见 [TRUST_BOUNDARIES.md](TRUST_BOUNDARIES.md)。

## 免费额度保护

Groq 官方当前公开基准：GPT-OSS 免费档每分钟 30 次、每天 1,000 次、每分钟 8,000 Token、每天 200,000 Token；真实额度以账号控制台为准。一次研究通常包含两次模型请求。

- 所有研究入口每 IP 每分钟最多八次，包括未授权请求；达到上限返回 429 和 Retry-After。
- 模型研究需要独立口令；每 IP 每分钟最多三次、UTC 每天四十次。
- D1 原子计数在不同 Worker 请求间共享；全站同时只处理一项模型研究，总计每分钟最多六次、UTC 每天一百次。并发租约有所有者和两分钟过期时间，失败也释放，旧请求不能释放新请求的租约。
- 模型请求在发出前按中文与其他字符估算输入并预留最大输出，固定分钟预算 7,200 Token、UTC 日预算 150,000；收到真实 usage 后结算。估算不是精确分词器，分钟边界允许突发，提供商最终执行账号级额度。
- 规划最多输出 900 Token，解读最多 2,000 Token；网络超时 25 秒。提供商 429 尊重 Retry-After 并冷却，不自动重试。

公网曾实际发现内存限流没有稳定拦截连续请求，因此改为 D1 共享计数。存储仅包含带服务端盐的 IP 哈希、计数和短期租约；过期计数按请求清理，不保存原始 IP、问题、API Key 或财务结果。D1 缺失或故障时停止调用，返回 503。服务级命令行测试仍使用进程内软保护，不能替代公网检查。

访问口令和提供商账号额度共同限制公开滥用；未启用付费升级、自动充值或收费回退。应用估算不是费用保证，也不能控制同一 Groq 组织中其他应用的消耗；正式开放仍需用户认证与监控。

## 可重复的真实验证

普通 `npm test` 的模型响应是明确标识的 TEST_ONLY 测试替身，验证编排和拒绝逻辑。真实验证必须显式运行，使用实际 Groq 网络请求：

```powershell
node --env-file=.env.local tools/smoke_llm.mjs
node --env-file=.env.local tools/smoke_llm.mjs --base https://stockinsight-midea-research.eagercomet2.chatgpt.site --valuation --output .sites-runtime/verification/llm-public.json
# 新增修复与数值表达验收：
node --env-file=.env.local tools/smoke_llm.mjs --base https://stockinsight-midea-research.eagercomet2.chatgpt.site --valuation --numeric --boundaries --output .sites-runtime/verification/llm-trust-public.json
```

检查财务问题的动态规划与解释、选择现金覆盖证据的原因追问、缺少行情时估值为 UNKNOWN、证据 ID 与数字校验、调用元数据，以及公网 401 / 400 / 503 / 429 与密钥不出现在响应中。不同研究之间等待分钟窗口，避免挤占免费 Token 额度。实际结果见 TEST_REPORT.md 与验证 JSON；未经执行不能标为通过。

可选 `--capture` 只用于本地诊断，将真实提供商响应保存到被忽略的目录，不替换模型输出；公网完整验证不使用它，覆盖生产限流。

## 官方资料

- [Groq OpenAI 兼容接口](https://console.groq.com/docs/openai)
- [Groq 结构化输出](https://console.groq.com/docs/structured-outputs)
- [Groq 调用额度](https://console.groq.com/docs/rate-limits)
- [Gemini 兼容接口](https://ai.google.dev/gemini-api/docs/openai)
- [Gemini 价格及免费档](https://ai.google.dev/gemini-api/docs/pricing)
- [Gemini 模型生命周期](https://ai.google.dev/gemini-api/docs/deprecations)
