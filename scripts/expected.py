# -*- coding: utf-8 -*-
"""独立算出各个筛选场景应有的条数与统计值，供 verify.js 断言。

刻意不复用 app.js 的逻辑，用最直白的写法重算一遍。
用法：python scripts/expected.py  → 生成 scripts/expected.json
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
JS_PATH = ROOT / "data" / "papers.js"

text = JS_PATH.read_text(encoding="utf-8")
start = text.index("[")
end = text.rindex("]") + 1
rows = json.loads(text[start:end])

FIELDS = ["m1_model", "m2_deriv", "m3_struct", "m4_params", "m5_simset", "m6_plot"]


def pick(type_=None, q=None, missing=None, repro=None, year=None):
    out = []
    for r in rows:
        if type_ and r["paper_type"] != type_:
            continue
        if repro and r["repro"] != repro:
            continue
        if year and str(r["year"]) != str(year):
            continue
        if missing and r[missing] not in ("0", "1"):
            continue
        if q:
            hay = " ".join([r["title"], r["journal"], r["plant"], r["ctrl_type"],
                            r["notes"], str(r["year"]), r["doi"]]).lower()
            if not all(t in hay for t in q.lower().split()):
                continue
        out.append(r)
    return out


stat_rows = rows

field_counts = {}
for f in FIELDS:
    vals = [r[f] for r in stat_rows]
    field_counts[f] = {k: vals.count(k) for k in ("2", "1", "0", "NA")}

expected = {
    "total": len(rows),
    "stat_n": len(stat_rows),
    "repro_counts": {k: sum(1 for r in stat_rows if r["repro"] == k) for k in ("能", "存疑", "不能")},
    "field_counts": field_counts,
    "scenarios": {
        "all": len(pick()),
        "type_仿真": len(pick(type_="仿真")),
        "type_实验": len(pick(type_="实验")),
        "q_温度": len(pick(q="温度")),
        "missing_m4": len(pick(missing="m4_params")),
        "missing_m6": len(pick(missing="m6_plot")),
        "repro_不能": len(pick(repro="不能")),
        "year_2023": len(pick(year="2023")),
        "combo_仿真_m4": len(pick(type_="仿真", missing="m4_params")),
    },
}

out = ROOT / "scripts" / "expected.json"
out.write_text(json.dumps(expected, ensure_ascii=False, indent=1), encoding="utf-8")
print(json.dumps(expected, ensure_ascii=False, indent=1))
print("\n已写入 %s" % out)