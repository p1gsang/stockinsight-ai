"""Independently verify published facts against required report rows and units."""
import importlib.util
import json
from pathlib import Path
import pytest
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("collector",ROOT/"tools/collect_reports.py")
collector=importlib.util.module_from_spec(spec)
spec.loader.exec_module(collector)
DATA=json.loads((ROOT/"data/public_reports.json").read_text(encoding="utf-8"))

def test_published_primary_facts_and_unit_conversion():
    r=next(r for r in DATA["records"] if r["period"]=="2026-06-30" and r["company_code"]=="000333.SZ")
    assert r["raw_values"]["revenue"]==260042490
    assert r["values"]["revenue"]==260042490000
    assert r["values"]["parent_profit"]==26446037000
    assert r["values"]["ocf"]==37552090000
    assert r["values"]["roe"]==11.33

def test_regex_extracts_multiline_and_units_without_losing_alternation():
    assert collector.extract_pair("扣非利润\n 1,200 900 33.33%",r"扣非利润|其他字段")==[1200,900]
    with pytest.raises(ValueError):collector.extract_pair("missing",r"利润")

def test_duplicate_observations_and_snapshot_provenance():
    observations=[r for r in DATA["records"] if r["period"]=="2025-06-30" and r["company_code"]=="000333.SZ"]
    assert len(observations)==2
    assert observations[0]["values"]==observations[1]["values"]
    assert DATA["conflicts"]==[]
    for s in DATA["sources"]:
        assert len(s["sha256"])==64
        assert s["retrieved_at"] and s["page"]>0
        assert s["url"].startswith("https://static.cninfo.com.cn/")

@pytest.mark.parametrize("report",collector.REPORTS)
def test_available_original_pdf_rows_match_published_snapshot(report):
    path=ROOT/".sites-runtime/reports"/(report["id"]+".pdf")
    if not path.exists():pytest.skip("Download originals with tools/collect_reports.py for local reconciliation")
    reader=collector.PdfReader(path)
    text=reader.pages[report["page"]-1].extract_text()
    current=next(r for r in DATA["records"] if r["source_id"]==report["id"] and r["source_column"]=="本报告期")
    for field,pattern in collector.FIELDS.items():
        expected=collector.extract_pair(text,pattern)[0]*(1 if field=="roe" else report["multiplier"])
        assert current["values"][field]==expected
