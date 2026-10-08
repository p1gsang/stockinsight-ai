# 真实测试记录

日期：2026-10-08。环境：Windows / Node 24.19.0 / Python 3.12。全部结果来自实际执行。

| 验证 | 命令 / 方法 | 实际结果 |
|---|---|---|
| 指标、证据、AI 约束、主链路、共享额度与异常 | `npm test` | 本轮 156 passed，0 failed，0 skipped |
| 财报采集与原始 PDF 核验 | `python -m pytest -q` | 6 passed，0 skipped |
| 真实 HTTP 主链路 | `python tools/smoke_http.py`（本地服务已运行） | 8 checks passed |
| 类型检查 | `npm run typecheck` | 通过 |
| 产品代码 lint | `node node_modules/eslint/bin/eslint.js app components/research-app.tsx lib/research lib/runtime-env.ts lib/types.ts` | 通过 |
| 生产 Worker 构建 | Sites build helper 调用 `npm run build` | 通过；包括 `/`、`/api/research`、`/api/status` |
| 首页 | HTTP GET `http://127.0.0.1:5173/` | 200，实际返回中文产品页面 |

## 覆盖的关键场景

最新追加：94 个问题路由用例全部通过，覆盖 12 个页面快捷入口、先前真实模型返回的追问、其他公司切换、零宽 / 全角变体和禁止建议；另验证所选证据及历史保留、不可用模型追问的透明替换、Retry-After 秒数 / HTTP 日期 / 无效值处理。离线结果见 docs/question-routing-verification.json。三项真实 Groq 本地验证见 docs/question-routing-llm-local.json；不同于普通 npm test，不将规则成功计为模型成功。

本轮新增的研究边界回归与真实模型调试见 [TRUST_BOUNDARIES.md](TRUST_BOUNDARIES.md)。下方 HTTP、浏览器及版本 4 的记录来自之前实际执行，不能当作本轮新版的重复验收。

- 同比正负值、缺失、字符串、零或负基数；覆盖代理和归母盈利比率。
- 独立验证行情区间收益、日对数收益样本波动率年化及最大回撤；无效价格 / 重复日期拒绝。
- 不同问题采用不同研究维度；制造业指标清单。
- 来源 / 原始字段 / 单位 / 时间；同半年口径；未来披露过滤；过期状态。
- 事实、方向、未知独立处理；经营信号张力与同字段来源冲突区分；冲突数字不进入正常派生结论。
- 模型不存在的 ID、裸数字、中文百分比、FACT 冒充、投资建议、无效 JSON、HTTP 错误、缺少密钥。
- 两阶段模型 Mock（规划 + 解读）；非法规划明确降级；上下文证据与历史保留，伪造 ID 拒绝。
- 实际 HTTP：页面、连接状态、研究、追问、维度切换、合规、非法期次 400、缺少数据密钥 503。

## 浏览器实际操作

使用 Codex 浏览器工具操作本地运行页面。已检查默认布局、现金覆盖证据的公式及两条原始输入、加入追问上下文并继续研究、估值问题的维度切换、同行表、证据搜索、买入问题拦截及授权数据模式失败。

页面保留旧结果时会显示“本次研究未完成”和上一次问题，不把失败请求当作新结论。

## 重要限制

- 真实 Groq 验证独立于 TEST_ONLY 单元测试，详见下方新增记录与 LLM_INTEGRATION.md。自动格式检查不证明语义或因果正确。
- **扶摇成功授权调用未验证。** 实际无密钥调用 HTTP 200，但业务码为 2003 / Missing X-api-key。已按业务码处理，未误判成功。
- iFinD 未授权；海尔财报未接入；行情 / 估值的真实接口返回尚未验证。
- 缓存中的三份原始 PDF 位于忽略目录。新机器运行 pytest 前若未采集原始 PDF，会有三项带原因的 skip；先运行采集器可完成复核。
- 没有负载测试、独立安全审计或候选人亲自复核。公网发布的实际状态另见 DEPLOYMENT.md。

## Groq 接入补充验证

44 项 Node 测试覆盖新增的严格 Schema 数量 / 数字约束、Groq 参数、截断、429 冷却、单位冲突、IP / 全站请求与并发限制、Token 预留 / 结算、长中文上下文，以及未知原因不得混入已验证推断。共享额度测试在真实 SQLite 中应用项目迁移，重建独立请求处理器，检查跨处理器计数、并发租约所有权、Token 结算、共享冷却和数据库故障关闭；没有调用假模型冒充真实验收。

本地实际 GPT-OSS 120B 已完成财务问题与所选证据追问，两次研究各有两次真实响应：第一项 4,586 Token，追问 4,968 Token；脱敏记录见 docs/llm-local-verification.json。普通 npm test 不会调用免费模型。

公网版本 4 在 2026-10-08 完成完整实际验收，记录见 [docs/llm-public-verification.json](docs/llm-public-verification.json)：

| 公网真实调用 | 结果 | 实际 Token |
|---|---|---:|
| 财务分析与维度规划 | llm / active；quality、trend；两阶段校验通过 | 4,495 |
| 所选现金覆盖证据追问 | 保留证据 ID 和两轮历史；未知原因独立标记 UNKNOWN | 4,729 |
| 缺少行情的估值与同行问题 | valuation、industry；缺失估值保持 UNKNOWN | 2,791 |

另外七项公网检查通过：配置及共享额度绑定状态、未授权 401、非法期次 400、扶摇缺凭证 503、建议拦截、连续未授权请求 429 且带 Retry-After、首页无提供商密钥。每项真实研究均记录提供商响应 ID、时间、模型名和 usage，未使用 Mock。

首次公网测试曾发现内存限流未拦住连续请求；本轮改用 D1 后重新完整执行并通过，不把先前失败记录改成成功。额度数据库绑定 DB，部署后已核对 research_quotas / research_leases 两表存在。`npm run db:local` 也实际成功应用同一迁移。

公网 Edge 浏览器也已实际刷新、填写独立口令并点击“开始研究”。页面显示“Groq · 本次调用成功”和三项 AI 解读；展开研究过程显示规划 / 解读为 llm、Groq / openai/gpt-oss-120b，以及通过校验时间 2026-10-08T20:26:53.420Z。截图保存在项目外的 stockinsight-groq-success.png，不含 API Key 或站点口令。首页刷新后保持“已配置 · 待调用”，没有把初始规则摘要算作真实模型成功。

## 研究边界修复版本

本轮 58 项 Node、6 项 pytest、TypeScript、变更代码 ESLint 通过。本地实际 HTTP 确认建议止损返回 restricted、宁德时代问题返回 out_of_scope、伪造证据 ID 返回 HTTP 400 / INVALID_CONTEXT，均未发出模型请求。

真实 Groq 回归完成三项：[docs/llm-trust-local-verification.json](docs/llm-trust-local-verification.json)。财务规划与分析 4,545 Token，所选证据原因追问 4,605 Token，估值缺失 2,182 Token；均为 llm / active、真实两阶段响应并通过校验。原因追问保留两轮历史与所选证据，缺少原因资料时只生成 UNKNOWN。

本轮调试失败和修正完整说明见 TRUST_BOUNDARIES.md。公网修复版本另以发布后实际验收记录为准，不把本地检查称作公网检查。

额外真实回归见 [docs/llm-trust-extra-local-verification.json](docs/llm-trust-extra-local-verification.json)：复用一次公网历史的原因追问通过；明确询问现金覆盖数值时，模型引用正确指标，由服务器渲染为 1.42 倍。版本 6 一次公网原因追问 HTTP 400 已如实记录，修复后的完整公网验收见下一节。

## 版本 7 公网最终验收

部署 `appgdep_6ac81c896d8c8191ba080d86946814be` 原生结果 succeeded，功能源码 `551d9deaeb18e0bf82b5d9b40b7ac343eb098e3a`。全部实际通过，完整记录见 [docs/llm-trust-public-verification.json](docs/llm-trust-public-verification.json)。

| 真实 Groq 场景 | 实际 Token | 结果 |
|---|---:|---|
| 财务分析与维度规划 | 4,696 | 两阶段 llm / active；引用及有限关系校验通过 |
| 所选现金覆盖证据的原因追问 | 3,518 | 保留证据与两轮历史；待验证原因 UNKNOWN |
| 估值缺失 | 1,836 | 缺少估值保持 UNKNOWN |
| 明确询问覆盖代理数值 | 4,708 | 正确指标绑定，服务器渲染 1.42 倍 |

另外九项检查通过：公网模型配置与共享额度、未授权 401、非法期次 400、扶摇缺凭证 503、交易建议拦截、其他公司范围拒绝、伪造证据 400、共享入口 429 / Retry-After、首页无提供商密钥。四次研究各包含两个真实提供商响应，有实际模型名、响应 ID、时间和 Token usage。未将版本 6 的失败改写为成功。

后续只补充文档和验收 JSON，不修改已验收功能。58 项 Node、6 项 pytest、类型与 lint、生产构建及密钥扫描均已通过；自动核验仍不代替候选人的语义和财报人工复核。
