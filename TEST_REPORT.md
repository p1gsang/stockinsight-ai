> 本人复核状态更新：2026-10-09，候选人直接确认整体复核通过，由 Codex 代录；[确认记录](CANDIDATE_REVIEW_CHECKLIST.md)。本次未重跑测试，下面的自动执行时间与结果保持不变。

## 最终打包阶段实际重跑（2026-10-09 / America/New_York）

本次实际执行日志在 [docs/final-validation](docs/final-validation/final-results.json)，原始 UTC 时间与命令在 [regression-run.json](docs/final-validation/regression-run.json)。196 Node PASS / 0 FAIL / 0 SKIP；8 pytest PASS / 0 SKIP；类型、生产代码 lint、生产构建均 exit 0；14 项故障注入与 6 条历史错误文本回放通过。单元测试中模型为显式 TEST_ONLY / 注入传输，不当作真实模型验收。

四份新下载 PDF 独立核验 190 PASS / 0 FAIL / 7 UNVERIFIED；81 条证据的审计汇总 118 PASS / 0 FAIL / 4 UNVERIFIED。默认 Python 首次缺 pdfplumber，已保留失败日志；改用已有完整审计 Python 重跑成功。当前正式公网响应使用 public-final.json，审计工具已支持该文件，未把历史响应当成新调用。审计依赖：`python -m pip install -r requirements-audit.txt`。

隔离公共克隆 `node node_modules/vinext/dist/cli.js dev --port 5363`，再执行 `TEST_BASE_URL=http://127.0.0.1:5363 python tools/smoke_http.py`：8 PASS。依赖复用既有安装，没有重新 npm ci；服务已停止。首次误用不存在的生成 Worker 路径启动失败在执行记录披露。

公网 HTTPS 11 项有限边界/数据/上下文校验通过；三类真实禁止建议返回 restricted；真实 Groq 追问只执行一次，规划 response ID `chatcmpl-32b379e0-c234-4b06-9291-bc9cda3121e6`、902 tokens，解释 HTTP 429 / TPD、Retry-After 568 秒，完整主链路 FAIL。返回规则说明、所选 ID/历史与引用仍保留，不计 LLM 成功。实际浏览器 8 项有限交互通过，没有重复请求 UI 模型。

自动执行时本人复核尚未确认；现已由候选人直接确认整体复核通过，具体见顶部确认记录。可选视频未录制。过期、冲突、极端输入、错误 JSON、伪造 ID、接口失败和模型 429 的确定性覆盖见 Node/fault 日志。任意金融语义、全部合规改写和压力安全不在通过范围。以下为此前历史阶段记录，不是本次重跑。

## 2026-10-09 最新修复验收

功能版本 19 / d1ff590263af946fa48b4f419914ff877550122f：196 项 Node、8 项 pytest、类型检查、变更生产 lint、生产构建通过；14 项故障注入、6 项历史错误文本拒绝回放通过；匿名公开克隆另执行 196 项 Node 和 8 项无模型 HTTP 检查通过。独立财报 190 PASS / 0 FAIL / 7 UNVERIFIED；证据与交付 118 PASS / 0 FAIL / 4 UNVERIFIED。

**最终六条真实 Groq 公网流程均 FAIL：首项规划成功但解释 HTTP 429 / TPD，随后共享冷却。** 不是 Mock，也没有把规则降级计为成功；实际响应和日志关联都保留。代码修复通过不代表最终真实模型完整解释已验通。原始及各中间版本失败未删除。

逐项方法、输出文件、根因、修复和剩余风险见 [AUTO_AUDIT_REPORT.md](AUTO_AUDIT_REPORT.md) 与 docs/repair-validation/。所有以下较小测试数量和版本 13 成功均为历史记录，不能覆盖本段最终失败。候选人本人审核仍待签认。

## 历史功能版本 13 验收

最终功能版本 13 的四项真实公网 Groq 验证通过：财务规划与解释、所选证据扣非追问、事件入口、保留扣非主题的通用追问。共八次真实响应、16,585 Token，响应 ID 与 usage 保存在 docs/semantic-llm-public.json；这是一次有限场景验证，不是全面语义质量保证。历史预算、原因表述和数字绑定失败均保留，未写成全程成功。

169 项 Node、8 项原始财报 pytest、类型与变更 lint、生产构建通过；GitHub 独立克隆通过 169 项 Node / 类型 / 八项 HTTP 检查。原文复核含完整报告哈希和三项残差为零的勾稽。汇总见 docs/submission-risk-verification.json；以下按对应历史版本解释。

## 本轮最新语义与全文验收

169 项 Node、8 项 pytest、TypeScript 和变更代码 ESLint 通过。新增 13 项语义 / 来源 / 问题库检查，包含四条历史真实不支持输出；新增原始全文字段与哈希复核、三项勾稽检查。真实模型 Token 预算失败保留在 docs/semantic-llm-budget-failure.json；后续实际调用记录另存，不覆盖旧失败。完整 PDF 未采集时四项原文测试会明确 skip，先运行两项采集器可复核。以下为各版本历史验收记录。

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

功能版本 9 的三项公网真实 Groq 验证也通过，见 docs/question-routing-llm-public.json。新建 GitHub 仓库独立克隆后安装成功，156 项 Node、TypeScript 及八项 HTTP 主链路 / 异常检查通过。浏览器实际验证 429 倒计时、入口禁用、已有结果保留和冷却结束恢复；启动目录限制及源码一致性见 docs/delivery-verification.json。

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


## 对照题目 03

PASS 表示对应范围实际验证；PARTIAL 表示部分覆盖；FAIL 表示本次未满足；NOT TESTED 表示尚未执行。下表不把模型自评当作结论正确的证明。

|序号|要求|状态|实际依据与边界|
|---:|---|---|---|
|1|真实可访问、可操作的 Web|PASS|匿名首页 HTTP 200；实际浏览器操作证据、追问输入和数据页面|
|2|真实 AI Native 主链路|FAIL|已接 Groq GPT-OSS 120B，本次规划有真实 response ID；解释 TPD 429，未完成全链路|
|3|按公司类型和问题选择维度|PARTIAL|制造业规则路由及回归通过；本次真实规划通过一个追问场景，其余问题未重新跑真实模型|
|4|确定性计算、数据证据和 LLM 合理分工|PASS|数值计算与引用验证由服务端完成；规划和解释独立，失败明确降级|
|5|经营、财务、估值、行情、行业、事件及风险|PARTIAL|经营与财报、两公司同行、部分事件及风险可用；真实行情/估值/新闻未接入|
|6|正面、负面、矛盾与未知证据|PASS|证据矩阵可操作；确定性回归区分经营信号张力与来源冲突|
|7|事实、推断和未知区分|PASS|三类独立结构与校验；不表示任意解释的语义都正确|
|8|沿证据继续研究|PARTIAL|来源、期次、公式及所选 ID/历史保留通过；真实模型完整追问仍失败|
|9|关键数字可追溯|PASS|四份新下载 PDF 哈希通过，190 项独立核对通过，仍有 7 项 UNVERIFIED|
|10|异常与合规边界|PASS|限定测试范围：196 Node、14 故障注入、真实公网三类禁止建议和 429；不承诺覆盖所有改写攻击|
|11|源码仓库与 README|PASS|已存在的公开仓库，最终文件树与交付源码核对；安装启动方法及环境变量齐全|
|12|真实 AI 使用与验证记录|PASS|自动执行记录与候选人整体复核确认分别记录|
|13|测试说明|PASS|本次日志、日期、命令、数量、Mock/本地/公网/人工范围分开；保留环境失败及处理|

候选人本人整体复核：**PASS（2026-10-09，依据候选人直接确认，由 Codex 代录）**。可选演示视频：**NOT TESTED，未录制，仅脚本**。新环境从零安装：本次未重复执行；本地 HTTP 使用既有安装依赖，未宣称全新 npm 安装通过。

最终提交前优先事项：真实模型额度恢复后完成正式主链路复验；若截止前无法恢复，明确披露 FAIL，由候选人决定是否按当前边界提交。不要宣称全维度实时金融产品或全面验收通过。
