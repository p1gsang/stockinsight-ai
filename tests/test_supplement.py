import importlib.util
import json
from pathlib import Path
import pytest
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("enrichment",ROOT/"tools/enrich_reports.py")
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

def test_supplement_reconciles_independently_to_original_snapshot():
    result=json.loads((ROOT/"data/report_supplement.json").read_text(encoding="utf-8"))
    base=json.loads((ROOT/"data/public_reports.json").read_text(encoding="utf-8"))
    assert len(result["facts"])==43
    assert all(f["normalized_value"]==f["raw_value"]*1000 for f in result["facts"])
    assert module.reconciliation(result["facts"],base)==result["reconciliations"]
    assert result["source"]["pages"]==[96,97,177,204]

def test_original_supplement_pdf_rows_and_hash():
    path=ROOT/".sites-runtime/reports/midea-h1-2026-full.pdf"
    if not path.exists():pytest.skip("Run python tools/enrich_reports.py to download the original")
    result=json.loads((ROOT/"data/report_supplement.json").read_text(encoding="utf-8"))
    assert module.sha256(path.read_bytes()).hexdigest()==result["source"]["sha256"]
    assert module.extract_rows(module.PdfReader(path))==result["facts"]
