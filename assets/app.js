/* 控制类论文可复现性标注库 —— 前端逻辑（原生 JS，无依赖） */
(function () {
  'use strict';

  var FIELDS = [
    { key: 'm1_model',  name: '对象模型',   short: '模型', hint: '有没有数学模型，且参数带数值' },
    { key: 'm2_deriv',  name: '建模过程',   short: '推导', hint: '有没有从物理关系推到传递函数/状态方程的步骤' },
    { key: 'm3_struct', name: '控制器结构', short: '结构', hint: '有没有控制律公式或框图' },
    { key: 'm4_params', name: '控制器参数', short: '参数', hint: '有没有能直接抄的 Kp/Ti/Td 或算法超参数' },
    { key: 'm5_simset', name: '仿真设置',   short: '设置', hint: '步长、时长、初值、幅值给了几项' },
    { key: 'm6_plot',   name: '响应曲线',   short: '曲线', hint: '有没有能读出超调、调节时间的时域图' }
  ];
  /* ★ 上线前改这一行：换成你自己的 GitHub 用户名/仓库名 */
  var REPO = '9527264/paper-repro-audit';
  var REPRO_RANK = { '能': 2, '存疑': 1, '不能': 0 };
  var TYPE_ORDER = { '工程': 2, '实验': 1, '仿真': 0 };

  var state = {
    q: '',
    type: '',
    year: '',
    repro: '',
    missing: '',
    sort: 'year',
    dir: -1,
    open: {}
  };

  /* ---------- 工具 ---------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function isSample(r) { return String(r.title || '').indexOf('示例') === 0; }
  function score(r, k) {
    var v = String(r[k] || '').toUpperCase();
    return v === 'NA' ? 'NA' : v;
  }
  function pct(a, b) { return b > 0 ? (a / b * 100) : 0; }
  function pctText(a, b) { return b > 0 ? (a / b * 100).toFixed(0) + '%' : '—'; }

  function all() { return Array.isArray(window.PAPERS) ? window.PAPERS : []; }

  /* ---------- 筛选 + 排序 ---------- */
  function filteredRows() {
    var rows = all().slice();
    var q = state.q.trim().toLowerCase();
    var terms = q ? q.split(/\s+/) : [];

    rows = rows.filter(function (r) {
      if (state.type && r.paper_type !== state.type) return false;
      if (state.year && String(r.year) !== state.year) return false;
      if (state.repro && r.repro !== state.repro) return false;
      if (state.missing) {
        var v = score(r, state.missing);
        if (v !== '0' && v !== '1') return false;
      }
      if (terms.length) {
        var hay = [r.title, r.journal, r.plant, r.ctrl_type, r.notes, r.year, r.doi]
          .join(' ').toLowerCase();
        for (var i = 0; i < terms.length; i++) {
          if (hay.indexOf(terms[i]) === -1) return false;
        }
      }
      return true;
    });

    var key = state.sort, dir = state.dir;
    rows.sort(function (a, b) {
      var x, y;
      if (key === 'year') {
        x = parseInt(a.year, 10) || 0; y = parseInt(b.year, 10) || 0;
        return (x - y) * dir;
      }
      if (key === 'repro') {
        x = REPRO_RANK[a.repro] != null ? REPRO_RANK[a.repro] : -1;
        y = REPRO_RANK[b.repro] != null ? REPRO_RANK[b.repro] : -1;
        return (x - y) * dir;
      }
      if (key === 'type') {
        x = TYPE_ORDER[a.paper_type] != null ? TYPE_ORDER[a.paper_type] : -1;
        y = TYPE_ORDER[b.paper_type] != null ? TYPE_ORDER[b.paper_type] : -1;
        return (x - y) * dir;
      }
      x = String(a.title || ''); y = String(b.title || '');
      return x.localeCompare(y, 'zh-Hans-CN') * dir;
    });
    return rows;
  }

  /* ---------- 统计 ---------- */
  function statRows(shown) {
    var real = shown.filter(function (r) { return !isSample(r); });
    return real.length ? real : shown;
  }

  function renderStats(shown) {
    var host = document.getElementById('stats');
    if (!host) return;
    var rows = statRows(shown);
    var n = rows.length;
    var cOk = rows.filter(function (r) { return r.repro === '能'; }).length;
    var cMid = rows.filter(function (r) { return r.repro === '存疑'; }).length;
    var cBad = rows.filter(function (r) { return r.repro === '不能'; }).length;
    var samples = all().length - all().filter(function (r) { return !isSample(r); }).length;

    var html = '';
    html += '<div class="headline">';
    html += '<div><div class="big">' + n + '<small>篇</small></div><div class="cap">统计样本</div></div>';
    html += '<div><div class="big">' + pctText(cOk, n) + '</div><div class="cap">判定「能复现」</div></div>';
    html += '<div><div class="big">' + pctText(cMid, n) + '</div><div class="cap">判定「存疑」</div></div>';
    html += '<div><div class="big">' + pctText(cBad, n) + '</div><div class="cap">判定「不能」</div></div>';
    html += '</div>';

    html += '<div class="fields">';
    FIELDS.forEach(function (f) {
      var c2 = 0, c1 = 0, c0 = 0, cna = 0;
      rows.forEach(function (r) {
        var v = score(r, f.key);
        if (v === '2') c2++; else if (v === '1') c1++;
        else if (v === '0') c0++; else cna++;
      });
      var denom = c2 + c1 + c0;
      var miss = pct(c1 + c0, denom);
      var w2 = pct(c2, n), w1 = pct(c1, n), w0 = pct(c0, n), wna = pct(cna, n);
      html += '<div class="field">'
        + '<div class="field-head"><span>' + f.name + '</span>'
        + '<span class="rate">未给全 ' + (denom ? miss.toFixed(0) : '—') + (denom ? '%' : '') + '</span></div>'
        + '<div class="bar" title="已给出 ' + c2 + ' · 部分 ' + c1 + ' · 未给出 ' + c0 + ' · 不适用 ' + cna + '">'
        + (w2 > 0 ? '<i class="s2" style="width:' + w2 + '%"></i>' : '')
        + (w1 > 0 ? '<i class="s1" style="width:' + w1 + '%"></i>' : '')
        + (w0 > 0 ? '<i class="s0" style="width:' + w0 + '%"></i>' : '')
        + (wna > 0 ? '<i class="sna" style="width:' + wna + '%"></i>' : '')
        + '</div></div>';
    });
    html += '</div>';

    html += '<div class="legend"><span class="l2">已给出（2）</span><span class="l1">给得不全（1）</span>'
      + '<span class="l0">未给出（0）</span><span class="lna">不适用（NA）</span></div>';

    if (samples > 0) {
      var realCount = all().length - samples;
      html += '<div class="legend">另有 ' + samples + ' 条示例数据，仅用于演示，不计入统计'
        + (realCount === 0 ? '（当前尚无正式数据，上方统计取自示例）' : '') + '。</div>';
    }
    host.innerHTML = html;
  }

  /* ---------- 表格 ---------- */
  function cellHtml(r, key) {
    var v = score(r, key);
    var cls = v === 'NA' ? 'cNA' : ('c' + v);
    var txt = v === 'NA' ? '–' : v;
    var f = FIELDS.filter(function (x) { return x.key === key; })[0];
    return '<span class="cell ' + cls + '" title="' + esc((f ? f.name : key) + '：' + (v === 'NA' ? '不适用' : v)) + '">' + txt + '</span>';
  }

  /* 展开行里把六项名称与得分一起列出来，避免只看到一串数字 */
  function sixLineHtml(r) {
    var parts = FIELDS.map(function (f) {
      var v = score(r, f.key);
      var cls = v === 'NA' ? 'cNA' : ('c' + v);
      var txt = v === 'NA' ? '–' : v;
      return '<span class="six-item" title="' + esc(f.hint) + '">'
        + esc(f.name) + '<span class="cell ' + cls + '">' + txt + '</span></span>';
    });
    return '<div class="six-line"><span class="dl">六项复现信息：</span>' + parts.join('') + '</div>';
  }

  function renderTable(shown) {
    var host = document.getElementById('table-host');
    if (!host) return;

    if (!all().length) {
      host.innerHTML = '<div class="empty"><strong>还没有数据</strong>'
        + '把标好的论文填进 <code>data/papers.csv</code>，运行 <code>scripts/更新数据.bat</code> 后刷新本页。</div>';
      return;
    }
    if (!shown.length) {
      host.innerHTML = '<div class="empty"><strong>没有符合条件的论文</strong>换个筛选条件，或点「重置」。</div>';
      return;
    }

    var h = '<div class="table-wrap"><table><thead><tr>';
    h += '<th class="sortable" data-sort="title">论文题目</th>';
    h += '<th>期刊</th>';
    h += '<th class="sortable" data-sort="year">年份</th>';
    h += '<th class="sortable" data-sort="type">类型</th>';
    h += '<th>对象 / 控制方法</th>';
    h += '<th class="six"><div class="six-title" title="六项依次为：对象模型、建模过程、控制器结构、控制器参数、仿真设置、响应曲线">六项复现信息</div><div class="cells six-labels">';
    FIELDS.forEach(function (f) {
      h += '<span title="' + esc(f.name + '：' + f.hint) + '">' + esc(f.short) + '</span>';
    });
    h += '</div></th>';
    h += '<th class="sortable" data-sort="repro">总评</th>';
    h += '</tr></thead><tbody>';

    shown.forEach(function (r) {
      var open = !!state.open[r.id];
      var doiLink = (r.doi && r.doi !== '无')
        ? '<a href="https://doi.org/' + esc(r.doi) + '" target="_blank" rel="noopener">' + esc(r.doi) + '</a>'
        : '<span class="muted">无</span>';
      var sampleBadge = isSample(r) ? '<span class="badge-sample">示例</span>' : '';
      var tagCls = r.repro === '能' ? 'ok' : (r.repro === '存疑' ? 'mid' : 'bad');

      h += '<tr class="row' + (open ? ' open' : '') + '" data-id="' + esc(r.id) + '">';
      h += '<td class="title">' + esc(r.title) + sampleBadge + '</td>';
      h += '<td class="muted nowrap">' + esc(r.journal) + '</td>';
      h += '<td class="nowrap">' + esc(r.year) + '</td>';
      h += '<td class="nowrap muted">' + esc(r.paper_type) + '</td>';
      h += '<td class="nowrap muted">' + esc(r.plant) + ' / ' + esc(r.ctrl_type) + '</td>';
      h += '<td><div class="cells">' + FIELDS.map(function (f) { return cellHtml(r, f.key); }).join('') + '</div></td>';
      h += '<td><span class="tag ' + tagCls + '">' + esc(r.repro) + '</span></td>';
      h += '</tr>';

      if (open) {
        h += '<tr class="detail"><td colspan="7">';
        h += '<div><span class="dl">备注：</span>' + (r.notes && r.notes !== '无' ? esc(r.notes) : '<span class="muted">无</span>') + '</div>';
        h += sixLineHtml(r);
        h += '<div class="row2">DOI：' + doiLink
          + ' · 标注人：' + esc(r.annotator || '—')
          + ' · 标注日期：' + esc(r.date || '—')
          + ' · 编号：' + esc(r.id)
          + ' · <a href="https://github.com/' + REPO + '/issues/new?template=' + encodeURIComponent('submit-paper.yml')
          + '&amp;title=' + encodeURIComponent('[纠错] ' + r.id) + '" target="_blank" rel="noopener">提交纠错</a></div>';
        h += '</td></tr>';
      }
    });

    h += '</tbody></table></div>';
    host.innerHTML = h;

    // 点击行展开 / 收起
    Array.prototype.forEach.call(host.querySelectorAll('tr.row'), function (tr) {
      tr.addEventListener('click', function (e) {
        if (e.target.closest('a')) return;
        var id = tr.getAttribute('data-id');
        if (state.open[id]) delete state.open[id]; else state.open[id] = true;
        render();
      });
    });

    // 表头排序
    Array.prototype.forEach.call(host.querySelectorAll('th.sortable'), function (th) {
      th.addEventListener('click', function () {
        var k = th.getAttribute('data-sort');
        if (state.sort === k) state.dir = -state.dir; else { state.sort = k; state.dir = (k === 'title' ? 1 : -1); }
        render();
      });
    });
  }

  /* ---------- 工具条 ---------- */
  function buildSelects() {
    var years = {};
    all().forEach(function (r) { if (r.year) years[r.year] = 1; });
    var yearSel = document.getElementById('f-year');
    if (yearSel && yearSel.options.length <= 1) {
      Object.keys(years).sort().reverse().forEach(function (y) {
        var o = document.createElement('option');
        o.value = y; o.textContent = y + ' 年';
        yearSel.appendChild(o);
      });
    }
    var missSel = document.getElementById('f-missing');
    if (missSel && missSel.options.length <= 1) {
      FIELDS.forEach(function (f) {
        var o = document.createElement('option');
        o.value = f.key; o.textContent = f.name + ' 缺失';
        missSel.appendChild(o);
      });
    }
  }

  function bindControls() {
    var q = document.getElementById('f-q');
    if (q) q.addEventListener('input', function () { state.q = q.value; render(); });

    [['f-type', 'type'], ['f-year', 'year'], ['f-repro', 'repro'], ['f-missing', 'missing']].forEach(function (pair) {
      var el = document.getElementById(pair[0]);
      if (!el) return;
      el.addEventListener('change', function () { state[pair[1]] = el.value; render(); });
    });

    var reset = document.getElementById('f-reset');
    if (reset) reset.addEventListener('click', function () {
      state.q = ''; state.type = ''; state.year = ''; state.repro = ''; state.missing = '';
      var q2 = document.getElementById('f-q'); if (q2) q2.value = '';
      ['f-type', 'f-year', 'f-repro', 'f-missing'].forEach(function (id) {
        var e = document.getElementById(id); if (e) e.value = '';
      });
      render();
    });
  }

  /* ---------- 主渲染 ---------- */
  function render() {
    var shown = filteredRows();
    renderStats(shown);
    renderTable(shown);
    var cnt = document.getElementById('f-count');
    if (cnt) {
      var total = all().length;
      cnt.textContent = shown.length === total
        ? ('共 ' + total + ' 条')
        : ('筛出 ' + shown.length + ' / ' + total + ' 条');
    }
  }

  function boot() {
    var submit = document.getElementById('nav-submit');
    if (submit) {
      submit.href = 'https://github.com/' + REPO + '/issues/new?template='
        + encodeURIComponent('submit-paper.yml');
    }
    var foot = document.getElementById('foot-stat');
    if (foot) {
      var n = all().length;
      var real = all().filter(function (r) { return !isSample(r); }).length;
      foot.textContent = '当前收录 ' + n + ' 条' + (real === 0 && n > 0 ? '（均为示例）' : '') + '。';
    }
    buildSelects();
    bindControls();
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();