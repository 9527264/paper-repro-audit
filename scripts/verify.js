/* 冒烟测试：用极简 DOM 桩跑真实 app.js，断言渲染结果与 expected.json 一致。
   用法：node scripts/verify.js   （退出码 0 表示通过） */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const expected = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'expected.json'), 'utf8'));

let failures = 0;
function ok(cond, msg, extra) {
  if (cond) { console.log('  ✓ ' + msg); }
  else { failures++; console.log('  ✗ ' + msg + (extra !== undefined ? '  → 实际: ' + extra : '')); }
}

/* ---------- DOM 桩 ---------- */
function makeEl(id) {
  return {
    id: id, value: '', textContent: '', innerHTML: '', href: '',
    options: [], handlers: {},
    addEventListener(t, f) { (this.handlers[t] = this.handlers[t] || []).push(f); },
    appendChild(o) { this.options.push(o); },
    querySelectorAll() { return []; },
    getAttribute() { return null; },
    fire(t) { (this.handlers[t] || []).forEach((f) => f({ target: this, preventDefault() {} })); }
  };
}
const els = {};
const document = {
  readyState: 'complete',
  getElementById(id) { return (els[id] = els[id] || makeEl(id)); },
  createElement() { return { value: '', textContent: '' }; },
  addEventListener() {},
  querySelectorAll() { return []; }
};
const window = {};

const sandbox = { window: window, document: document, console: console, encodeURIComponent: encodeURIComponent };
sandbox.window.document = document;
vm.createContext(sandbox);

/* 加载数据与逻辑（真实文件，不是副本） */
vm.runInContext(fs.readFileSync(path.join(ROOT, 'data', 'papers.js'), 'utf8'), sandbox, { filename: 'papers.js' });
vm.runInContext(fs.readFileSync(path.join(ROOT, 'assets', 'app.js'), 'utf8'), sandbox, { filename: 'app.js' });

const tableHost = els['table-host'];
const statsHost = els['stats'];
const countEl = els['f-count'];

function rowCount() {
  const m = tableHost.innerHTML.match(/<tr class="row/g);
  return m ? m.length : 0;
}

console.log('\n[1] 初始渲染');
ok(rowCount() === expected.scenarios.all, '全部数据行数 = ' + expected.scenarios.all, rowCount());
ok(statsHost.innerHTML.indexOf('>' + expected.stat_n + '<small>篇') > -1,
  '统计块显示 ' + expected.stat_n + ' 篇');
ok((tableHost.innerHTML.match(/badge-sample/g) || []).length === expected.samples,
  '示例徽标数 = ' + expected.samples, (tableHost.innerHTML.match(/badge-sample/g) || []).length);
ok(/NaN|undefined|Infinity/.test(tableHost.innerHTML + statsHost.innerHTML) === false,
  '渲染结果里没有 NaN / undefined');
ok(countEl.textContent.indexOf(String(expected.total)) > -1, '计数文案含总条数 ' + expected.total, countEl.textContent);

console.log('\n[2] 筛选与搜索');
function apply(fn) { fn(); }
function setSelect(id, v) { els[id].value = v; els[id].fire('change'); }
function setSearch(v) { els['f-q'].value = v; els['f-q'].fire('input'); }
function reset() { els['f-reset'].fire('click'); }

setSelect('f-type', '仿真');
ok(rowCount() === expected.scenarios.type_仿真, '类型=仿真 → ' + expected.scenarios.type_仿真, rowCount());
setSelect('f-type', '实验');
ok(rowCount() === expected.scenarios.type_实验, '类型=实验 → ' + expected.scenarios.type_实验, rowCount());
reset();

setSearch('温度');
ok(rowCount() === expected.scenarios.q_温度, '搜「温度」→ ' + expected.scenarios.q_温度, rowCount());
setSearch('液压 控制');
ok(rowCount() > 0, '多词搜索「液压 控制」命中 ' + rowCount() + ' 条（空格＝并且）');
reset();

setSelect('f-missing', 'm4_params');
ok(rowCount() === expected.scenarios.missing_m4, '只看 m4 缺失 → ' + expected.scenarios.missing_m4, rowCount());
reset();
setSelect('f-missing', 'm6_plot');
ok(rowCount() === expected.scenarios.missing_m6, '只看 m6 缺失 → ' + expected.scenarios.missing_m6, rowCount());
reset();

setSelect('f-repro', '不能');
ok(rowCount() === expected.scenarios.repro_不能, '总评=不能 → ' + expected.scenarios.repro_不能, rowCount());
reset();

setSelect('f-year', '2023');
ok(rowCount() === expected.scenarios.year_2023, '年份=2023 → ' + expected.scenarios.year_2023, rowCount());
reset();

setSelect('f-type', '仿真');
setSelect('f-missing', 'm4_params');
ok(rowCount() === expected.scenarios.combo_仿真_m4, '组合：仿真 ∧ m4 缺失 → ' + expected.scenarios.combo_仿真_m4, rowCount());
reset();
ok(rowCount() === expected.scenarios.all, '重置后回到 ' + expected.scenarios.all + ' 条', rowCount());

console.log('\n[3] 统计口径');
Object.keys(expected.field_counts).forEach(function (f) {
  const want = expected.field_counts[f];
  const got = { '2': 0, '1': 0, '0': 0, 'NA': 0 };
  sandbox.window.PAPERS.forEach(function (r) {
    const v = String(r[f]).toUpperCase();
    got[v] = (got[v] || 0) + 1;
  });
  ok(JSON.stringify(got) === JSON.stringify(want), f + ' 计数 ' + JSON.stringify(want), JSON.stringify(got));
});

console.log('\n[4] 选项与链接');
ok(els['f-year'].options.length === expected_year_options(), '年份下拉有 ' + els['f-year'].options.length + ' 个选项');
ok(els['f-missing'].options.length === 6, '缺失项下拉 6 个选项', els['f-missing'].options.length);
ok(String(els['nav-submit'].href).indexOf('issues/new') > -1, '提交按钮指向 Issue 表单', els['nav-submit'].href);

function expected_year_options() {
  const years = {};
  sandbox.window.PAPERS.forEach(function (r) { years[r.year] = 1; });
  return Object.keys(years).length;
}

console.log('\n' + (failures ? '失败 ' + failures + ' 项' : '全部通过'));
process.exit(failures ? 1 : 0);