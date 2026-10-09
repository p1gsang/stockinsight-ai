# StockInsight AI｜最终提交入口

同花顺 2027 届校园招聘 · AI 产品经理（AIME 金融智能 Agent 方向） · 题目 03：个股多维诊断与证据验证。

StockInsight AI 面向需要核验公司经营信号的研究者，围绕美的集团提供自然语言研究、动态诊断维度、确定性财务指标、结构化证据、来源钻取与上下文追问。事实、推断与未知分别呈现，支持继续研究，不提供买卖建议。

- [公网产品](https://stockinsight-midea-research.eagercomet2.chatgpt.site/)
- [公开源码仓库](https://github.com/p1gsang/stockinsight-ai)
- 生产功能版本：19；[源码与部署对应关系](docs/final-validation/version-provenance.json)。本次只整理交付材料，生产代码保持不变。
- **本人整体复核：通过。** 确认记录日期：2026-10-09（America/New_York），依据候选人直接确认，由 Codex 代录；[查看复核记录](CANDIDATE_REVIEW_CHECKLIST.md)。

## 体验路径

打开产品 → 输入美的现金流研究问题 → 查看诊断维度与证据 → 展开原始字段、单位、期次和 PDF 页码 → 加入上下文继续追问。公开财报可直接查看；真实 AI 研究使用另行私下提供的独立评审口令。

当前 Groq 解释受免费日额度限制，页面会明确显示规则降级；行情与估值保留未知。具体运行状态、测试和覆盖范围统一见测试报告与限制说明。

## 材料索引

|材料|入口|
|---|---|
|安装、环境变量、架构及指标口径|[README.md](README.md)|
|产品设计与取舍|[PRODUCT_DESIGN.md](PRODUCT_DESIGN.md)|
|数据来源与统计口径|[DATA_SOURCES.md](DATA_SOURCES.md)|
|实际测试、题目逐项验收与验证边界|[TEST_REPORT.md](TEST_REPORT.md)|
|AI 使用与验证记录|[AI_USAGE_AND_VALIDATION.md](AI_USAGE_AND_VALIDATION.md)|
|完整审计记录|[AUTO_AUDIT_REPORT.md](AUTO_AUDIT_REPORT.md)|
|当前限制|[LIMITATIONS.md](LIMITATIONS.md)|
|本人复核通过记录|[CANDIDATE_REVIEW_CHECKLIST.md](CANDIDATE_REVIEW_CHECKLIST.md)|
|120 秒演示脚本|[DEMO_SCRIPT.md](docs/final-submission/DEMO_SCRIPT.md)|
|自动执行记录|[final-results.json](docs/final-validation/final-results.json)|
|原始财报 / 产品值 / 独立复算|[财报核对表](docs/final-validation/financial-verification.md)|

源码仓库为主要代码入口，ZIP 为集中备份。包内含源码、文档、脱敏验证证据与演示脚本，不含凭证、依赖缓存或完整财报 PDF。视频未录制。机器验证与本人整体复核分别记录，自动测试状态保持原始结果。
