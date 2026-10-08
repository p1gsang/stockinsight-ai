"""Collect a small set of public accounting facts. No LLM or generated figures.

Downloads remain ignored. The published JSON contains facts, source URLs, page
locators and hashes, rather than copies of full copyrighted reports.
Run with Python + pypdf: python tools/collect_reports.py
"""
from pathlib import Path
from datetime import datetime, timezone
from hashlib import sha256
import json
import re
from urllib.request import Request, urlopen
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
REPORTS = [
    dict(id="midea-h1-2026", code="000333.SZ", name="美的集团", year=2026, page=2,
         published="2026-08-29", unit="千元", multiplier=1000,
         url="https://static.cninfo.com.cn/finalpage/2026-08-29/1225531403.PDF"),
    dict(id="midea-h1-2025", code="000333.SZ", name="美的集团", year=2025, page=7,
         published="2025-08-30", unit="千元", multiplier=1000,
         url="https://static.cninfo.com.cn/finalpage/2025-08-30/1224626720.PDF"),
    dict(id="gree-h1-2026", code="000651.SZ", name="格力电器", year=2026, page=7,
         published="2026-08-27", unit="元", multiplier=1,
         url="https://static.cninfo.com.cn/finalpage/2026-08-27/1225515004.PDF"),
]
FIELDS = {
    "revenue": r"营业收入[（(](?:千)?元[）)]",
    "parent_profit": r"归属于上市公司股东的净利润[（(](?:千)?元[）)]",
    "adjusted_profit": r"归属于上市公司股东的扣除非经常性\s*损益的?\s*净利润[（(](?:千)?元[）)]|归属于上市公司股东的扣除非经常性损益的\s*净利润[（(](?:千)?元[）)]",
    "ocf": r"经营活动产生的现金流量净额[（(](?:千)?元[）)]",
    "roe": r"加权平均净资产收益率",
}
NUMBER = r"(-?\d[\d,]*(?:\.\d+)?)(?:%)?"


def extract_pair(text, pattern):
    m = re.search("(?:" + pattern + r")\s*" + NUMBER + r"\s+" + NUMBER, text)
    if not m:
        raise ValueError(f"Missing required report row: {pattern}")
    return [float(v.replace(",", "")) for v in m.groups()]


def collect():
    cache = ROOT / ".sites-runtime/reports"
    cache.mkdir(parents=True, exist_ok=True)
    records, sources = [], []
    for spec in REPORTS:
        path = cache / (spec["id"] + ".pdf")
        fetched = datetime.now(timezone.utc).isoformat()
        if not path.exists():
            with urlopen(Request(spec["url"], headers={"User-Agent": "StockInsightResearch/1.0"}), timeout=30) as response:
                content = response.read(12_000_001)
            if len(content) > 12_000_000 or not content.startswith(b"%PDF"):
                raise ValueError("Invalid or oversized PDF")
            path.write_bytes(content)
        # mtime records actual download time when reusing a local file.
        fetched = datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat()
        reader = PdfReader(path)
        text = reader.pages[spec["page"] - 1].extract_text()
        if spec["name"] not in text or str(spec["year"]) not in text:
            raise ValueError("Company/year mismatch")
        if spec["unit"] not in text:
            raise ValueError("Missing accounting unit")
        pairs = {field: extract_pair(text, pattern) for field, pattern in FIELDS.items()}
        source = {**spec, "retrieved_at": fetched, "sha256": sha256(path.read_bytes()).hexdigest(),
                  "title": f'{spec["name"]} {spec["year"]} 年半年度报告' + ("摘要" if spec["id"] == "midea-h1-2026" else "全文"),
                  "extraction": "pypdf + required row regex; candidate review pending"}
        sources.append(source)
        for offset in [0, 1]:
            values = {field: pair[offset] * (1 if field == "roe" else spec["multiplier"])
                      for field, pair in pairs.items()}
            raw = {field: pair[offset] for field, pair in pairs.items()}
            records.append({"company_code": spec["code"], "company_name": spec["name"],
                            "period": f'{spec["year"] - offset}-06-30', "basis": "H1_YTD", "currency": "CNY",
                            "published_at": spec["published"], "source_id": spec["id"],
                            "source_fields": {"revenue": "营业收入", "parent_profit": "归属于上市公司股东的净利润", "adjusted_profit": "归属于上市公司股东的扣除非经常性损益的净利润", "ocf": "经营活动产生的现金流量净额", "roe": "加权平均净资产收益率"},
                            "source_column": "本报告期" if offset == 0 else "上年同期",
                            "values": values, "raw_values": raw})
    # Compare repeated observations, do not discard contradictory originals.
    conflicts = []
    for i, a in enumerate(records):
        for b in records[i+1:]:
            if (a["company_code"], a["period"]) == (b["company_code"], b["period"]):
                for field, value in a["values"].items():
                    if abs(value - b["values"][field]) > max(abs(value) * 1e-8, 0.01):
                        conflicts.append({"company_code": a["company_code"], "period": a["period"], "field": field,
                                          "source_ids": [a["source_id"], b["source_id"]]})
    output = {"schema_version": 1, "created_at": datetime.now(timezone.utc).isoformat(),
              "mode": "public_report_snapshot", "sources": sources, "records": records, "conflicts": conflicts,
              "event": {"date": "2026-08-29", "source_id": "midea-h1-2026", "page": 2,
                        "title": "半年报说明扣非利润与归母利润表现分化",
                        "description": "公司将扣非利润下降主要归因于外币货币性项目汇兑损失与衍生金融工具收益的会计分类差异。该说明属于管理层披露；持续影响仍需核验。"}}
    (ROOT / "data/public_reports.json").write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"sources": len(sources), "observations": len(records), "conflicts": len(conflicts)}, ensure_ascii=False))


if __name__ == "__main__":
    collect()
