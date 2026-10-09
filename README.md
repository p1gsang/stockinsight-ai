# StockInsight AI · 个股多维诊断与证据验证

面向需要核验公司经营信号的研究者，围绕美的集团 000333.SZ 提供自然语言诊断、确定性指标、可追溯证据与上下文追问；格力为公开财报参考同行。

[Web 产品](https://stockinsight-midea-research.eagercomet2.chatgpt.site/) · [源码仓库](https://github.com/p1gsang/stockinsight-ai) · [最终提交入口](SUBMISSION.md)

生产功能版本 19。本人整体复核已于 2026-10-09 确认通过，由 Codex 按候选人直接确认代录，见 [复核记录](CANDIDATE_REVIEW_CHECKLIST.md)。

## 核心产品

- 中文研究工作台，按问题选择经营质量、财务趋势、估值、行情、行业、事件等不同维度。
- 美的 2024–2026 H1、格力 2025–2026 H1 的真实公开会计事实；可选研究期次。
- 程序计算同比、归母盈利比率、现金覆盖代理与经营信号张力；数值不依赖模型自由生成。
- 事实 / 推断 / 未知与正面 / 负面 / 矛盾 / 方向未知独立分类。中性事实不会被错误归为信息缺失。
- 结论引用可以打开证据抽屉：原始字段、数值、单位、报告期、披露时间、获取时间、来源页、公式。
- 选择证据继续追问，保留当前问题、维度、已选 ID 与最多四次历史；服务端重新查证 ID，不接受客户端注入的金融数字。
- 财务趋势图、同行表、证据筛选 / 搜索、研究 JSON 导出、数据状态与来源页。
- 扶摇财务 / 估值 / 前复权日线的服务端适配器；未授权时主动报错，无模拟降级数据。
- 可配置的真实两阶段 LLM：结构化规划 → 数据和计算 → 结构化解释。有限语义错误最多由真实模型修正一次，再完整校验；数字初稿被丢弃，禁止建议、伪造 ID 和接口失败不能绕过。缺配置或失败时显示规则研究，不冒充 AI。

选择美的是因为财报丰富、制造业经营逻辑明确，且利润兑现、现金回收、营运效率与多元业务可比性有实际研究价值。该 MVP 不做全市场选股。

## AI Native 设计及职责边界

```mermaid
flowchart LR
 Q[自然语言问题] --> P[研究计划 / 维度和指标]
 P --> S[真实数据及标准化]
 S --> C[确定性指标计算]
 C --> E[结构化证据]
 E --> A[LLM 解读 / 规则降级]
 A --> V[引用和数字校验]
 V --> UI[结论与证据钻取]
 UI --> F[选证据继续追问]
 F --> P
```

LLM 理解意图、组织维度、解释证据，并从相关核验问题库选择追问；程序处理数字、单位、期次、缺失、冲突、来源映射和校验。家电制造业优先考虑利润兑现与营运资金；不套用银行资本充足率等不适配指标。

规划输出经 Zod 白名单约束，指标需求由维度确定，数据层按计划请求对应数据。解释仅允许 INFERENCE / UNKNOWN，不能把模型文本当成客观事实。模型数字必须用 `{{evidence_id}}` 绑定服务器已计算值，且紧邻对应的指标名称；动态 Schema 只允许当期已知证据的数值占位符。不存在的 ID、裸数字、指标错配、已覆盖的同比方向或增速比较矛盾、禁止建议及无效 JSON 会被拦截，并明确降级为规则说明。

**引用、数字与有限关系校验不是语义正确性证明。** 因果与其他解释仍需人工核验。提示注入内容按不可信数据处理；金融建议与研究对象识别使用保守规则，不能承诺识别所有改写表达。无法识别的研究对象会提示范围不符，需明确美的集团或所选证据上下文。

## 当前六维覆盖

| 维度 | 实际覆盖 | 限制 |
|---|---|---|
| 经营质量 | 利润、现金流、ROE、覆盖代理、归母盈利比率 | 全文新增应收、存货、应付期末余额及现金流调节；毛利率仍缺 |
| 财务趋势 | 三个美的半年期、同口径同比 | 2024 H1 缺 2023 同期，不生成同比 |
| 估值 | 适配器和未知状态 | 无凭证，真实 PE/PB 尚未获取 |
| 行情 | 统计函数和适配器 | 无真实日线，不绘制占位曲线 |
| 行业位置 | 美的 / 格力同半年口径 | 海尔尚缺，样本不表示行业排名 |
| 事件与风险 | 半年报披露的汇兑与衍生工具分类线索 | 新增非经常性损益明细与勾稽；持续影响未知，无新闻库 |

## 架构与技术选择

React + Vinext / TypeScript、Recharts、Zod、Cloudflare Worker 兼容服务端；Python + pypdf 负责可重复财报采集与原文核验，pytest 验证财报，Node 原生 test 验证实际服务端逻辑。

原需求优先 Python / Streamlit。为复用当前已可用的公网托管并提高证据钻取体验，选用单体 React / Worker。D1 仅保存共享额度计数、盐化 IP 哈希和短期并发租约，不保存金融研究内容或用户会话。正式指标与 Web 服务端在 JavaScript 中执行，不应写成由 Python 完成全部指标。

```text
app/                    页面、样式、research/status API
components/research-app.tsx  中文交互研究页面
lib/research/
  providers.mjs         公开快照及扶摇接口 / 标准化
  metrics.mjs           确定性计算、时效、冲突
  evidence.mjs          证据对象与字段映射
  planner.mjs           维度和指标白名单 / 规则降级
  llm.mjs               两阶段模型及输出校验
  service.mjs           研究编排与追问上下文
lib/runtime-env.ts      请求级服务端凭证上下文
data/public_reports.json    主要指标与来源
data/report_supplement.json  原始全文字段、页码与勾稽
tools/                  采集、私密本地配置、HTTP 检查
tests/                  Node 与 pytest
build/, scripts/        Sites 构建和兼容运行脚本
```

## 来源、授权及口径

正式默认数据均来自上市公司公开报告，采集于 2026-10-08。不是测试样本、LLM 数值或实时行情。

| 来源 | PDF 页 | 覆盖 |
|---|---:|---|
| [美的 2026 H1 摘要](https://static.cninfo.com.cn/finalpage/2026-08-29/1225531403.PDF#page=2) | 2 | 2026、2025 同期 |
| [美的 2025 H1 全文](https://static.cninfo.com.cn/finalpage/2025-08-30/1224626720.PDF#page=7) | 7 | 2025、2024 同期 |
| [格力 2026 H1 全文](https://static.cninfo.com.cn/finalpage/2026-08-27/1225515004.PDF#page=7) | 7 | 2026、2025 同期 |
| [美的 2026 H1 全文](https://disc.static.szse.cn/disc/disk03/finalpage/2026-08-29/df25443f-d67a-4cc5-8bd6-6c3e681a9575.PDF#page=177) | 96 / 97 / 177 / 204 | 期末余额、两期现金流调节与非经常性损益，共 43 条字段 |

公开仓库只保存少量会计事实、来源、时间和 SHA-256，不分发完整报告。完整原文下载位于被忽略的 `.sites-runtime/reports/`。公开可访问不等同任何用途都获授权；报告文本版权仍归权利人，商业使用需另行核实。

[扶摇官方文档](https://fuyao.aicubes.cn/docs/) 已阅读。实际无密钥请求返回 HTTP 200、业务码 2003 / Missing X-api-key；不能仅以 HTTP 判断成功。接入使用 `X-api-key`。新闻和部分能力有额外限制，本项目没有绕过权限。账户授权范围、展示及再分发许可仍待账户持有人核实；live 结果不落盘、不进入公共快照。iFinD 未授权，未宣称接入。

快照需手动采集更新；采集时间超过七天提示陈旧，报告期末超过两百天提示历史报告。报告期末、披露时间、采集时间各自保存。选择过去报告期只是按期研究，不是严格历史回测；历史比较采用当前可获得的披露版本，不能宣称无重述前视偏差。

### 指标定义

- 同比 = `(本期 / 上年同半年 - 1) × 100`。缺失或非正基数返回未知，不补零。
- 归母盈利比率 = `归母净利润 / 营业收入 × 100`，不冒称合并净利率。
- 现金覆盖代理 = `合并经营现金流 / 归母净利润`。分子含少数股东相关现金流、分母只归母，不能当成合并净利润现金含量。
- 经营张力 = `利润同比 - OCF 同比`，不同信号的差异不等于来源冲突或造假。
- ROE 使用半年报披露的加权平均值，不自行年化。
- 历史价格涨跌幅 = `末收盘 / 首收盘 - 1`；波动率 = 日对数收益率样本标准差 `× √252`；最大回撤 = `min(收盘 / 此前最高收盘 - 1)`。
- 行情适配器要求 `forward` 前复权，不含现金分红再投资，不视为完整投资总回报。需要至少三条有效有序日线，拒绝不合法日期、未来价格、相邻间隔超过十四个自然日，以及长区间内覆盖过疏的样本。这是保守筛查；未接交易日历，不能证明所有交易日完整，停牌和短缺口需单独核验。
- PE TTM、PB MRQ 保留上游口径；非正值不进入低估排序。估值时间戳为上游最大元数据时间，不表示全部字段完全同步。

## 运行

需要 Node >=22.13，建议 24 LTS；Python >=3.11 用于采集和 pytest。

```powershell
npm ci
npm run dev
# http://127.0.0.1:5173/
```

首次获取源码：`git clone https://github.com/p1gsang/stockinsight-ai.git`，然后 `cd stockinsight-ai`。无密钥启动用于快照与规则研究；服务端配置真实 Groq 后才启用模型，不能把默认规则运行当作真实 AI 验收。

快照已经包含在代码中，无密钥可运行。Python 仅在需要采集或核验时安装：

```powershell
python -m pip install -r requirements-dev.txt
python tools/collect_reports.py
python tools/enrich_reports.py
```

采集器严格按原表单位、公司名、年份和必需行提取。下载失败会报错，不能替换成生成数据。重复披露原值全部保留，存在差异时记录冲突。

### 安全配置

```powershell
Copy-Item .env.example .env.local
# 在本地编辑 .env.local，填写已有凭证；不要在聊天发送
python tools/configure_local.py
# 该助手只在 .dev.vars 不存在时创建；之后直接编辑私密 .dev.vars
npm run dev
```

Worker 本地开发从 `.dev.vars` 读取私密运行配置；改配置后重启。`.env.local` / `.dev.vars` / 构建产物 / 缓存均被忽略。不能使用 VITE_ 或 NEXT_PUBLIC_ 名称保存秘密。

启用本地 HTTP 模型调用前，使用 `npm run db:local` 初始化本地额度表；公网部署由 Sites 应用 Drizzle 迁移。额度存储未就绪时返回 503 并停止模型调用。直接运行 `tools/smoke_llm.mjs` 的服务级验证使用进程内保护，不替代公网共享限流验证。

| 变量 | 用途 |
|---|---|
| FUYAO_API_KEY | 扶摇 API 凭证 |
| LLM_API_KEY | 兼容 Chat Completions 的模型凭证 |
| LLM_BASE_URL | Groq：`https://api.groq.com/openai/v1` |
| LLM_MODEL | 当前 `openai/gpt-oss-120b`（通过 Groq 调用） |
| RESEARCH_ACCESS_CODE | 保护授权数据和免费模型额度的独立站点口令 |

真实模型使用 Groq 免费 API，复用现有适配器；Gemini 兼容接口作为手动备选，尚未实测。提供商、JSON 约束、实际失败与修正、额度和完整验证命令见 [LLM_INTEGRATION.md](LLM_INTEGRATION.md)。

公开入口不会索取 API Key。配置模型或使用 live 数据时要求独立访问口令，口令只在浏览器内存保留。D1 在不同 Worker 请求间共享限制：每 IP 每分钟八次入口；模型研究每 IP 每分钟三次、UTC 每天四十次；全站同时一项、每分钟六项、每天一百项，并预留 Token 预算及共享提供商 429 冷却。窗口为固定分钟和 UTC 日，提供商账号额度仍是最终边界，未启用付费回退。


## 验证与交付

~~~powershell
npm test
python -m pytest -q
npm run typecheck
npm run build
~~~

本次实际自动结果：196 项 Node、8 项 pytest、14 项故障注入通过；独立财报核验 190 项通过、7 项尚待验证。命令、日期、日志与题目逐项对照见 [TEST_REPORT.md](TEST_REPORT.md)。独立 PDF 审计依赖安装命令：python -m pip install -r requirements-audit.txt。

真实 Groq 已接入；当前解释阶段受免费日额度限制，页面透明显示规则降级。实时行情、估值与 iFinD 尚未接入，保留 UNKNOWN。完整覆盖范围见 [LIMITATIONS.md](LIMITATIONS.md)，自动验证与本人整体复核分别记录。

正式材料见 [SUBMISSION.md](SUBMISSION.md)，包含产品设计、数据来源、AI 使用记录、测试说明、审计证据与演示脚本。完整 PDF、服务端 Secrets、依赖和缓存不进入公开仓库或 ZIP。评审口令通过私下授权渠道交付。

本工具仅供研究辅助，不输出确定性涨跌预测、收益承诺或直接买卖建议。
