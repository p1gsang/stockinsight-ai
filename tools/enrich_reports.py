"""Extract a bounded set of facts from the exchange-hosted original report.

Full PDFs remain private cache files. No model participates in extraction.
"""
from pathlib import Path
from urllib.request import Request, urlopen
from datetime import datetime, timezone
from hashlib import sha256
import json
import re
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
URL = "https://disc.static.szse.cn/disc/disk03/finalpage/2026-08-29/df25443f-d67a-4cc5-8bd6-6c3e681a9575.PDF"
NUMBER = r"(\(?-?\d[\d,]*\)?)"
ROWS = {
    96: [("accounts_receivable", "应收账款", r"应收账款\s+四\(4\)"),
         ("inventory", "存货", r"存货\s+四\(10\)")],
    97: [("accounts_payable", "应付账款", r"应付账款\s+四\(28\)")],
    177: [("bridge_net_profit", "净利润", r"^净利润"),
          ("bridge_impairment", "资产减值损失", r"^加：资产减值损失"),
          ("bridge_credit", "信用减值损失", r"^信用减值损失"),
          ("bridge_depreciation", "折旧和摊销", r"^折旧和摊销"),
          ("bridge_disposal", "资产处置损失", r"^资产处置损失"),
          ("bridge_fair_value", "公允价值变动(收益)/损失", r"^公允价值变动\(收益\)/损失"),
          ("bridge_finance", "财务费用/(收入)", r"^财务费用/\(收入\)"),
          ("bridge_investment", "投资收益", r"^投资收益"),
          ("bridge_tax_asset", "递延所得税资产增加", r"^递延所得税资产增加"),
          ("bridge_tax_liability", "递延所得税负债减少", r"^递延所得税负债减少"),
          ("bridge_inventory", "存货的减少", r"^存货的减少"),
          ("bridge_receivables", "经营性应收项目的增加", r"^经营性应收项目的增加"),
          ("bridge_payables", "经营性应付项目的增加", r"^经营性应付项目的增加"),
          ("bridge_other", "股份支付及其他", r"^股份支付及其他"),
          ("bridge_ocf", "经营活动产生的现金流量净额", r"^经营活动产生的现金流量净额")],
    204: [("nonrecurring_disposal", "非流动资产处置损益", r"^非流动资产处置损益"),
          ("nonrecurring_financial", "金融资产等公允价值变动及处置投资收益（非经常性）", r"其他非流动金融资产取得的投资收益"),
          ("nonrecurring_other", "其他非经常性损益", r"罚款收入等其他营业外收入和支出\)"),
          ("nonrecurring_subtotal", "非经常性损益小计", r"^小\s*计"),
          ("nonrecurring_tax", "所得税影响额", r"^减：所得税影响额"),
          ("nonrecurring_minority", "少数股东权益影响额(税后)", r"^少数股东权益影响额\(税后\)"),
          ("nonrecurring_parent", "归属于母公司所有者的非经常性损益净额", r"^归属于母公司所有者的非经常性损益净额")],
}


def extract_rows(reader):
    facts = []
    for page, rows in ROWS.items():
        text = reader.pages[page - 1].extract_text()
        for field, label, pattern in rows:
            count = 1 if page == 204 else 2
            matches = list(re.finditer(pattern + r"\s+" + r"\s+".join([NUMBER] * count), text, re.M))
            if len(matches) != 1:
                raise ValueError(f"Expected exactly one {field} row on PDF page {page}")
            for offset, value in enumerate(matches[0].groups()):
                negative = value.startswith("(")
                raw = int(value.replace(",", "").strip("()")) * (-1 if negative else 1)
                period = "2026-06-30" if offset == 0 else "2025-12-31" if page < 100 else "2025-06-30"
                facts.append(dict(field=field, source_field=label, source_page=page,
                                  source_id="midea-h1-2026-full", company_code="000333.SZ",
                                  report_period=period, basis="POINT_IN_TIME" if page < 100 else "H1_YTD",
                                  source_column=("合并·期末" if offset == 0 else "合并·上年末") if page < 100
                                  else "本期数" if offset == 0 else "上年同期数",
                                  raw_value=raw, normalized_value=raw * 1000, raw_unit="千元"))
    return facts


def reconciliation(facts, base):
    value = lambda field, period: next(f["raw_value"] for f in facts if f["field"] == field and f["report_period"] == period)
    checks = []
    for period in ["2026-06-30", "2025-06-30"]:
        components = [f["raw_value"] for f in facts if f["report_period"] == period and f["field"].startswith("bridge_") and f["field"] != "bridge_ocf"]
        total = value("bridge_ocf", period)
        record = next(r for r in base["records"] if r["company_code"] == "000333.SZ" and r["period"] == period)
        assert sum(components) == total == record["raw_values"]["ocf"], "Cash bridge does not reconcile"
        checks.append(dict(check="net_profit_to_ocf", period=period, residual_thousand_cny=sum(components) - total))
    period = "2026-06-30"
    record = next(r for r in base["records"] if r["company_code"] == "000333.SZ" and r["period"] == period)
    net = value("nonrecurring_parent", period)
    assert record["raw_values"]["parent_profit"] - record["raw_values"]["adjusted_profit"] == net
    subtotal = sum(value(f, period) for f in ["nonrecurring_disposal", "nonrecurring_financial", "nonrecurring_other"])
    assert subtotal == value("nonrecurring_subtotal", period)
    assert subtotal + value("nonrecurring_tax", period) + value("nonrecurring_minority", period) == net
    checks.append(dict(check="parent_minus_adjusted_equals_nonrecurring", period=period, residual_thousand_cny=0))
    return checks


def collect():
    path = ROOT / ".sites-runtime/reports/midea-h1-2026-full.pdf"
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        with urlopen(Request(URL, headers={"User-Agent": "StockInsightResearch/1.0"}), timeout=30) as response:
            content = response.read(16_000_001)
        if not content.startswith(b"%PDF") or len(content) > 16_000_000:
            raise ValueError("Invalid or oversized original PDF")
        path.write_bytes(content)
    reader = PdfReader(path)
    assert len(reader.pages) == 205
    assert "2026" in reader.pages[0].extract_text() and "美的集团" in reader.pages[0].extract_text()
    assert "人民币千元" in reader.pages[95].extract_text().replace(" ", "")
    facts = extract_rows(reader)
    checks = reconciliation(facts, json.loads((ROOT / "data/public_reports.json").read_text(encoding="utf-8")))
    retrieved = datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat()
    result = dict(schema_version=1, source=dict(id="midea-h1-2026-full", title="美的集团 2026 H1 全文及财务附注",
                 url=URL, page=177, pages=[96, 97, 177, 204], unit="千元", published="2026-08-29",
                 retrieved_at=retrieved, sha256=sha256(path.read_bytes()).hexdigest(),
                 extraction="Exact page/row extraction + cash bridge and nonrecurring reconciliation; personal review pending"),
                 facts=facts, reconciliations=checks)
    (ROOT / "data/report_supplement.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(dict(facts=len(facts), reconciliations=checks)))


if __name__ == "__main__":
    collect()
