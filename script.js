/* =========================================================
   アクアポニックス観測記録アプリ
   すべてのデータはブラウザの localStorage 内に保存されます。
   ========================================================= */

const STORAGE_KEYS = {
  logs: 'aqua_logs',
  waterQuality: 'aqua_water_quality',
  ambient: 'aqua_ambient_settings',
  milestones: 'aqua_milestones'
};

// Ambientの各フィールドと項目の対応（送信側の構成に合わせて調整してください）
const AMBIENT_FIELD_MAP = {
  d1: { key: 'waterTemp', label: '水温 (℃)', color: '#3b7ea1' },
  d2: { key: 'roomTemp', label: '室温 (℃)', color: '#d98e2b' },
  d3: { key: 'humidity', label: '湿度 (%)', color: '#5b8c5a' },
  d4: { key: 'pressure', label: '気圧 (hPa)', color: '#7a5c9e' }
};

const TEAM_LABEL = { iot: 'IoT・センサー班', hw: 'HW・機械班', bio: '飼育・生態班', agri: '栽培・農学班' };

const WATER_TEMP_RANGE = { min: 15, max: 28 }; // 汽水域生物・小松菜を想定した目安範囲

const MILESTONE_DEFAULT = {
  phase1: {
    title: 'Phase 1: アプリ開発 & データ可視化エンジンの構築',
    items: ['DB（データ構造）設計', '手動入力フォームの作成', 'ダッシュボード・グラフ描画の作成']
  },
  phase2: {
    title: 'Phase 2: IoT連携 & 自動グラフ描画テスト',
    items: ['ESP32とAmbientの連携確認', '15分間隔での自動送信テスト', '生体・小松菜の本セット']
  },
  phase3: {
    title: 'Phase 3: 実証実験 & データ蓄積・相関分析',
    items: ['日々の記録の継続', '水質（pH・窒素循環）の定期記録', '水温/硝酸塩 と 植物成長の相関分析']
  },
  phase4: {
    title: 'Phase 4: 成果出力 & 発表準備',
    items: ['蓄積データ・グラフのCSV/画像出力', '最終発表資料の作成', '発表リハーサル']
  }
};

/* ---------- ユーティリティ ---------- */
function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.error('読み込みエラー', key, e);
    return fallback;
  }
}
function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    alert('保存に失敗しました。写真サイズが大きい可能性があります。');
    console.error('保存エラー', key, e);
  }
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    if (!file) { resolve(null); return; }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
function todayStr() { return new Date().toISOString().slice(0, 10); }

/* ---------- タブ切り替え ---------- */
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'dashboard') renderDashboard();
    if (btn.dataset.tab === 'logs') renderLogList();
    if (btn.dataset.tab === 'milestones') renderMilestones();
  });
});

/* ---------- 記録フォームの共通処理 ---------- */
document.querySelectorAll('.log-form[data-team]').forEach(form => {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const team = form.dataset.team;
    const fd = new FormData(form);
    const photoFile = fd.get('photo');
    const photoData = photoFile && photoFile.size ? await fileToBase64(photoFile) : null;

    const entry = { id: uid(), team, createdAt: new Date().toISOString(), fields: {} };
    for (const [name, value] of fd.entries()) {
      if (name === 'photo') continue;
      entry.fields[name] = value;
    }
    entry.photo = photoData;

    const logs = loadJSON(STORAGE_KEYS.logs, []);
    logs.push(entry);
    saveJSON(STORAGE_KEYS.logs, logs);

    form.reset();
    alert(TEAM_LABEL[team] + 'の記録を保存しました。');
    renderDashboard();
  });
});

/* ---------- 水質フォーム ---------- */
document.getElementById('waterQualityForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const entry = { id: uid(), date: fd.get('date'), ph: fd.get('ph'), ammonia: fd.get('ammonia'), nitrite: fd.get('nitrite'), nitrate: fd.get('nitrate') };
  const list = loadJSON(STORAGE_KEYS.waterQuality, []);
  list.push(entry);
  saveJSON(STORAGE_KEYS.waterQuality, list);
  e.target.reset();
  alert('水質データを保存しました。');
  renderDashboard();
});

/* ---------- 記録一覧 ---------- */
function renderLogList() {
  const filter = document.getElementById('filterTeam').value;
  const logs = loadJSON(STORAGE_KEYS.logs, []).slice().reverse();
  const wrap = document.getElementById('logList');
  wrap.innerHTML = '';

  const filtered = filter === 'all' ? logs : logs.filter(l => l.team === filter);
  if (!filtered.length) {
    wrap.innerHTML = '<p class="chart-note">まだ記録がありません。各班のフォームから入力してください。</p>';
    return;
  }

  filtered.forEach(log => {
    const div = document.createElement('div');
    div.className = 'log-item';
    div.dataset.team = log.team;
    const f = log.fields;
    const fieldsHtml = Object.entries(f)
      .filter(([k]) => !['date', 'time', 'author', 'summary', 'handover'].includes(k))
      .map(([k, v]) => v ? `<span><b>${k}</b>: ${v}</span>` : '').join('');

    div.innerHTML = `
      <div class="log-item-head">
        <span><b>${TEAM_LABEL[log.team]}</b> / ${f.date || ''} ${f.time || ''}</span>
        <span>担当: ${f.author || '-'}</span>
      </div>
      <div class="log-item-fields">${fieldsHtml}</div>
      ${f.summary ? `<p>${f.summary}</p>` : ''}
      ${f.handover ? `<p class="handover">引き継ぎ: ${f.handover}</p>` : ''}
      ${log.photo ? `<img src="${log.photo}" alt="記録写真">` : ''}
    `;
    wrap.appendChild(div);
  });
}
document.getElementById('filterTeam').addEventListener('change', renderLogList);

/* ---------- ダッシュボード：統計とアラート ---------- */
function renderDashboard() {
  const logs = loadJSON(STORAGE_KEYS.logs, []);
  const iotLogs = logs.filter(l => l.team === 'iot' && l.fields.waterTemp).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const latest = iotLogs[iotLogs.length - 1];

  document.getElementById('statTemp').textContent = latest?.fields.waterTemp ?? '--';
  document.getElementById('statRoom').textContent = latest?.fields.roomTemp ?? '--';
  document.getElementById('statHumid').textContent = latest?.fields.humidity ?? '--';
  document.getElementById('statPress').textContent = latest?.fields.pressure ?? '--';

  const alertBox = document.getElementById('alertBox');
  const t = latest ? parseFloat(latest.fields.waterTemp) : null;
  if (t !== null && !isNaN(t) && (t < WATER_TEMP_RANGE.min || t > WATER_TEMP_RANGE.max)) {
    alertBox.textContent = `⚠ 水温が目安範囲（${WATER_TEMP_RANGE.min}〜${WATER_TEMP_RANGE.max}℃）から外れています（現在 ${t}℃）。生体・小松菜の状態を確認してください。`;
    alertBox.classList.remove('hidden');
  } else {
    alertBox.classList.add('hidden');
  }

  const lastLog = logs.slice().sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).pop();
  document.getElementById('lastSync').textContent = lastLog
    ? '最終記録: ' + new Date(lastLog.createdAt).toLocaleString('ja-JP')
    : '最終記録: --';

  renderWaterQualityChart();
  renderCorrelationChart(logs);
}

/* ---------- Chart.js 共通オプション ---------- */
const CHART_FONT = { family: 'Inter' };
let chartAmbient, chartWQ, chartCorr;

function baseLineOptions() {
  return {
    responsive: true,
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: { labels: { font: CHART_FONT } } },
    scales: {
      x: { ticks: { font: CHART_FONT } },
      y: { ticks: { font: CHART_FONT } }
    }
  };
}

/* ---------- Ambient連携 ---------- */
function getAmbientSettings() { return loadJSON(STORAGE_KEYS.ambient, { channelId: '', readKey: '' }); }

document.getElementById('btnSaveAmbient').addEventListener('click', () => {
  const channelId = document.getElementById('ambientChannelId').value.trim();
  const readKey = document.getElementById('ambientReadKey').value.trim();
  saveJSON(STORAGE_KEYS.ambient, { channelId, readKey });
  alert('Ambientの設定を保存しました。');
});

(function initAmbientFields() {
  const s = getAmbientSettings();
  document.getElementById('ambientChannelId').value = s.channelId || '';
  document.getElementById('ambientReadKey').value = s.readKey || '';
})();

async function fetchAmbientData() {
  const s = getAmbientSettings();
  const note = document.getElementById('ambientNote');
  if (!s.channelId) {
    note.textContent = 'チャネルIDが未設定です。「Ambient連携・出力」タブで設定してください。';
    return;
  }
  const params = new URLSearchParams({ count: '100' });
  if (s.readKey) params.set('readKey', s.readKey);
  const url = `https://ambidata.io/api/v2/channels/${s.channelId}/data?${params.toString()}`;

  note.textContent = 'Ambientからデータを取得中...';
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (!Array.isArray(data) || !data.length) {
      note.textContent = 'Ambientにデータがまだありません（ESP32からの送信を確認してください）。';
      return;
    }
    drawAmbientChart(data);
    note.textContent = `最終取得: ${new Date().toLocaleString('ja-JP')}（${data.length}件）`;
  } catch (err) {
    console.error(err);
    note.textContent = 'Ambientからの取得に失敗しました。チャネルID・リードキー、通信環境を確認してください。';
  }
}
document.getElementById('btnFetchAmbient').addEventListener('click', fetchAmbientData);

function drawAmbientChart(rows) {
  const labels = rows.map(r => new Date(r.created).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }));
  const datasets = Object.entries(AMBIENT_FIELD_MAP).map(([field, meta]) => ({
    label: meta.label,
    data: rows.map(r => r[field] ?? null),
    borderColor: meta.color,
    backgroundColor: meta.color,
    tension: 0.25,
    spanGaps: true
  }));

  const ctx = document.getElementById('chartAmbient');
  if (chartAmbient) chartAmbient.destroy();
  chartAmbient = new Chart(ctx, { type: 'line', data: { labels, datasets }, options: baseLineOptions() });
}

/* ---------- 水質推移グラフ ---------- */
function renderWaterQualityChart() {
  const rows = loadJSON(STORAGE_KEYS.waterQuality, []).slice().sort((a, b) => new Date(a.date) - new Date(b.date));
  const ctx = document.getElementById('chartWaterQuality');
  if (chartWQ) chartWQ.destroy();
  if (!rows.length) return;

  chartWQ = new Chart(ctx, {
    type: 'line',
    data: {
      labels: rows.map(r => r.date),
      datasets: [
        { label: 'pH', data: rows.map(r => r.ph ? parseFloat(r.ph) : null), borderColor: '#3b7ea1', yAxisID: 'y', spanGaps: true },
        { label: 'アンモニア (mg/L)', data: rows.map(r => r.ammonia ? parseFloat(r.ammonia) : null), borderColor: '#d98e2b', yAxisID: 'y1', spanGaps: true },
        { label: '亜硝酸 (mg/L)', data: rows.map(r => r.nitrite ? parseFloat(r.nitrite) : null), borderColor: '#b3452f', yAxisID: 'y1', spanGaps: true },
        { label: '硝酸塩 (mg/L)', data: rows.map(r => r.nitrate ? parseFloat(r.nitrate) : null), borderColor: '#5b8c5a', yAxisID: 'y1', spanGaps: true }
      ]
    },
    options: {
      ...baseLineOptions(),
      scales: {
        x: { ticks: { font: CHART_FONT } },
        y: { position: 'left', title: { display: true, text: 'pH', font: CHART_FONT } },
        y1: { position: 'right', title: { display: true, text: 'mg/L', font: CHART_FONT }, grid: { drawOnChartArea: false } }
      }
    }
  });
}

/* ---------- 相関分析グラフ：水温 vs 小松菜草丈 ---------- */
function renderCorrelationChart(logs) {
  const iot = logs.filter(l => l.team === 'iot' && l.fields.waterTemp && l.fields.date)
    .map(l => ({ date: l.fields.date, val: parseFloat(l.fields.waterTemp) }));
  const agri = logs.filter(l => l.team === 'agri' && l.fields.height && l.fields.date)
    .map(l => ({ date: l.fields.date, val: parseFloat(l.fields.height) }));

  const dateSet = Array.from(new Set([...iot, ...agri].map(r => r.date))).sort();
  const ctx = document.getElementById('chartCorrelation');
  if (chartCorr) chartCorr.destroy();
  if (!dateSet.length) return;

  const avgByDate = (rows, date) => {
    const vals = rows.filter(r => r.date === date).map(r => r.val);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };

  chartCorr = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dateSet,
      datasets: [
        { label: '水温 平均 (℃)', data: dateSet.map(d => avgByDate(iot, d)), borderColor: '#3b7ea1', yAxisID: 'y', spanGaps: true },
        { label: '小松菜 草丈 (cm)', data: dateSet.map(d => avgByDate(agri, d)), borderColor: '#5b8c5a', yAxisID: 'y1', spanGaps: true }
      ]
    },
    options: {
      ...baseLineOptions(),
      scales: {
        x: { ticks: { font: CHART_FONT } },
        y: { position: 'left', title: { display: true, text: '水温 (℃)', font: CHART_FONT } },
        y1: { position: 'right', title: { display: true, text: '草丈 (cm)', font: CHART_FONT }, grid: { drawOnChartArea: false } }
      }
    }
  });
}

/* ---------- マイルストーン ---------- */
function renderMilestones() {
  const state = loadJSON(STORAGE_KEYS.milestones, {});
  const wrap = document.getElementById('milestoneWrap');
  wrap.innerHTML = '';

  Object.entries(MILESTONE_DEFAULT).forEach(([phaseKey, phase]) => {
    const checks = state[phaseKey] || phase.items.map(() => false);
    const doneCount = checks.filter(Boolean).length;
    const pct = Math.round((doneCount / phase.items.length) * 100);

    const card = document.createElement('div');
    card.className = 'phase-card';
    card.innerHTML = `
      <div class="phase-head">
        <h3>${phase.title}</h3>
        <span>${doneCount} / ${phase.items.length} 完了</span>
      </div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
      <div class="checklist"></div>
    `;
    const list = card.querySelector('.checklist');
    phase.items.forEach((item, i) => {
      const label = document.createElement('label');
      label.innerHTML = `<input type="checkbox" ${checks[i] ? 'checked' : ''}> <span>${item}</span>`;
      label.querySelector('input').addEventListener('change', (e) => {
        const s = loadJSON(STORAGE_KEYS.milestones, {});
        const arr = s[phaseKey] || phase.items.map(() => false);
        arr[i] = e.target.checked;
        s[phaseKey] = arr;
        saveJSON(STORAGE_KEYS.milestones, s);
        renderMilestones();
      });
      list.appendChild(label);
    });
    wrap.appendChild(card);
  });
}

/* ---------- CSV出力 ---------- */
function downloadCSV(filename, rows) {
  if (!rows.length) { alert('出力するデータがありません。'); return; }
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(',')]
    .concat(rows.map(r => headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(',')))
    .join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}

document.getElementById('btnExportLogs').addEventListener('click', () => {
  const logs = loadJSON(STORAGE_KEYS.logs, []);
  const rows = logs.map(l => ({
    班: TEAM_LABEL[l.team], 日付: l.fields.date, 時間: l.fields.time, 担当者: l.fields.author,
    作業概要: l.fields.summary, 引き継ぎ事項: l.fields.handover,
    ...Object.fromEntries(Object.entries(l.fields).filter(([k]) => !['date', 'time', 'author', 'summary', 'handover'].includes(k)))
  }));
  downloadCSV('aquaponics_logs.csv', rows);
});

document.getElementById('btnExportWQ').addEventListener('click', () => {
  const rows = loadJSON(STORAGE_KEYS.waterQuality, []).map(r => ({ 日付: r.date, pH: r.ph, アンモニア: r.ammonia, 亜硝酸: r.nitrite, 硝酸塩: r.nitrate }));
  downloadCSV('aquaponics_water_quality.csv', rows);
});

/* ---------- 全データ削除 ---------- */
document.getElementById('btnClearAll').addEventListener('click', () => {
  if (!confirm('この端末に保存された全データを削除します。よろしいですか？')) return;
  Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
  alert('削除しました。');
  renderDashboard();
  renderLogList();
  renderMilestones();
});

/* ---------- 初期化 ---------- */
document.querySelectorAll('input[name="date"]').forEach(el => { if (!el.value) el.value = todayStr(); });
renderDashboard();
renderLogList();
renderMilestones();
