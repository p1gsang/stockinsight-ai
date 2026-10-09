## 本轮最终功能部署

- 功能版本 13：`fdd7ce108ec3ca020f127476bfeec71b0c138e85`。
- 部署 `appgdep_6ac835582f288191b64cdf52d35825ac`，原生结果 succeeded，2026-10-09T00:29:22.323477+00:00；public，Secrets revision 2。
- GitHub 功能提交 `887f4a4c5f62437360bf77a3bfb8455027eba4c6` 与部署源文件树 `65c69110ed6d6aef8aac7a43174ffa3f1a246412` 完全一致，独立克隆 169 项 Node / 类型 / 八项 HTTP 通过。
- 最终功能版本 13 的四项真实公网 Groq 验证通过：财务规划与解释、所选证据扣非追问、事件入口、保留扣非主题的通用追问。共八次真实响应、16,585 Token，响应 ID 与 usage 保存在 docs/semantic-llm-public.json；这是一次有限场景验证，不是全面语义质量保证。历史预算、原因表述和数字绑定失败均保留，未写成全程成功。
- 此后仅追加验证材料并复用同一构建产物发布文档版本，最终版本号和源码 / 压缩包回执由提交者本地交付。
- 真实行情、估值授权及候选人本人复核仍未完成。

以下为历史部署与操作说明。

# 部署与提交状态

本文件只记录实际状态，不把候选 URL 当成已部署成果。

- 公网 URL：https://stockinsight-midea-research.eagercomet2.chatgpt.site
- 2026-10-08T19:09:25Z：原生部署服务返回 succeeded；访问模式 public。生产构建与本地 HTTP / 浏览器检查通过，未把云端浏览器验收写成已执行。
- Sites 项目：appgprj_6ac7e1b683388191b105cb2014e84456。首次成功部署：appgdep_6ac7ea59a0a881919e7638c371816432。
- 公开财报快照保留；Groq 真实模型的服务端 Secrets 已配置，公网真实主链路与共享额度保护已验证。
- GitHub 仓库：https://github.com/p1gsang/stockinsight-ai 。完整源码已上传，独立克隆安装、156 项 Node / TypeScript / 八项 HTTP 验证通过；记录见 docs/delivery-verification.json。
- 真实模型：Groq / openai/gpt-oss-120b，已配置服务端 Secret，完成本地与公网真实调用。
- 扶摇授权数据：未配置。

## 完成剩余授权

### 模型

当前使用 Groq 免费 API；配置及验证见 LLM_INTEGRATION.md。兼容服务使用现有 LLM_API_KEY / LLM_BASE_URL / LLM_MODEL，不需要付费 OpenAI Key。
公开站点的模型调用还必须设置 RESEARCH_ACCESS_CODE，访客在“连接设置”填写该站点口令。密钥仍仅在服务端使用。口令应与 API Key 不同。

### 扶摇

1. 登录 https://fuyao.aicubes.cn/admin/。
2. 创建研究用途的 API Key，确认可用能力与数据展示权限。
3. 将 FUYAO_API_KEY 配置为服务端 secret。
4. 页面选择“扶摇授权接口”，填写站点访问口令，再开始研究。

### GitHub

交付仓库为 https://github.com/p1gsang/stockinsight-ai 。`.env.local`、`.dev.vars`、运行缓存、下载的完整 PDF、密钥及站点访问口令均不进入源码交付。Sites 源码存储与该仓库分别管理；公共仓库提交与部署提交可能不同，文件内容一致性单独校验。

## 本地与其他平台

此项目以 Cloudflare Workers 兼容输出构建，当前部署路径为 Sites。不是 Streamlit 项目，不能直接填入 Streamlit Community Cloud。可移植到其他支持 Worker 的部署平台，但需要配置绑定、secret 与构建产物，不应声称已验证这些平台。

## Groq 公网功能发布记录

- 版本 4：提交 `8d3a386b7ca9ca07a63cefb2f8c41997a5af0928`。
- 部署 `appgdep_6ac7fbab8c848191af07281f348c795f`，原生结果 succeeded，2026-10-08T20:23:17.319425Z；Secrets revision 2，保持 public。
- D1 绑定 DB，Drizzle 迁移已应用；已核对 research_quotas 和 research_leases 两表。没有存储研究内容或原始 IP。
- 真实财务规划 / 解读、所选证据追问、估值缺失三项公网验收通过；连续请求实际返回 429 和 Retry-After，详见 TEST_REPORT.md。
- 首页显示“Groq 已配置 · 待调用”；本次请求两阶段和校验通过后才显示“Groq · 本次调用成功”，不把配置当成成功调用。

## 研究边界修复

本轮功能、保留边界和真实模型失败修正见 TRUST_BOUNDARIES.md；58 项自动测试与三项本地真实 Groq 回归已通过，记录见 docs/llm-trust-local-verification.json。版本 4 以上记录属于历史部署，修复版本的生产发布时间与最终公网复测以本次交付回执及原生部署状态为准。

- 研究边界修复功能版本 7：`551d9deaeb18e0bf82b5d9b40b7ac343eb098e3a`。
- 部署 `appgdep_6ac81c896d8c8191ba080d86946814be`，succeeded，2026-10-08T22:43:31.476431Z，public，Secrets revision 2。
- 四项真实 Groq 公网场景及九项授权 / 边界 / 限流检查全部通过，记录见 docs/llm-trust-public-verification.json。
- 版本 6 曾发生一次原因追问 HTTP 400，修正后在版本 7 完整重新验收。此后的验收材料更新不改变功能；最终文档版本回执随交付提供。

## 后续问题路由改进发布

- 功能版本 9：eeaec8e94be0e6eee66baaccb7d20fe72ef5da5b。
- 部署 appgdep_6ac824633158819199599ec1cdbd8d01，succeeded，2026-10-08T23:17:01.640265Z；public，Secrets revision 2。
- 新版三项真实公网 Groq 验证通过：财务规划 / 分析、所选证据事件追问、事件与风险维度入口。记录见 docs/question-routing-llm-public.json。
- 公共 GitHub 源码提交 fc40b06ef8c59b8a5b72b3ea874523d39e749de1 与该部署的文件树完全一致。最终追加验证材料不修改功能代码，完整验证见 NEXT_STEP_VERIFICATION.md。
