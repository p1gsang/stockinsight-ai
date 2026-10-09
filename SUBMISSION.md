# StockInsight AI｜最终提交入口

同花顺 2027 届校园招聘 · AI 产品经理（AIME 金融智能 Agent 方向） · 题目 03：个股多维诊断与证据验证。

**产品定位：围绕美的集团的公开财报证据研究 MVP。** 从自然语言问题选择研究维度，将确定性指标、事实证据和模型解释分开，并支持沿原始字段、财报页码和所选证据继续研究。面向需要检查经营信号的研究者，不提供买卖建议。

- [公网产品](https://stockinsight-midea-research.eagercomet2.chatgpt.site/)
- [公开源码仓库](https://github.com/p1gsang/stockinsight-ai)
- 线上功能版本：19，功能源提交 `d1ff590263af946fa48b4f419914ff877550122f`；对应公开仓库功能提交 `cae11feca0cc281096ae8da6583a15fa4f9393bb`，文件树一致。之后仅补充文档、审计工具和记录，产品代码未变。具体清单见 [VERSION_PROVENANCE.json](docs/final-validation/version-provenance.json)。
- 快速体验：公开首页 → 财务概览 → 点击现金覆盖证据 → 查看公式、单位和 PDF → 加入追问上下文。真实 AI 研究需要私下交付的独立评审口令，绝不提交 API Key。

**提交边界：本次真实 Groq 规划成功，解释阶段 HTTP 429 / TPD，完整 AI 流程验收 FAIL。规则降级可使用，但不能作为真实 LLM 成功演示。行情和估值没有授权数据，显示 UNKNOWN。** 本次记录日期 2026-10-09（America/New_York）；机器日志保留 UTC 时间。

## 材料索引

|材料|入口|
|---|---|
|安装、启动、环境变量和架构|[README.md](README.md)|
|产品选择、Agent 流程与取舍|[PRODUCT_DESIGN.md](PRODUCT_DESIGN.md)|
|数据来源、期次、单位、统计口径|[DATA_SOURCES.md](DATA_SOURCES.md)|
|本次实际测试与历史记录区分|[TEST_REPORT.md](TEST_REPORT.md)|
|AI 工作、真实错误、修复与验证|[AI_USAGE_AND_VALIDATION.md](AI_USAGE_AND_VALIDATION.md)|
|完整自动审计及未解决问题|[AUTO_AUDIT_REPORT.md](AUTO_AUDIT_REPORT.md)|
|当前功能及数据限制|[LIMITATIONS.md](LIMITATIONS.md)|
|候选人必要复核，约 12 分钟|[CANDIDATE_REVIEW_CHECKLIST.md](CANDIDATE_REVIEW_CHECKLIST.md)|
|120 秒演示脚本；未录制视频|[DEMO_SCRIPT.md](docs/final-submission/DEMO_SCRIPT.md)|
|本次执行日志与响应|[执行记录](docs/final-validation/final-results.json)|
|财报原始值 / 产品值 / 独立复算|[独立核对表](docs/final-validation/financial-verification.md)|

ZIP 是额外备份，源码仓库是主要代码入口。完整 PDF、凭证、部署缓存及依赖不在包内；只保留公开会计事实、必要短引用、来源链接与哈希。打包摘要、安全扫描和文件 SHA-256 位于提交包 evidence/ 与 MANIFEST.sha256。

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
|12|真实 AI 使用与验证记录|PASS|自动工作、历史失败、本次失败与待本人签认分开记录|
|13|测试说明|PASS|本次日志、日期、命令、数量、Mock/本地/公网/人工范围分开；保留环境失败及处理|

候选人本人验收：**NOT TESTED，待本人签认**。可选演示视频：**NOT TESTED，未录制，仅脚本**。新环境从零安装：本次未重复执行；本地 HTTP 使用既有安装依赖，未宣称全新 npm 安装通过。

最终提交前优先事项：真实模型额度恢复后完成正式主链路复验；若截止前无法恢复，明确披露 FAIL，由候选人决定是否按当前边界提交。不要宣称全维度实时金融产品或全面验收通过。
