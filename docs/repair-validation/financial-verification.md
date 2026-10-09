# 独立财报数值验收

验收 UTC：2026-10-09T07:19:32.957736+00:00。冻结版本：`0e2c551f1a5f813ebb9baeebd960086f6697db48`。

**范围：核对发行人公开原文与产品值，不证明发行人披露绝对真实，也不证明所有 AI 语义和业务因果正确。**

方法：重新下载四份官方 PDF，以独立 pdfplumber 解析（产品使用 pypdf），独立 Python Decimal 精度 40 复算；未使用产品计算函数作为预期值。部分产品实际值来自同版本离线证据输出，当前期次同时与公网实际响应交叉核对。

结果：PASS 190 / FAIL 0 / UNVERIFIED 7。

## 原始来源

|来源|新下载 SHA256|物理 PDF 页|SHA 校验|
|---|---|---|---|
|[midea-h1-2026](https://static.cninfo.com.cn/finalpage/2026-08-29/1225531403.PDF)|`9c4f21cebe9b35824276c41b90647bead0fd7948abc300ec1a2db0a7dfcac6f1`|2|PASS|
|[midea-h1-2025](https://static.cninfo.com.cn/finalpage/2025-08-30/1224626720.PDF)|`cec88d9c6ded328ac9b467ba55254ab831b906dfc613982f6ac0504fc2055a12`|7|PASS|
|[gree-h1-2026](https://static.cninfo.com.cn/finalpage/2026-08-27/1225515004.PDF)|`50da2e03fddbe9dd424d8fe7881f47fb34efa5d38c96aa9449c12e445c3b2dec`|7|PASS|
|[midea-h1-2026-full](https://disc.static.szse.cn/disc/disk03/finalpage/2026-08-29/df25443f-d67a-4cc5-8bd6-6c3e681a9575.PDF)|`576dd80e353e53296a800b03e9889a9cbb2e8b91fa2ab3c1dace7c10159179b8`|96,97,177,204|PASS|

页码统一是从 1 开始的物理 PDF 页。格力 PDF 第 7 页页脚印为第 6 页，评审应按 PDF 查看器页码定位。精确公告发布日期仅由 URL 路径交叉匹配，没有独立核验官方公告索引，因此为 UNVERIFIED。

## 基础财务字段（原值及复算值并排）

|来源/期次/字段|原文值（单位）|产品原值|产品标准值（元，ROE 为%）|独立换算值|状态|PDF页|
|---|---:|---:|---:|---:|---|---:|
|midea-h1-2026:2026-06-30:revenue|260042490 千元|260042490.0|260042490000.0|260042490000|PASS|2|
|midea-h1-2026:2026-06-30:parent_profit|26446037 千元|26446037.0|26446037000.0|26446037000|PASS|2|
|midea-h1-2026:2026-06-30:adjusted_profit|19595179 千元|19595179.0|19595179000.0|19595179000|PASS|2|
|midea-h1-2026:2026-06-30:ocf|37552090 千元|37552090.0|37552090000.0|37552090000|PASS|2|
|midea-h1-2026:2026-06-30:roe|11.33 %|11.33|11.33|11.33|PASS|2|
|midea-h1-2026:2025-06-30:revenue|251123714 千元|251123714.0|251123714000.0|251123714000|PASS|2|
|midea-h1-2026:2025-06-30:parent_profit|26013690 千元|26013690.0|26013690000.0|26013690000|PASS|2|
|midea-h1-2026:2025-06-30:adjusted_profit|26235399 千元|26235399.0|26235399000.0|26235399000|PASS|2|
|midea-h1-2026:2025-06-30:ocf|37281015 千元|37281015.0|37281015000.0|37281015000|PASS|2|
|midea-h1-2026:2025-06-30:roe|11.29 %|11.29|11.29|11.29|PASS|2|
|midea-h1-2025:2025-06-30:revenue|251123714 千元|251123714.0|251123714000.0|251123714000|PASS|7|
|midea-h1-2025:2025-06-30:parent_profit|26013690 千元|26013690.0|26013690000.0|26013690000|PASS|7|
|midea-h1-2025:2025-06-30:adjusted_profit|26235399 千元|26235399.0|26235399000.0|26235399000|PASS|7|
|midea-h1-2025:2025-06-30:ocf|37281015 千元|37281015.0|37281015000.0|37281015000|PASS|7|
|midea-h1-2025:2025-06-30:roe|11.29 %|11.29|11.29|11.29|PASS|7|
|midea-h1-2025:2024-06-30:revenue|217274086 千元|217274086.0|217274086000.0|217274086000|PASS|7|
|midea-h1-2025:2024-06-30:parent_profit|20804176 千元|20804176.0|20804176000.0|20804176000|PASS|7|
|midea-h1-2025:2024-06-30:adjusted_profit|20180878 千元|20180878.0|20180878000.0|20180878000|PASS|7|
|midea-h1-2025:2024-06-30:ocf|33488170 千元|33488170.0|33488170000.0|33488170000|PASS|7|
|midea-h1-2025:2024-06-30:roe|12.20 %|12.2|12.2|12.20|PASS|7|
|gree-h1-2026:2026-06-30:revenue|89397522501.21 元|89397522501.21|89397522501.21|89397522501.21|PASS|7|
|gree-h1-2026:2026-06-30:parent_profit|13277590882.57 元|13277590882.57|13277590882.57|13277590882.57|PASS|7|
|gree-h1-2026:2026-06-30:adjusted_profit|12706672720.90 元|12706672720.9|12706672720.9|12706672720.90|PASS|7|
|gree-h1-2026:2026-06-30:ocf|18808832392.46 元|18808832392.46|18808832392.46|18808832392.46|PASS|7|
|gree-h1-2026:2026-06-30:roe|8.68 %|8.68|8.68|8.68|PASS|7|
|gree-h1-2026:2025-06-30:revenue|97324925988.20 元|97324925988.2|97324925988.2|97324925988.20|PASS|7|
|gree-h1-2026:2025-06-30:parent_profit|14412407113.84 元|14412407113.84|14412407113.84|14412407113.84|PASS|7|
|gree-h1-2026:2025-06-30:adjusted_profit|13946409161.52 元|13946409161.52|13946409161.52|13946409161.52|PASS|7|
|gree-h1-2026:2025-06-30:ocf|28328562187.20 元|28328562187.2|28328562187.2|28328562187.20|PASS|7|
|gree-h1-2026:2025-06-30:roe|10.09 %|10.09|10.09|10.09|PASS|7|

## 全文附注与资产负债字段

|字段/期次|原文千元|产品千元|产品元|独立换算元|状态|PDF页/口径|
|---|---:|---:|---:|---:|---|---|
|accounts_receivable:2026-06-30|61954826|61954826|61954826000|61954826000|PASS|96 / POINT_IN_TIME|
|accounts_receivable:2025-12-31|40450097|40450097|40450097000|40450097000|PASS|96 / POINT_IN_TIME|
|inventory:2026-06-30|55440969|55440969|55440969000|55440969000|PASS|96 / POINT_IN_TIME|
|inventory:2025-12-31|64628834|64628834|64628834000|64628834000|PASS|96 / POINT_IN_TIME|
|accounts_payable:2026-06-30|109516782|109516782|109516782000|109516782000|PASS|97 / POINT_IN_TIME|
|accounts_payable:2025-12-31|103680491|103680491|103680491000|103680491000|PASS|97 / POINT_IN_TIME|
|bridge_net_profit:2026-06-30|26582874|26582874|26582874000|26582874000|PASS|177 / H1_YTD|
|bridge_net_profit:2025-06-30|26647354|26647354|26647354000|26647354000|PASS|177 / H1_YTD|
|bridge_impairment:2026-06-30|1652869|1652869|1652869000|1652869000|PASS|177 / H1_YTD|
|bridge_impairment:2025-06-30|366345|366345|366345000|366345000|PASS|177 / H1_YTD|
|bridge_credit:2026-06-30|606402|606402|606402000|606402000|PASS|177 / H1_YTD|
|bridge_credit:2025-06-30|346377|346377|346377000|346377000|PASS|177 / H1_YTD|
|bridge_depreciation:2026-06-30|5002775|5002775|5002775000|5002775000|PASS|177 / H1_YTD|
|bridge_depreciation:2025-06-30|4270742|4270742|4270742000|4270742000|PASS|177 / H1_YTD|
|bridge_disposal:2026-06-30|178365|178365|178365000|178365000|PASS|177 / H1_YTD|
|bridge_disposal:2025-06-30|20653|20653|20653000|20653000|PASS|177 / H1_YTD|
|bridge_fair_value:2026-06-30|-4997108|-4997108|-4997108000|-4997108000|PASS|177 / H1_YTD|
|bridge_fair_value:2025-06-30|1369697|1369697|1369697000|1369697000|PASS|177 / H1_YTD|
|bridge_finance:2026-06-30|1715548|1715548|1715548000|1715548000|PASS|177 / H1_YTD|
|bridge_finance:2025-06-30|-2880030|-2880030|-2880030000|-2880030000|PASS|177 / H1_YTD|
|bridge_investment:2026-06-30|-3040102|-3040102|-3040102000|-3040102000|PASS|177 / H1_YTD|
|bridge_investment:2025-06-30|-645870|-645870|-645870000|-645870000|PASS|177 / H1_YTD|
|bridge_tax_asset:2026-06-30|-1817862|-1817862|-1817862000|-1817862000|PASS|177 / H1_YTD|
|bridge_tax_asset:2025-06-30|-1068051|-1068051|-1068051000|-1068051000|PASS|177 / H1_YTD|
|bridge_tax_liability:2026-06-30|725318|725318|725318000|725318000|PASS|177 / H1_YTD|
|bridge_tax_liability:2025-06-30|-34705|-34705|-34705000|-34705000|PASS|177 / H1_YTD|
|bridge_inventory:2026-06-30|9062647|9062647|9062647000|9062647000|PASS|177 / H1_YTD|
|bridge_inventory:2025-06-30|13680715|13680715|13680715000|13680715000|PASS|177 / H1_YTD|
|bridge_receivables:2026-06-30|-24088817|-24088817|-24088817000|-24088817000|PASS|177 / H1_YTD|
|bridge_receivables:2025-06-30|-16926805|-16926805|-16926805000|-16926805000|PASS|177 / H1_YTD|
|bridge_payables:2026-06-30|25484008|25484008|25484008000|25484008000|PASS|177 / H1_YTD|
|bridge_payables:2025-06-30|11575374|11575374|11575374000|11575374000|PASS|177 / H1_YTD|
|bridge_other:2026-06-30|485173|485173|485173000|485173000|PASS|177 / H1_YTD|
|bridge_other:2025-06-30|559219|559219|559219000|559219000|PASS|177 / H1_YTD|
|bridge_ocf:2026-06-30|37552090|37552090|37552090000|37552090000|PASS|177 / H1_YTD|
|bridge_ocf:2025-06-30|37281015|37281015|37281015000|37281015000|PASS|177 / H1_YTD|
|nonrecurring_disposal:2026-06-30|564105|564105|564105000|564105000|PASS|204 / H1_YTD|
|nonrecurring_financial:2026-06-30|6745721|6745721|6745721000|6745721000|PASS|204 / H1_YTD|
|nonrecurring_other:2026-06-30|743628|743628|743628000|743628000|PASS|204 / H1_YTD|
|nonrecurring_subtotal:2026-06-30|8053454|8053454|8053454000|8053454000|PASS|204 / H1_YTD|
|nonrecurring_tax:2026-06-30|-968009|-968009|-968009000|-968009000|PASS|204 / H1_YTD|
|nonrecurring_minority:2026-06-30|-234587|-234587|-234587000|-234587000|PASS|204 / H1_YTD|
|nonrecurring_parent:2026-06-30|6850858|6850858|6850858000|6850858000|PASS|204 / H1_YTD|

## 独立复算

现金覆盖代理=合并经营现金流÷归母净利润；归母盈利比率=归母净利润÷营业收入×100；同比=(本期−同期)÷同期×100；经营张力=利润同比−现金流同比。覆盖代理分子分母少数股东口径不同，算术正确不等于合并利润现金含量。

|期次/指标|产品值|独立 Decimal 复算值|绝对误差|状态|观察方式|
|---|---:|---:|---:|---|---|
|2024-06-30:cash-coverage|1.6096849978581222|1.609684997858122330824349880523987107204|1.30824349880523987107204E-16|PASS|offline observed product evidence function|
|2024-06-30:profit-margin|9.575083887362435|9.575083887362434929308596884397893635599|7.0691403115602106364401E-17|PASS|offline observed product evidence function|
|2025-06-30:cash-coverage|1.4331305939295809|1.433130593929580924505519978134589902471|2.4505519978134589902471E-17|PASS|offline observed product evidence function|
|2025-06-30:profit-margin|10.35891417247835|10.35891417247835065070756320528136183905|6.5070756320528136183905E-16|PASS|offline observed product evidence function|
|2025-06-30:revenue-yoy|15.57922926897044|15.57922926897043764344727240044631921729|2.35655272759955368078271E-15|PASS|offline observed product evidence function|
|2025-06-30:parent_profit-yoy|25.04071297993249|25.04071297993249047691194306373874168340|4.7691194306373874168340E-16|PASS|offline observed product evidence function|
|2025-06-30:adjusted_profit-yoy|30.001276455860836|30.00127645586084014778742530429052690374|4.14778742530429052690374E-15|PASS|offline observed product evidence function|
|2025-06-30:ocf-yoy|11.325924946033172|11.32592494603318126968418996917418897479|9.26968418996917418897479E-15|PASS|offline observed product evidence function|
|2025-06-30:growth-tension|13.714788033899318|13.71478803389930920722775309456455270861|8.79277224690543544729139E-15|PASS|offline observed product evidence function|
|2026-06-30:cash-coverage|1.4199515035088244|1.419951503508824403444644655076297442978|3.444644655076297442978E-18|PASS|actual public response|
|2026-06-30:profit-margin|10.169890697477939|10.16989069747793908603167120880899117679|8.603167120880899117679E-17|PASS|actual public response|
|2026-06-30:revenue-yoy|3.5515467089659136|3.551546708965924261537482676765444779938|1.0661537482676765444779938E-14|PASS|actual public response|
|2026-06-30:parent_profit-yoy|1.6619979710683186|1.661997971068310570318935914128291680265|8.029681064085871708319735E-15|PASS|actual public response|
|2026-06-30:adjusted_profit-yoy|-25.31015442151271|-25.31015442151270502880478394858793647468|4.97119521605141206352532E-15|PASS|actual public response|
|2026-06-30:ocf-yoy|0.7271127140717537|0.7271127140717601170461694779501040945371|6.4170461694779501040945371E-15|PASS|actual public response|
|2026-06-30:growth-tension|0.9348852569965649|0.9348852569965504532727664361781875857279|1.44467272335638218124142721E-14|PASS|actual public response|

|勾稽|独立千元合计|原文/差额|残差|状态|
|---|---:|---:|---:|---|
|2026-06-30:net_profit_to_ocf|37552090|37552090|0|PASS|
|2025-06-30:net_profit_to_ocf|37281015|37281015|0|PASS|
|2026-06-30:parent_minus_adjusted_equals_nonrecurring|6850858|6850858|0|PASS|

## 全文与摘要独立交叉核验

|字段/期次|全文原值|摘要/现金流桥接原值|状态|PDF页|
|---|---:|---:|---|---|
|2026-06-30:revenue:full_vs_summary|260042490000|260042490000|PASS|98|
|2025-06-30:revenue:full_vs_summary|251123714000|251123714000|PASS|98|
|2026-06-30:parent_profit:full_vs_summary|26446037000|26446037000|PASS|98|
|2025-06-30:parent_profit:full_vs_summary|26013690000|26013690000|PASS|98|
|2026-06-30:ocf:full_vs_summary|37552090000|37552090000|PASS|99|
|2025-06-30:ocf:full_vs_summary|37281015000|37281015000|PASS|99|
|2026-06-30:consolidated_profit:bridge_vs_statement|26582874|26582874|PASS|[98, 177]|
|2025-06-30:consolidated_profit:bridge_vs_statement|26647354|26647354|PASS|[98, 177]|

## 来源名称问题与修复建议


审计脚本第一次以字面匹配判断管理层说明时，PDF 换行拆开“衍生金融”造成误报。只修复审计脚本的空白归一化后完整重跑；没有修改生产代码。

可选补深：全文 PDF 第98页已有营业成本字段，当前产品仍如实标记毛利率未覆盖；可经确认后接入同口径成本并补算毛利率。该项不代表已完成接入。

## 不能自动宣布通过的内容

- **UNVERIFIED — roe_independent_recalculation**：All six disclosed ROE values match original PDFs, but weighted average equity movements were not independently reconstructed; do not substitute opening/closing average equity。Requires time-weighted capital movements and applicable accounting definition
- **PASS — management_fx_disclosure_attribution**：Fresh original report page2 explicitly attributes adjusted profit decline to FX losses recurring vs derivatives gains nonrecurring; product labels attribution and remaining verification。
- **UNVERIFIED — independent_business_causality**：Issuer management explanation is verified as a disclosure, not independently established as causal truth or a forecast。Would require underlying exposures, hedge effectiveness and later-period evidence
- **UNVERIFIED — current_market_and_valuation**：No authorized current price or valuation data is present in the committed public report dataset。Requires actual licensed market/valuation feed; financial report verification cannot establish current valuation or trading ranges

公司汇兑解释已对照原文验证为“公司披露”，不能升级为独立证明的经营原因。ROE 原文值全部核对通过；缺乏独立完整的时间加权权益重建，ROE 独立重算为 UNVERIFIED。未配置授权行情与估值，不能用半年报推断当前股价或估值。

完整逐项状态、原文行片段、原始下载时间及公网每个 evidence input 的交叉核对见 [financial-verification.json](financial-verification.json)。新增审计程序为 [audit_financial_independent.py](../../tools/audit_financial_independent.py)。生产代码和部署未改动。
