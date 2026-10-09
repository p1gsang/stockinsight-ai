# StockInsight AI 修复与自动验收报告

**结论：修复已部署，程序与财报回归通过；最新版本的真实 Groq 全链路验收仍为 FAIL，当前阻塞是提供商日 Token 配额。不能宣称已经全面验收通过。**

验收日期：2026-10-09，America/New_York；时间证据采用 UTC。执行主体为 Codex 和自动化程序，不是候选人本人审核。原始完整报告和缺陷复现保留在 [原始验收](docs/auto-audit/AUTO_AUDIT_REPORT.original.md)。人工必要抽查见 [HUMAN_REVIEW_CHECKLIST.md](HUMAN_REVIEW_CHECKLIST.md)，约 11 分钟，不要求本人运行测试。

## 1. 验收版本与实际交付

|项目|已验证对象|
|---|---|
|公网产品|[StockInsight AI](https://stockinsight-midea-research.eagercomet2.chatgpt.site)|
|公开仓库|[p1gsang/stockinsight-ai](https://github.com/p1gsang/stockinsight-ai)|
|原始冻结版本|`62141347a0a8e48d779ad9c3dad15463e38e22ac`，功能版本 14|
|最终生产功能源码|`d1ff590263af946fa48b4f419914ff877550122f`|
|相同源码树|`ee0aa1a793fb8324affdf7e6be78b4615e01c7a9`|
|GitHub 对应功能提交|`cae11feca0cc281096ae8da6583a15fa4f9393bb`；匿名克隆、文件树比对通过|
|生产版本|19；`appgprj_6ac7e1b683388191b105cb2014e84456~appgver_85490fea8658819197b0bffdcd517729`|
|生产部署|`appgdep_6ac89a335d348191a4246fafa82eec88`，succeeded，2026-10-09T07:39:41 UTC|
|Secrets revision|3；访问口令已轮换，Groq API Key 未写入前端或仓库|
|正式模型|Groq `openai/gpt-oss-120b`；没有改为 Mock 或冒充真实调用的 rules|

版本证据：[部署回执](docs/repair-validation/deployment-state.json)、[证据与交付检查](docs/repair-validation/evidence-delivery.json)。报告与验收材料形成于部署之后，后续材料提交不代表又一次功能验收；功能代码以本表固定提交为准。React / Worker 架构、原始财报金额及页面功能保留。

PASS 只证明对应断言；FAIL 表示实际观察失败；UNVERIFIED 表示证据不足。不同检查集有重叠，不相加为金融正确率。真实模型调用成功、JSON 合法、引用存在与金融结论有充分依据分别判断。

## 2. 原始 FAIL 的复现条件、根因与修复

完整原始请求、证据、响应和建议见历史报告。本轮在修改前读取了完整报告并对其失败项逐项定位。

|问题|实际复现条件与根因|已执行修复|当前验收状态|
|---|---|---|---|
|真实 Groq 上下文追问失败|选择 `E-MD-20260630-cash-coverage` 后问业务原因或计算口径。直接真实诊断获得 HTTP 400 `json_validate_failed`；嵌套 anyOf 分类 Schema 及误禁普通“季节性”的字符模式导致失败。另有未知/已知混引、超预算问题。|改为平面严格 JSON 传输 Schema，分类仍由服务端校验；保留全部所选 ID；压缩模型专用历史和证据；最多一次真实模型修正，重新校验完整结果。|机制回归 PASS；版本 15 两条公网追问曾成功；最终版本 19 两条追问因共享配额冷却 FAIL，尚不能关闭真实主链路验收。|
|AUD-C01：预测/建议拦截|冻结校验实际接受“美的下周肯定上涨。”，同义表达覆盖不足。|补充确定性价格预测、买卖操作和收益承诺的中英文表达；请求入口、模型输出均校验。|PASS，限定已执行用例；不声称形式化证明所有自然语言攻击都被拦截。|
|AUD-P01：日志口令|访问口令经 `x-research-access` 发送，平台请求头日志记录该值；原审计首次工具输出也曾未经脱敏。|口令改走 HTTPS JSON 请求体，研究/模型调用前剥离；忽略旧请求头；服务端 Secrets 轮换口令；日志仅记录允许的提供商调用元信息。|旧口令 401、新口令有效、当前日志扫描 PASS；历史平台日志删除/保留策略 UNVERIFIED。|
|AUD-S01：金额增速推断速度|原始经营质量输出用 OCF 金额同比推断“现金转化速度相对滞后”，没有周转天数或收款时点。|无时间类证据时拒绝回款/现金转化速度判断；同时拒绝用增速差直接推出现金支撑不足。|原始文本精确回放拒绝 PASS；自由语义整体仍 UNVERIFIED。|
|AUD-S02：未定义基准|原始输出“现金覆盖水平高于基准”没有基准来源；后续真实输出又出现“比例偏高”。|没有同口径 benchmark 证据时拦截基准、行业正常水平及覆盖比例偏高/偏低；代理定义不能归为公司披露。|原文及后续变体回放拒绝 PASS；当前公网新解释尚未因配额恢复而充分验证。|
|AUD-E01：全文来源冲突|注入同一公司/期次/口径的全文 OCF 与摘要不同值，原实现未将补充全文字段纳入冲突比较。|统一归一化 `bridge_ocf` 与 OCF 来源比较，冲突同时阻断原值与现金覆盖/同比/桥接派生值。|PASS；真实原文金额一致，不能把注入冲突写成当前公司财报矛盾。|
|AUD-E02：多选证据截断|选择 12 条证据时，原筛选顺序先占满上下文，部分已选 ID 没有对应模型数据。|先保留所选证据，再补主题与原因证据；预算不足则明确失败。|PASS，12 个所选 ID 全部保留。|
|AUD-E03：来源名称错误|9 个 SZSE 补充证据硬编码显示巨潮资讯。|按来源主机显示深圳证券交易所。|PASS，原始链接和金额不变。|

不支持的初稿不会作为正常结论发布。修正由真实模型完成，最多一次，可拆分混引的已知与未知结论；禁止内容、伪造 ID、无效 JSON、提供商错误不通过修正绕过。未绑定数字初稿可由模型重写，但原值被丢弃，修正结果仍须经过完整数字、引用、主题与关系校验。响应明确记录 `generation_repair`，不会把规则模板填充说成模型修正。

## 3. 实际回归测试

|测试项|实际结果|执行方法与证据|
|---|---|---|
|完整 Node 回归|PASS：196 通过，0 失败、0 跳过|执行 package.json 全部测试目标；[实际输出](docs/repair-validation/node-tests-v19.tap)。原 169 项，加本轮 27 项。|
|公开仓库独立克隆回归|PASS：196 通过|匿名浅克隆 `cae11fe…`，使用已安装依赖的目录联接，非重新 npm 安装；[输出](docs/repair-validation/github-node-tests.tap)。|
|真实 PDF pytest|PASS：8 通过，0 跳过|实际 PDF 存在；[输出](docs/repair-validation/pytest-v18.txt)。最后一轮仅改 LLM/审计脚本，财报采集和计算代码未变。|
|TypeScript|PASS：退出码 0|[类型检查](docs/repair-validation/typecheck-v19.txt)；空输出表示无诊断。|
|变更生产代码 lint|PASS：退出码 0|[lint](docs/repair-validation/lint-v19.txt)；限定实际检查的生产文件，不声称全仓任意历史文件均通过。|
|生产构建|PASS：退出码 0|[Vinext/Vite 构建](docs/repair-validation/build-v19.txt)。|
|隔离本地 HTTP|PASS：8 项|匿名克隆、端口 5363、无真实模型密钥；正常研究、上下文、动态维度、合规、缺密钥、非法期次等；[输出](docs/repair-validation/github-http.txt)。不计作真实 LLM 成功。|
|离线故障注入|PASS：14 项|缺财务字段、金融 HTTP 503/空数据/坏 JSON、无效模型 JSON/截断/伪造 ID、非法所选 ID、禁止建议与预测、Groq 429 冷却；[明细](docs/repair-validation/fault-injection.json)。TEST_ONLY 是异常分支测试替身，不是正式验收模型。|
|历史真实错误语句回放|PASS：6 项|AUD-S01、AUD-S02、v17 三条不支持文本、v18 未绑定数值精确回放；[明细](docs/repair-validation/semantic-replay.json)。这是拒绝行为证明。|
|公网边界|PASS：8 项及入口限流|实际请求缺口令、非法期次、缺扶摇凭证、伪造上下文、买卖建议、确定性预测、收益承诺；实际出现 429 / Retry-After；[明细](docs/repair-validation/http-boundaries.json)。|
|公网口令迁移|PASS：3 项|旧口令请求体 401；非秘密旧头测试值 401；新口令请求体 200/restricted；[明细](docs/repair-validation/access-transport.json)。没有把真实新口令放入请求头。|
|浏览器交互回归|PASS，限定观察|已实际打开证据抽屉、核对原始输入和 PDF 第 2 页、加入上下文、切换财务和同行；[记录](docs/repair-validation/ui-checks.json)。浏览器交互不冒称页面发起真实 AI 成功。|
|服务端日志交叉确认|PASS：6/6 入站关联；2/2 提供商尝试关联|[关联表](docs/repair-validation/log-correlation.json)、[脱敏日志](docs/repair-validation/worker-logs-v19.json)。一条规划成功及一条解释 HTTP 429；不是两条完整研究成功。|

原始工程在 Windows 上的 Sites 打包命令缺少 bash：源码提交和推送成功，打包步骤失败。使用同一官方 `prepare-site-build.cjs` 完成验证，再以原生 tar 打包部署，原生部署返回 succeeded。没有把环境打包失败写成测试通过。

## 4. 真实公网 Groq 测试与未解决的配额阻塞

所有正式场景均直接请求公网 `/api/research`，约 65 秒间隔，保存脱敏响应，不使用 Mock，不自动重试挑选成功样本。最终六场景文件：[public-llm.json](docs/repair-validation/public-llm.json)。

|最终版本 19 场景|实际结果|实际模型调用与限制|
|---|---|---|
|利润与现金流|FAIL|真实规划成功：`chatcmpl-fde92fa1-4bf5-425a-8e19-77d2743116f1`，663 Token；解释收到真实 HTTP 429，`quota_kind=TPD`，Retry-After 610 秒，明确 rules 降级。|
|经营质量|FAIL|共享额度处于冷却，未发出提供商调用；规则说明明确标识。|
|估值缺失|FAIL|共享冷却；规则维度 valuation / industry；不能把规则路由当作本次 LLM 规划成功。|
|行情缺失|FAIL|共享冷却；规则维度 market；缺失行情没有生成虚构统计值。|
|所选证据原因追问|FAIL|所选现金覆盖 ID 保留，但真实模型链路被共享冷却阻断。|
|计算口径上下文追问|FAIL|所选 ID 与历史保留，但真实模型链路被共享冷却阻断。|

独立提供商诊断确认是 **日 Token 配额 TPD**，Limit 200000、Used 199310、Requested 723；[脱敏证据](docs/repair-validation/provider-planner-quota.json)。不能把这个错误误称为 JSON 失败、仅 TPM 限流或模型未配置。公开状态仍如实显示 Groq 已配置，是否成功按请求显示。日配额来自实际错误；一般限制说明见 [Groq 官方限额文档](https://console.groq.com/docs/rate-limits)，不能将文档默认值代替账户实测。

本轮中间版本记录全部保留：

- [版本 15](docs/repair-validation/public-llm-v15.json)：六项中三项调用/结构 PASS、三项 FAIL；两条所选证据追问实际成功，利润/经营/行情另外暴露语义和规划问题。不是全链路全部通过。
- [版本 16](docs/repair-validation/public-llm-v16.json)：只执行首项，修正一条后另一条仍失败，已停止；其余五项没有执行，不能计为通过。
- [版本 17](docs/repair-validation/public-llm-v17.json)：三项调用/结构 PASS、三项 FAIL，另发现“偏高”“现金支持不足”和 UNKNOWN 断言调节方向，已新增拦截及精确回放。原 PASS 不等于语义全部正确。
- [版本 18](docs/repair-validation/public-llm-v18.json)：六项 FAIL，包含先前冷却、真实日配额 429 和未绑定“一倍半”被拦截；保留失败，没有用后续版本覆盖。
- [Groq 20B 兼容诊断](docs/repair-validation/groq-20b-compatibility.json)及[较大预算诊断](docs/repair-validation/groq-20b-compatibility-larger-budget.json)：分别出现 HTTP 400 和主题校验失败，未替换正式模型，未计作生产通过。Gemini 未测试。

最新模型完整解释、最终输出语义和追问恢复：**UNVERIFIED**；实际公网六场景成功标准：**FAIL**。规则降级、入站 HTTP 200 或只有规划 response ID 均不算真实研究成功。免费配额恢复或获得额外授权额度后，仍应由程序重新执行正式集；不要求候选人亲自跑测试。

另于 07:59 UTC 在冷却结束后只补做一次[真实上下文恢复观察](docs/repair-validation/public-context-recovery.json)，不覆盖正式六项失败：规划 845 Token、分析 2153 Token 均有真实 Groq response ID；分析初稿未被产品接受，进入 claim_repair 时再次 HTTP 429 / TPD、Retry-After 376 秒。所选 ID、实际引用和历史保留检查 PASS，但完整追问仍 **FAIL**。此失败响应未保留被拒初稿及其具体语义错误，具体文本 **UNVERIFIED**。[独立脱敏日志](docs/repair-validation/recovery-log-correlation.json)匹配两条成功响应；采样未返回失败修正的调用日志，该条日志关联 **UNVERIFIED**。不能将两条模型响应算作整链路成功。

## 5. 原始财报、独立复算与证据系统

最终功能提交再次独立下载四份官方 PDF，SHA256 一致，以 pdfplumber 读原文、Python Decimal 40 位精度独立复算；产品提取器使用 pypdf。未调用被测指标函数生成预期值。结果 **190 PASS / 0 FAIL / 7 UNVERIFIED**：[原始值/产品值/独立值并排表](docs/repair-validation/financial-verification.md)、[机器明细](docs/repair-validation/financial-verification.json)。原始来源名称 FAIL 已消除，金额未改。

|2026 H1 重点项目|原始值（千元）|产品标准值 / 指标|独立换算 / 复算|结果 / 物理 PDF 页|
|---|---:|---:|---:|---|
|营业收入|260042490|260042490000 元|260042490000 元|PASS；摘要 2 / 全文 98|
|归母净利润|26446037|26446037000 元|26446037000 元|PASS；2 / 98|
|经营现金流净额|37552090|37552090000 元|37552090000 元|PASS；2 / 99 / 177|
|扣非归母净利润|19595179|19595179000 元|19595179000 元|PASS；2 / 204 勾稽|
|现金覆盖代理|OCF / 归母利润|1.4199515035088244|1.419951503508824403…|PASS；输入摘要 2|
|归母盈利比率|归母利润 / 收入|10.169890697477939%|10.169890697477939086…%|PASS|
|收入同比|本期与同期原值|3.5515467089659136%|3.551546708965924261…%|PASS|
|归母利润同比|本期与同期原值|1.6619979710683186%|1.661997971068310570…%|PASS|
|OCF 同比|本期与同期原值|0.7271127140717537%|0.727112714071760117…%|PASS|

累计半年发生额与期末存量分别核验，金额千元转元、展示亿元；PDF 页码从 1 开始，不能与印刷页脚混用。现金覆盖是合并 OCF / 归母利润的辅助代理，不能称合并净利润现金含量；半年 ROE 不年化。七项 UNVERIFIED 为四份报告精确公告时间的独立索引证明、加权 ROE 完整重建、管理层因果真伪、当前市场与估值数据。

遍历三期全部 81 条证据，1,196 个嵌套字段、公式、期次、口径、ID 和方向断言通过。证据及交付汇总 **118 PASS / 0 FAIL / 4 UNVERIFIED**：[明细](docs/repair-validation/evidence-delivery.json)。正负信号差异与同事实来源冲突分别表示。有限规则和财报抄录正确，不能证明全部业务解释正确。

四个证据/交付 UNVERIFIED：全部自由语义、原始资料覆盖完整性、数据展示/再分发权利、形式化安全性。这些与财报七项存在重叠，不相加成独立问题数。

## 6. 安全、交付与审计记录完整性

新旧访问口令在最终部署 27 条原始日志中均未检出，Groq Key 模式也未检出；仅保存允许字段，未保存请求头、IP、请求体或提供商原始错误。旧口令实际失效，新口令只保存在被 Git 忽略的本地私密交付文件，未写入报告或聊天。历史日志曾含旧口令是已发生的问题，不能因轮换后扫描通过就声称从未泄露；历史日志删除状态仍 UNVERIFIED。

本地源码与构建、可达 Git 历史和匿名获取的公开历史均执行限定秘密扫描，未命中已知当前秘密或提供商 Key 模式。扫描不等于正式渗透测试，也不能证明不存在未知历史秘密。README、AI 使用记录、测试说明、边界说明均可查。当前真实行情、估值及 iFinD 未授权，未声明已接通；可选演示视频未验收。

审计记录修正：最初故障脚本写入固定目录，运行修复版时曾覆盖原故障文件。已用独立目录中原冻结源码重新执行，复现 **13 PASS / 1 FAIL** 并恢复到历史目录；这是新的基线回放时间，不冒充原始时间。旧 `artifact-manifest.json` 是旧时点哈希，不适用于这个重新生成文件或更新后的根报告。修复脚本现支持独立输出目录、实际 Git HEAD，不再把新代码标成旧提交。部分早期本地测试失败是断言预期过严，原输出保留；修正断言后重新执行，不计旧失败为通过。

## 7. 尚未解决的问题与最终提交风险

1. **高风险 / FAIL：最终真实 Groq 六场景仍失败。** 日额度阻塞，完整解释与两条追问恢复未验证；评审若立即使用可能看到明确降级。不能以历史成功替代最新验收。
2. **UNVERIFIED：全部自由金融语义和因果。** 已覆盖历史错误及有限变体；仍需少量本人理解与判断，不能宣称所有金融结论正确。
3. **UNVERIFIED：历史平台日志处理。** 旧口令已撤销；历史日志清除及访问保留不能由现有工具确认。
4. **功能边界：行情、估值、全行业样本、完整事件新闻未接入。** 缺失正常显示 UNKNOWN；这仍限制题目“当前状态”诊断的完整性。
5. **待本人确认：AI 使用经历真实性、资料使用权利、评审口令私下交付与是否接受提交风险。** 程序不能替本人签认。

本轮已自动承担修复、回归、财报复算、来源冲突与选证据检查、公开访问、真实调用尝试、日志脱敏及交付核验。人工清单只保留不能由程序充分证明的事项；没有把自动审核写成候选人本人审核。


## 最终交付整理补充（2026-10-09）

产品功能保持版本 19；本次重新执行结果及失败处理见 [最终执行记录](docs/final-validation/final-results.json)，题目逐项 PASS/PARTIAL/FAIL/NOT TESTED 见 [SUBMISSION.md](SUBMISSION.md)。最新真实 Groq 追问规划成功、解释 TPD 429，仍 FAIL。原始审计与历史失败保留；未把本轮自动操作写成候选人本人验收。最终手工清单为 [CANDIDATE_REVIEW_CHECKLIST.md](CANDIDATE_REVIEW_CHECKLIST.md)，约12分钟。


## 候选人整体复核状态更新

2026-10-09，候选人在对话直接确认本人复核通过，由 Codex 代录至 [正式记录](CANDIDATE_REVIEW_CHECKLIST.md)。这一更新不改变本报告的自动测试及模型调用结果；没有新增测试执行。
