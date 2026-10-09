"""Read-only financial audit. Parsing and Decimal arithmetic do not import product code.

Fresh original PDFs are downloaded into the ignored audit runtime directory.
pdfplumber is deliberately different from the product's pypdf extractor.
"""
from __future__ import annotations

import argparse
import concurrent.futures
import datetime as dt
import hashlib
import json
import os
import pathlib
import re
import subprocess
import urllib.request
from decimal import Decimal, getcontext

import pdfplumber

ROOT = pathlib.Path(__file__).resolve().parents[1]
CACHE = ROOT / '.sites-runtime' / 'audit-20261009'
OUTPUT = ROOT / os.environ.get('AUDIT_OUTPUT_DIR', 'docs/auto-audit')
getcontext().prec = 40
FIELDS = ['revenue', 'parent_profit', 'adjusted_profit', 'ocf', 'roe']
BASE_ANCHORS = {
    'revenue': '营业收入（',
    'parent_profit': '归属于上市公司股东的净利润（',
    'adjusted_profit': '归属于上市公司股东的扣除非经常性',
    'ocf': '经营活动产生的现金流量净额（',
    'roe': '加权平均净资产收益率',
}
SUPPLEMENT_ROWS = {
    'accounts_receivable': (96, '应收账款'),
    'inventory': (96, '存货 '),
    'accounts_payable': (97, '应付账款'),
    'bridge_net_profit': (177, '净利润 '),
    'bridge_impairment': (177, '加：资产减值损失'),
    'bridge_credit': (177, '信用减值损失'),
    'bridge_depreciation': (177, '折旧和摊销'),
    'bridge_disposal': (177, '资产处置损失'),
    'bridge_fair_value': (177, '公允价值变动(收益)/损失'),
    'bridge_finance': (177, '财务费用/(收入)'),
    'bridge_investment': (177, '投资收益 '),
    'bridge_tax_asset': (177, '递延所得税资产增加'),
    'bridge_tax_liability': (177, '递延所得税负债减少'),
    'bridge_inventory': (177, '存货的减少'),
    'bridge_receivables': (177, '经营性应收项目的增加'),
    'bridge_payables': (177, '经营性应付项目的增加'),
    'bridge_other': (177, '股份支付及其他'),
    'bridge_ocf': (177, '经营活动产生的现金流量净额'),
    'nonrecurring_disposal': (204, '非流动资产处置损益'),
    'nonrecurring_financial': (204, '除同本集团正常经营业务相关的有效套期保值业务外'),
    'nonrecurring_other': (204, '其他(主要包括政府补助'),
    'nonrecurring_subtotal': (204, '小 计'),
    'nonrecurring_tax': (204, '减：所得税影响额'),
    'nonrecurring_minority': (204, '少数股东权益影响额(税后)'),
    'nonrecurring_parent': (204, '归属于母公司所有者的非经常性损益净额'),
}
COMMA_AMOUNT = re.compile(r'(?<![\d,])\(?-?\d{1,3}(?:,\d{3})+(?:\.\d+)?\)?(?![\d,])')


def decimal_text(value):
    if isinstance(value, Decimal):
        return format(value, 'f')
    raise TypeError(type(value).__name__)


def number(token):
    negative = token.startswith('(') and token.endswith(')')
    result = Decimal(token.strip('()').replace(',', ''))
    return -result if negative else result


def locate_row(text, anchor, *, percent=False):
    lines = text.splitlines()
    matches = [i for i, line in enumerate(lines) if line.startswith(anchor)]
    if len(matches) != 1:
        raise ValueError(f'Nonunique PDF row anchor {anchor!r}: {len(matches)}')
    index = matches[0]
    snippet = []
    for line in lines[index:index + 5]:
        snippet.append(line)
        tokens = re.findall(r'-?\d+(?:\.\d+)?%', line) if percent else COMMA_AMOUNT.findall(line)
        if tokens:
            values = [number(token.rstrip('%')) for token in tokens]
            return values, '\n'.join(snippet)
    raise ValueError(f'No numbers following PDF row {anchor!r}')


def equal(a, b, tolerance=Decimal('0')):
    return a is not None and b is not None and abs(Decimal(str(a)) - Decimal(str(b))) <= tolerance


def check(status, item, method, **evidence):
    return {'item': item, 'status': status, 'method': method, **evidence}


def independent_product_observation():
    # Product function is called ONLY to capture its observed output. Expected
    # results below are separately calculated from fresh pdfplumber/Decimal data.
    code = """import {publicSnapshot} from './lib/research/providers.mjs';
import {buildEvidence} from './lib/research/evidence.mjs';
const d=publicSnapshot(); const periods=['2024-06-30','2025-06-30','2026-06-30'];
console.log(JSON.stringify(Object.fromEntries(periods.map(p=>[p,buildEvidence(d,p,{dimensions:['quality','trend','events','industry','valuation','market']},new Date('2026-10-09T06:00:00Z')).all_evidence]))));"""
    response = subprocess.run(['node', '--input-type=module', '-e', code], cwd=ROOT, check=True, capture_output=True, encoding='utf-8')
    return json.loads(response.stdout, parse_float=Decimal)


def evaluate(base, supplement, sources, fetched):
    source_map = {source['id']: (source, result) for source, result in zip(sources, fetched)}
    parsed = {}
    source_checks = []
    source_rows = []
    for source, result in zip(sources, fetched):
        title = result['pages']['1']
        is_midea = source['id'].startswith('midea')
        report_year = int(re.search(r'(20\d{2})\s*年半年度报告', title).group(1))
        company_ok = ('美的集团股份有限公司' if is_midea else '珠海格力电器股份有限公司') in title
        source_checks.append(check('PASS' if company_ok else 'FAIL', f"{source['id']}:company_year", 'Fresh original cover extraction', source_year=report_year, title_snippet=title[:150]))
        source_checks.append(check(result['sha_status'], f"{source['id']}:source_hash", 'Fresh HTTPS download SHA256 vs committed source SHA256', actual_sha256=result['sha256'], product_sha256=source.get('sha256')))
        source_checks.append(check('UNVERIFIED', f"{source['id']}:exact_publication_day", 'URL date agrees with product; exact public disclosure timestamp was not checked against an independent official announcement index', product_published=source.get('published'), url=source['url'], http_last_modified=result.get('last_modified')))
        source_rows.append({key: value for key, value in result.items() if key != 'pages'} | {'id': source['id'], 'page_numbering': 'physical 1-based PDF page; Gree PDF page 7 is printed page 6'})
        if source['id'] == 'midea-h1-2026-full':
            continue
        text = result['pages'][str(source['page'])]
        monetary_unit = '千元' if '营业收入（千元）' in text else '元' if '营业收入（元）' in text else None
        multiplier = Decimal('1000') if monetary_unit == '千元' else Decimal('1')
        source_checks.append(check('PASS' if monetary_unit and '本报告期' in text and '上年同期' in text else 'FAIL', f"{source['id']}:unit_period_columns", 'Fresh table header and literal monetary-unit row; half-year report cover', unit=monetary_unit, report_year=report_year, physical_pdf_page=source['page']))
        for field in FIELDS:
            values, snippet = locate_row(text, BASE_ANCHORS[field], percent=field == 'roe')
            if len(values) < 2:
                raise ValueError(f'Missing comparison column {source["id"]} {field}')
            for index, value in enumerate(values[:2]):
                key = (source['id'], f'{report_year - index}-06-30', field)
                parsed[key] = {'raw': value, 'normalized': value if field == 'roe' else value * multiplier,
                               'unit': '%' if field == 'roe' else monetary_unit, 'snippet': snippet,
                               'page': source['page'], 'basis': 'H1_YTD', 'column': ['本报告期', '上年同期'][index]}
    values_checks = []
    for record in base['records']:
        for field in FIELDS:
            item = parsed[(record['source_id'], record['period'], field)]
            okay = equal(item['raw'], record['raw_values'][field]) and equal(item['normalized'], record['values'][field]) and record['basis'] == item['basis'] and record['source_column'] == item['column']
            values_checks.append(check('PASS' if okay else 'FAIL', f"{record['source_id']}:{record['period']}:{field}", 'Independent pdfplumber original row extraction and Decimal unit conversion', field=field, company_code=record['company_code'], period=record['period'], source_id=record['source_id'], original_raw=item['raw'], raw_unit=item['unit'], product_raw=record['raw_values'][field], product_normalized=record['values'][field], independently_normalized=item['normalized'], basis=record['basis'], source_column=record['source_column'], physical_pdf_page=item['page'], original_snippet=item['snippet']))
    supplemental = {}
    full_result = source_map['midea-h1-2026-full'][1]
    for field, (page, anchor) in SUPPLEMENT_ROWS.items():
        values, snippet = locate_row(full_result['pages'][str(page)], anchor)
        count = 2 if page in [96, 97, 177] else 1
        if len(values) < count:
            raise ValueError(f'Supplement {field}: missing columns')
        for index in range(count):
            period = ('2026-06-30', '2025-12-31' if page in [96, 97] else '2025-06-30')[index]
            supplemental[(field, period)] = {'raw': values[index], 'normalized': values[index] * Decimal('1000'), 'page': page, 'snippet': snippet, 'basis': 'POINT_IN_TIME' if page in [96, 97] else 'H1_YTD', 'column': ('合并·期末', '合并·上年末')[index] if page in [96, 97] else ('本期数', '上年同期数')[index]}
    supplement_checks = []
    for fact in supplement['facts']:
        item = supplemental[(fact['field'], fact['report_period'])]
        okay = equal(item['raw'], fact['raw_value']) and equal(item['normalized'], fact['normalized_value']) and item['page'] == fact['source_page'] and item['basis'] == fact['basis'] and item['column'] == fact['source_column'] and fact['raw_unit'] == '千元'
        supplement_checks.append(check('PASS' if okay else 'FAIL', f"{fact['field']}:{fact['report_period']}", 'Separate literal row anchors over freshly downloaded full PDF; first two consolidated columns only', original_raw=item['raw'], raw_unit='千元', product_raw=fact['raw_value'], product_normalized=fact['normalized_value'], independently_normalized=item['normalized'], physical_pdf_page=item['page'], basis=item['basis'], source_column=item['column'], original_snippet=item['snippet']))
    observations = independent_product_observation()
    # Compare actually returned public data wherever present; preserve method.
    online_path = OUTPUT / 'public-llm.json'
    online_response = None
    if online_path.exists():
        online = load_json(online_path)
        online_response = next((case.get('response') for case in online.get('cases', []) if isinstance(case.get('response'), dict) and case['response'].get('evidence')), None)
    product_evidence = {period: {e['evidence_id'].split(f'E-MD-{period.replace("-", "")}-', 1)[-1]: e for e in rows} for period, rows in observations.items()}
    if online_response:
        period = online_response['period']
        for evidence in online_response['evidence']:
            suffix = evidence['evidence_id'].split(f'E-MD-{period.replace("-", "")}-', 1)[-1]
            product_evidence[period][suffix] = evidence
    # Choose the independently re-read later comparative column for 2025.
    current_by_period = {period: {field: parsed[(source_id, period, field)]['normalized'] for field in FIELDS} for source_id, period in [('midea-h1-2025', '2024-06-30'), ('midea-h1-2026', '2025-06-30'), ('midea-h1-2026', '2026-06-30')]}
    metrics = []
    derived = {}
    for period, values in current_by_period.items():
        previous = current_by_period.get(f'{int(period[:4]) - 1}-06-30')
        expected = {'cash-coverage': values['ocf'] / values['parent_profit'], 'profit-margin': values['parent_profit'] * Decimal('100') / values['revenue']}
        if previous:
            for field in FIELDS[:-1]:
                expected[field + '-yoy'] = (values[field] - previous[field]) * Decimal('100') / previous[field]
            difference = expected['parent_profit-yoy'] - expected['ocf-yoy']
            if difference > 0:
                expected['growth-tension'] = difference
        for suffix, computed in expected.items():
            evidence = product_evidence[period][suffix]
            actual = evidence['raw_value']
            okay = equal(computed, actual, Decimal('0.000000001'))
            metrics.append(check('PASS' if okay else 'FAIL', f'{period}:{suffix}', 'Independent Decimal arithmetic from original PDF fields; no product calculation imported as expected value', original_inputs=values if suffix in ['cash-coverage', 'profit-margin'] else {'current': values, 'previous': previous}, product_value=actual, independently_recomputed=computed, absolute_error=abs(computed - Decimal(str(actual))), tolerance='1e-9', product_observation='actual public response' if online_response and period == online_response['period'] and suffix in {e['evidence_id'].split(f'E-MD-{period.replace("-", "")}-', 1)[-1] for e in online_response['evidence']} else 'offline observed product evidence function'))
            derived[(period, suffix)] = computed
    reconciliations = []
    for period in ['2026-06-30', '2025-06-30']:
        components = {field: item['raw'] for (field, item_period), item in supplemental.items() if item_period == period and field.startswith('bridge_') and field != 'bridge_ocf'}
        total = sum(components.values(), Decimal('0'))
        disclosed_ocf = supplemental[('bridge_ocf', period)]['raw']
        reconciliations.append(check('PASS' if total == disclosed_ocf else 'FAIL', f'{period}:net_profit_to_ocf', 'Independent Decimal sum of 14 signed original report adjustments including consolidated net profit', original_components=components, original_report_ocf=disclosed_ocf, independently_recomputed=total, residual=total - disclosed_ocf, unit='千元'))
        derived[(period, 'ocf-bridge')] = total * Decimal('1000')
    nonrecurring = {field: item['raw'] for (field, period), item in supplemental.items() if field.startswith('nonrecurring_')}
    subtotal = nonrecurring['nonrecurring_disposal'] + nonrecurring['nonrecurring_financial'] + nonrecurring['nonrecurring_other']
    parent_net = subtotal + nonrecurring['nonrecurring_tax'] + nonrecurring['nonrecurring_minority']
    gap = current_by_period['2026-06-30']['parent_profit'] - current_by_period['2026-06-30']['adjusted_profit']
    reconciliations.append(check('PASS' if subtotal == nonrecurring['nonrecurring_subtotal'] and parent_net == nonrecurring['nonrecurring_parent'] and gap == parent_net * Decimal('1000') else 'FAIL', '2026-06-30:parent_minus_adjusted_equals_nonrecurring', 'Independently sum original financial/nonfinancial items, tax and minority; compare original parent profit minus adjusted parent profit', original_components=nonrecurring, independently_recomputed=parent_net, original_parent_minus_adjusted=gap / Decimal('1000'), residual=gap / Decimal('1000') - parent_net, unit='千元'))
    derived[('2026-06-30', 'profit-reconciliation')] = gap
    additional = [check('UNVERIFIED', 'roe_independent_recalculation', 'All six disclosed ROE values match original PDFs, but weighted average equity movements were not independently reconstructed; do not substitute opening/closing average equity', reason='Requires time-weighted capital movements and applicable accounting definition')]
    disclosure_text = source_map['midea-h1-2026'][1]['pages']['2']
    note = disclosure_text.split('备注：', 1)[1].split('3、公司股东', 1)[0].strip()
    note = re.sub(r'\s+', '', note)
    management_ok = all(term in note for term in ['汇率损失', '经常性损益', '衍生金融', '非经常性损益']) and '管理层披露' in base['event']['description'] and '持续影响仍需核验' in base['event']['description']
    additional.append(check('PASS' if management_ok else 'FAIL', 'management_fx_disclosure_attribution', 'Fresh original report page2 explicitly attributes adjusted profit decline to FX losses recurring vs derivatives gains nonrecurring; product labels attribution and remaining verification', physical_pdf_page=2, source_id='midea-h1-2026', original_snippet=note, product_description=base['event']['description']))
    additional.append(check('UNVERIFIED', 'independent_business_causality', 'Issuer management explanation is verified as a disclosure, not independently established as causal truth or a forecast', reason='Would require underlying exposures, hedge effectiveness and later-period evidence'))
    additional.append(check('UNVERIFIED', 'current_market_and_valuation', 'No authorized current price or valuation data is present in the committed public report dataset', reason='Requires actual licensed market/valuation feed; financial report verification cannot establish current valuation or trading ranges'))
    # Match every public numeric financial evidence against independently read or
    # calculated values and verify every source input separately.
    source_checks.append(check('PASS' if '本公司以人民币为记账本位币' in re.sub(r'\s+', '', source_map['gree-h1-2026'][1]['pages']['76']) else 'FAIL', 'gree-h1-2026:currency_cny', 'Independent original accounting policy page76 explicitly states RMB as functional currency', physical_pdf_page=76, original_snippet='本公司以人民币为记账本位币'))
    source_checks.append(check('PASS' if '金额单位为人民币千元' in re.sub(r'\s+', '', source_map['midea-h1-2025'][1]['pages']['96']) and '金额单位为人民币千元' in re.sub(r'\s+', '', full_result['pages']['96']) else 'FAIL', 'midea:currency_and_full_report_unit', 'Original 2025 and 2026 consolidated statements explicitly use RMB thousands; document-level unit for financial supplement also independently reconciled', physical_pdf_pages=[96, 203]))
    source_checks.append(check('PASS' if '2026年1月1日至2026年6月30日' in re.sub(r'\s+', '', source_map['gree-h1-2026'][1]['pages']['5']) else 'FAIL', 'gree-h1-2026:explicit_report_period', 'Fresh original glossary report-period definition', physical_pdf_page=5))
    online_checks = []
    input_checks = []
    if online_response:
        period = online_response['period']
        suffix_alias = {'nonrecurring-parent': 'nonrecurring_parent', 'nonrecurring-financial': 'nonrecurring_financial', 'bridge-inventory': 'bridge_inventory', 'bridge-receivables': 'bridge_receivables', 'bridge-payables': 'bridge_payables'}
        for evidence in online_response['evidence']:
            suffix = evidence['evidence_id'].split(f'E-MD-{period.replace("-", "")}-', 1)[-1]
            expected = derived.get((period, suffix))
            if suffix in FIELDS:
                expected = current_by_period[period][suffix]
            elif (suffix_alias.get(suffix, suffix), period) in supplemental:
                expected = supplemental[(suffix_alias.get(suffix, suffix), period)]['normalized']
            if evidence.get('raw_value') is not None and expected is not None:
                expected_basis = 'POINT_IN_TIME' if suffix in ['accounts_receivable', 'inventory', 'accounts_payable'] else 'H1_YTD'
                expected_unit = '%' if suffix in FIELDS and suffix == 'roe' or suffix.endswith('-yoy') or suffix == 'profit-margin' else '倍' if suffix == 'cash-coverage' else '个百分点' if suffix == 'growth-tension' else '亿元'
                shown = expected / Decimal('100000000') if expected_unit == '亿元' else expected
                expected_display = format(shown, '.2f') + expected_unit
                okay = equal(expected, evidence['raw_value'], Decimal('0.000000001')) and evidence.get('period_basis') == expected_basis and evidence.get('unit') == expected_unit and evidence.get('display_value') == expected_display
                online_checks.append(check('PASS' if okay else 'FAIL', evidence['evidence_id'], 'Actual public response value, display, unit and basis vs independent original-PDF extraction/calculation', original_or_recomputed=expected, product_value=evidence['raw_value'], display_value=evidence.get('display_value'), independently_formatted=expected_display, unit=evidence.get('unit'), basis=evidence.get('period_basis')))
            for input_index, value in enumerate(evidence.get('inputs', [])):
                if value['source_id'] == 'midea-h1-2026-full':
                    item = supplemental.get((value.get('field'), value['report_period']))
                else:
                    item = parsed.get((value['source_id'], value['report_period'], value.get('normalized_field')))
                if item is None:
                    # The management event is textual, so its numerical empty
                    # inputs require text attribution rather than numeric check.
                    input_checks.append(check('UNVERIFIED', f"{evidence['evidence_id']}:input{input_index}", 'No numeric original-row mapping; textual event or unsupported source input', source_id=value['source_id'], source_field=value.get('source_field')))
                    continue
                source = source_map[value['source_id']][0]
                okay = equal(item['raw'], value['raw_value']) and equal(item['normalized'], value['normalized_value']) and item['page'] == value.get('source_page') and item['basis'] == value['basis'] and value['source_url'] == source['url'] and value['raw_unit'] == item.get('unit', '千元') and value['source_column'] == item['column']
                input_checks.append(check('PASS' if okay else 'FAIL', f"{evidence['evidence_id']}:input{input_index}", 'Actual public evidence input value, unit/basis, source URL and physical page vs independent PDF row', original_raw=item['raw'], product_raw=value['raw_value'], source_id=value['source_id'], source_page=value.get('source_page'), source_field=value.get('source_field'), source_url=value.get('source_url'), basis=value['basis']))
    else:
        online_checks.append(check('UNVERIFIED', 'actual_public_evidence', 'No actual public response available'))
    cross_source = []
    for field in FIELDS:
        later = parsed[('midea-h1-2026', '2025-06-30', field)]['normalized']
        earlier = parsed[('midea-h1-2025', '2025-06-30', field)]['normalized']
        cross_source.append(check('PASS' if later == earlier else 'FAIL', f'2025-06-30:cross_source:{field}', 'Independently read 2025 report current column vs 2026 report comparison column; source conflict differs from business signal tension', original_2025_report=earlier, original_2026_report_comparative=later, delta=later-earlier))
    if online_response:
        mislabeled = [{'evidence_id': evidence['evidence_id'], 'source_name': evidence.get('source_name'), 'source_url': evidence.get('source_url')} for evidence in online_response['evidence'] if 'disc.static.szse.cn' in (evidence.get('source_url') or '') and '巨潮资讯' in (evidence.get('source_name') or '')]
        source_checks.append(check('FAIL' if mislabeled else 'PASS', 'public_source_platform_label', 'Actual public evidence platform display name must agree with first source URL host; SZSE source should be identified as 深交所 rather than 巨潮资讯', affected_evidence=mislabeled, recommendation='Derive display platform from source metadata/URL after user approval; numeric values, URLs and pages already verified. Production left unchanged.'))
    full_statement_checks = []
    for field, page, anchor in [('revenue', 98, '其中：营业收入'), ('parent_profit', 98, '归属于母公司股东的净利润'), ('ocf', 99, '经营活动产生的现金流量净额')]:
        amounts, snippet = locate_row(full_result['pages'][str(page)], anchor)
        for index, period in enumerate(['2026-06-30', '2025-06-30']):
            statement_value = amounts[index] * Decimal('1000')
            summary_value = parsed[('midea-h1-2026', period, field)]['normalized']
            full_statement_checks.append(check('PASS' if statement_value == summary_value else 'FAIL', f'{period}:{field}:full_vs_summary', 'Independent full consolidated statement vs separate summary PDF', original_full_statement=statement_value, original_summary=summary_value, physical_pdf_page=page, original_snippet=snippet))
    net_profit_amounts, snippet = locate_row(full_result['pages']['98'], '五、净利润')
    for index, period in enumerate(['2026-06-30', '2025-06-30']):
        full_statement_checks.append(check('PASS' if net_profit_amounts[index] == supplemental[('bridge_net_profit', period)]['raw'] else 'FAIL', f'{period}:consolidated_profit:bridge_vs_statement', 'Consolidated net profit row, not parent-only profit; independent original statement vs supplemental bridge', original_statement=net_profit_amounts[index], original_bridge=supplemental[('bridge_net_profit', period)]['raw'], unit='千元', physical_pdf_pages=[98, 177], original_snippet=snippet))
    costs, cost_snippet = locate_row(full_result['pages']['98'], '其中：营业成本')
    coverage_opportunities = [{'item': 'gross_margin_available_original_not_connected', 'status': 'UNVERIFIED', 'reason': 'Product correctly declares gross margin unavailable in its connected fields; full original statement now independently observed to contain营业成本. This is a coverage improvement opportunity, not a fabricated product value.', 'original_cost_thousand_cny': [-value for value in costs[:2]], 'physical_pdf_page': 98, 'original_snippet': cost_snippet, 'recommendation': 'After approval, extract original cost with explicit revenue/cost scope, add deterministic gross-margin calculation and regression; no production change in this audit.'}]
    groups = {'source_checks': source_checks, 'base_fields': values_checks, 'supplement_fields': supplement_checks, 'metrics': metrics, 'reconciliations': reconciliations, 'cross_source_checks': cross_source, 'full_statement_checks': full_statement_checks, 'public_numeric_evidence': online_checks, 'public_evidence_inputs': input_checks, 'boundaries_and_attribution': additional}
    all_checks = [row for rows in groups.values() for row in rows]
    counts = {status: sum(row['status'] == status for row in all_checks) for status in ['PASS', 'FAIL', 'UNVERIFIED']}
    report = {'audit_started_at': min(result['started_at'] for result in fetched), 'audit_finished_at': utc(), 'source_commit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(), 'audit_scope': 'Independent original-document numeric accuracy, reproducible calculations, source provenance and public response cross-check; not a forensic audit or all-conclusions semantic guarantee', 'method': {'original_source_fetch': 'Four fresh HTTPS downloads (not cached source PDFs)', 'independent_parser': f'pdfplumber {pdfplumber.__version__}; product extractor uses pypdf', 'independent_calculator': 'Python Decimal precision40; separately written formula and signed sums', 'expected_value_isolation': 'No product metrics/extractor imported to compute expectations; Node product evidence function invoked only to capture observed values', 'source_date_scope': 'Physical report period and source URL verified; exact announcement index publication dates UNVERIFIED', 'frozen_version': '62141347a0a8e48d779ad9c3dad15463e38e22ac'}, 'sources': source_rows, 'counts': counts, 'coverage_opportunities': coverage_opportunities, **groups}
    report['audit_harness_repairs'] = [{'issue': 'Initial literal management-note assertion falsely failed on PDF line break inside derivatives keyword', 'repair': 'Normalize whitespace for assertion; unmodified original page retained in ignored cache', 'production_changed': False, 'regression': 'Entire audit rerun'}]
    return report


def write_report(report):
    (OUTPUT / 'financial-verification.json').write_text(json.dumps(report, ensure_ascii=False, indent=2, default=decimal_text) + '\n', encoding='utf-8')
    lines = ['# 独立财报数值验收', '', f"验收 UTC：{report['audit_finished_at']}。冻结版本：`{report['source_commit']}`。", '', '**范围：核对发行人公开原文与产品值，不证明发行人披露绝对真实，也不证明所有 AI 语义和业务因果正确。**', '', '方法：重新下载四份官方 PDF，以独立 pdfplumber 解析（产品使用 pypdf），独立 Python Decimal 精度 40 复算；未使用产品计算函数作为预期值。部分产品实际值来自同版本离线证据输出，当前期次同时与公网实际响应交叉核对。', '', f"结果：PASS {report['counts']['PASS']} / FAIL {report['counts']['FAIL']} / UNVERIFIED {report['counts']['UNVERIFIED']}。", '', '## 原始来源', '', '|来源|新下载 SHA256|物理 PDF 页|SHA 校验|', '|---|---|---|---|']
    for source in report['sources']:
        pages = ','.join(str(page) for page in ([2] if source['id'] == 'midea-h1-2026' else [7] if source['id'] in ['midea-h1-2025', 'gree-h1-2026'] else [96,97,177,204]))
        lines.append(f"|[{source['id']}]({source['requested_url']})|`{source['sha256']}`|{pages}|{source['sha_status']}|")
    lines += ['', '页码统一是从 1 开始的物理 PDF 页。格力 PDF 第 7 页页脚印为第 6 页，评审应按 PDF 查看器页码定位。精确公告发布日期仅由 URL 路径交叉匹配，没有独立核验官方公告索引，因此为 UNVERIFIED。', '', '## 基础财务字段（原值及复算值并排）', '', '|来源/期次/字段|原文值（单位）|产品原值|产品标准值（元，ROE 为%）|独立换算值|状态|PDF页|', '|---|---:|---:|---:|---:|---|---:|']
    for row in report['base_fields']:
        lines.append(f"|{row['item']}|{row['original_raw']} {row['raw_unit']}|{row['product_raw']}|{row['product_normalized']}|{row['independently_normalized']}|{row['status']}|{row['physical_pdf_page']}|")
    lines += ['', '## 全文附注与资产负债字段', '', '|字段/期次|原文千元|产品千元|产品元|独立换算元|状态|PDF页/口径|', '|---|---:|---:|---:|---:|---|---|']
    for row in report['supplement_fields']:
        lines.append(f"|{row['item']}|{row['original_raw']}|{row['product_raw']}|{row['product_normalized']}|{row['independently_normalized']}|{row['status']}|{row['physical_pdf_page']} / {row['basis']}|")
    lines += ['', '## 独立复算', '', '现金覆盖代理=合并经营现金流÷归母净利润；归母盈利比率=归母净利润÷营业收入×100；同比=(本期−同期)÷同期×100；经营张力=利润同比−现金流同比。覆盖代理分子分母少数股东口径不同，算术正确不等于合并利润现金含量。', '', '|期次/指标|产品值|独立 Decimal 复算值|绝对误差|状态|观察方式|', '|---|---:|---:|---:|---|---|']
    for row in report['metrics']:
        lines.append(f"|{row['item']}|{row['product_value']}|{row['independently_recomputed']}|{row['absolute_error']}|{row['status']}|{row['product_observation']}|")
    lines += ['', '|勾稽|独立千元合计|原文/差额|残差|状态|', '|---|---:|---:|---:|---|']
    for row in report['reconciliations']:
        lines.append(f"|{row['item']}|{row['independently_recomputed']}|{row.get('original_report_ocf',row.get('original_parent_minus_adjusted'))}|{row['residual']}|{row['status']}|")
    lines += ['', '## 全文与摘要独立交叉核验', '', '|字段/期次|全文原值|摘要/现金流桥接原值|状态|PDF页|', '|---|---:|---:|---|---|']
    for row in report['full_statement_checks']:
        lines.append(f"|{row['item']}|{row.get('original_full_statement', row.get('original_statement'))}|{row.get('original_summary', row.get('original_bridge'))}|{row['status']}|{row.get('physical_pdf_page', row.get('physical_pdf_pages'))}|")
    lines += ['', '## 来源名称问题与修复建议', '']
    for row in report['source_checks']:
        if row['status'] == 'FAIL':
            lines.append(f"- **FAIL — {row['item']}**：{row['method']}。{row.get('recommendation','')} 影响 {len(row.get('affected_evidence', []))} 个当前公网证据节点。")
    lines += ['', '审计脚本第一次以字面匹配判断管理层说明时，PDF 换行拆开“衍生金融”造成误报。只修复审计脚本的空白归一化后完整重跑；没有修改生产代码。', '', '可选补深：全文 PDF 第98页已有营业成本字段，当前产品仍如实标记毛利率未覆盖；可经确认后接入同口径成本并补算毛利率。该项不代表已完成接入。']
    lines += ['', '## 不能自动宣布通过的内容', '']
    for row in report['boundaries_and_attribution']:
        lines.append(f"- **{row['status']} — {row['item']}**：{row['method']}。{row.get('reason','')}")
    lines += ['', '公司汇兑解释已对照原文验证为“公司披露”，不能升级为独立证明的经营原因。ROE 原文值全部核对通过；缺乏独立完整的时间加权权益重建，ROE 独立重算为 UNVERIFIED。未配置授权行情与估值，不能用半年报推断当前股价或估值。', '', '完整逐项状态、原文行片段、原始下载时间及公网每个 evidence input 的交叉核对见 [financial-verification.json](financial-verification.json)。新增审计程序为 [audit_financial_independent.py](../../tools/audit_financial_independent.py)。生产代码和部署未改动。']
    (OUTPUT / 'financial-verification.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')


def utc():
    return dt.datetime.now(dt.timezone.utc).isoformat()


def load_json(path):
    return json.loads(path.read_text(encoding='utf-8'), parse_float=Decimal)


def fetch_source(source):
    request = urllib.request.Request(source['url'], headers={'User-Agent': 'StockInsightIndependentAudit/1.0'})
    started = utc()
    with urllib.request.urlopen(request, timeout=90) as response:
        body = response.read(40_000_001)
        metadata = {'requested_url': source['url'], 'final_url': response.url,
                    'http_status': response.status, 'content_type': response.headers.get('Content-Type'),
                    'last_modified': response.headers.get('Last-Modified'), 'started_at': started,
                    'retrieved_at': utc(), 'size_bytes': len(body),
                    'sha256': hashlib.sha256(body).hexdigest()}
    if not body.startswith(b'%PDF-') or len(body) > 40_000_000:
        raise ValueError('Original URL did not return a bounded PDF')
    (CACHE / (source['id'] + '.pdf')).write_bytes(body)
    metadata['product_sha256'] = source.get('sha256')
    metadata['sha_status'] = 'PASS' if source.get('sha256') == metadata['sha256'] else 'FAIL'
    audit_additional_pages = {'gree-h1-2026': [5, 6, 76], 'midea-h1-2025': [5, 6, 96], 'midea-h1-2026-full': [98, 99, 203]}
    pages_to_read = sorted(set(source.get('pages', []) + [source['page'], 1] + audit_additional_pages.get(source['id'], [])))
    with pdfplumber.open(CACHE / (source['id'] + '.pdf')) as document:
        metadata['pdf_pages'] = len(document.pages)
        metadata['extraction_parser'] = f'pdfplumber {pdfplumber.__version__}'
        texts = {}
        for page in pages_to_read:
            texts[str(page)] = document.pages[page - 1].extract_text(x_tolerance=2, y_tolerance=3) or ''
            (CACHE / f"{source['id']}-page-{page}.txt").write_text(texts[str(page)], encoding='utf-8')
        metadata['pages'] = texts
    (CACHE / (source['id'] + '-fresh-source.json')).write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding='utf-8')
    return metadata


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--prepare', action='store_true')
    args = parser.parse_args()
    CACHE.mkdir(parents=True, exist_ok=True)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    base = load_json(ROOT / 'data' / 'public_reports.json')
    supplement = load_json(ROOT / 'data' / 'report_supplement.json')
    sources = base['sources'] + [supplement['source']]
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        fetched = list(pool.map(fetch_source, sources))
    print(json.dumps([{'id': source['id'], 'sha_status': result['sha_status'], 'pages': result['pdf_pages']} for source, result in zip(sources, fetched)], ensure_ascii=False))
    if args.prepare:
        return
    report = evaluate(base, supplement, sources, fetched)
    write_report(report)
    report['method']['original_baseline'] = report['method'].pop('frozen_version')
    report['method']['tested_commit'] = report['source_commit']
    (OUTPUT / 'financial-verification.json').write_text(json.dumps(report, ensure_ascii=False, indent=2, default=decimal_text) + '\n', encoding='utf-8')
    print(json.dumps({'status': 'FAIL' if report['counts']['FAIL'] else 'PASS_WITH_UNVERIFIED_BOUNDARIES', 'counts': report['counts'], 'outputs': [str((OUTPUT / name).relative_to(ROOT)) for name in ['financial-verification.json', 'financial-verification.md']]}, ensure_ascii=False))
    if report['counts']['FAIL']:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
