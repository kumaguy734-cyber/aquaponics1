/* =========================================================
   アクアポニックス観測記録アプリ（蔵前工科高校 課題研究）
   ・データはGoogle Apps Script経由でGoogleスプレッドシートに保存
   ・「データ取り込み・出力」タブでクラウド連携先(URL)を設定してから使用
   ========================================================= */

const API_URL_KEY = 'aqua_api_url';
const TEAM_LABEL = { iot: '環境データ', hw: 'HW・機械班', bio: '飼育・生態班', agri: '栽培・農学班' };

const FIELD_LABEL = {
  waterTemp: '水温(℃)', roomTemp: '室温(℃)', humidity: '湿度(%)', pressure: '気圧(hPa)',
  esp32Status: 'ESP32', loggerStatus: 'RTC・SDカード', maintLog: 'メンテ・障害',
  pumpStatus: 'ポンプ', siphonStatus: 'ベルサイフォン', ledLift: 'LED昇降装置', ledHeight: 'LED高さ(mm)',
  frameCheck: '清掃・架台', structureNote: '構造変更',
  species: '生体', count: '個体数', death: '死亡数', feeding: '餌食い', feedAmount: '給餌量',
  behavior: '様子', collectLog: '採集・投入', turbidity: '濁り', odor: '臭い',
  plantNo: '株', leafColor: '葉色', height: '草丈(cm)', leaves: '葉数', harvestG: '定植・収穫(g)',
  pest: '病害虫', rootNote: '根・培地'
};
const COMMON_FIELDS = ['date', 'time', 'author', 'summary', 'handover'];

const WATER_ROWS = [
  ['gh', '総硬度（GH）'], ['no2', '亜硝酸塩（NO2）'], ['no3', '硝酸塩（NO3）'], ['cl2', '総塩素（Cl2）'],
  ['ph', 'pH'], ['kh', '炭酸塩硬度（KH）'], ['nh3', 'アンモニア（NH3）'], ['level', '水位（cm）'], ['salinity', '塩分（追加項目）']
];

const WATER_TEMP_RANGE = { min: 15, max: 28 }; // 目安。生体・小松菜に合わせて調整してください

/* ---------- スケジュール ---------- */
const WORK_DAYS = ['2026-10-05', '2026-10-26', '2026-11-02', '2026-11-09', '2026-11-30', '2026-12-07', '2026-12-14', '2026-12-21'];
const WRAP_DAYS = ['2027-01-18', '2027-01-25', '2027-02-01', '2027-02-08'];
const PRESENT_DAY = '2027-02-15';

const PHASES = [
  { id: 'p1', title: 'Phase 1: 記録体制の構築', period: '〜10/5(月)', items: [
    { id: 'p1a', text: '記録アプリをGitHub Pagesで公開し、各班が入力できることを確認', when: '10/5' },
    { id: 'p1b', text: '水質管理表の項目（GH/NO2/NO3/Cl2/pH/KH/NH3/水位）を入力・確認', when: '10/5' },
    { id: 'p1c', text: 'ESP32のRTC・SDカードログの動作確認（日時が正しく記録されるか）', when: '10/5' },
    { id: 'p1d', text: 'クラウド連携（Googleスプレッドシート）の接続確認', when: '10/5', added: true },
    { id: 'p1e', text: '記録担当と、月曜以外の見回り・給餌当番を決める', when: '10/5', added: true }
  ]},
  { id: 'p2', title: 'Phase 2: 装置の完成 & 生物・小松菜のセット', period: '10/5(月)〜11/2(月)', items: [
    { id: 'p2a', text: '農業用LEDライトの昇降装置を取り付け（固定150mm＋可動350mm）', when: '10/5〜10/26' },
    { id: 'p2b', text: '水漏れ・ポンプ・ベルサイフォンの通水テスト', when: '10/5', added: true },
    { id: 'p2c', text: 'ESP32のセンサー設置と水温の校正（基準温度計と比較）', when: '10/26', added: true },
    { id: 'p2d', text: '生物の投入と水合わせ（採集日・種類・個体数を記録）', when: '10/26' },
    { id: 'p2e', text: '小松菜の定植（2〜4株）と株番号の付け方を決める', when: '10/26' },
    { id: 'p2f', text: '生物の状況記録（個体数・死亡数・餌食い・濁り/臭い）の運用開始', when: '11/2' },
    { id: 'p2g', text: '小松菜の生育記録（草丈・葉数・葉色・根）と定点撮影の運用開始', when: '11/2' },
    { id: 'p2h', text: '冬に向けた水温対策（保温・ヒーター）と水温アラート範囲の決定', when: '11/2', added: true }
  ]},
  { id: 'p3', title: 'Phase 3: 実証実験 & データ蓄積・相関分析', period: '11/9(月)〜12/21(月)', items: [
    { id: 'p3a', text: '毎回の作業日に水質検査と各班の記録を入力する', when: '11/9〜12/21' },
    { id: 'p3b', text: '窒素循環（NH3→NO2→NO3）の推移をグラフで確認', when: '11/30' },
    { id: 'p3c', text: '水温/硝酸塩 と 小松菜の草丈の相関を初回確認', when: '12/7' },
    { id: 'p3d', text: '中間まとめ：不足データ・改善点の洗い出し', when: '12/14', added: true },
    { id: 'p3e', text: 'SDカードのログを回収・取り込み、スプレッドシートに反映', when: '12/21', added: true },
    { id: 'p3f', text: '冬休み中の給餌・見回り・停電対策の確認', when: '12/21', added: true }
  ]},
  { id: 'p4', title: 'Phase 4: 成果出力 & 発表準備', period: '1/18(月)〜2/15(月)週', items: [
    { id: 'p4a', text: '蓄積データ・グラフをCSV/画像で出力', when: '1/18' },
    { id: 'p4b', text: 'データ整理と考察（相関・窒素循環・生存率・成長率）', when: '1/25' },
    { id: 'p4c', text: '発表資料（スライド/ポスター）の作成', when: '2/1' },
    { id: 'p4d', text: '発表リハーサルと最終確認', when: '2/8' },
    { id: 'p4e', text: '課題研究発表（2/15の週・予定）', when: '2/15週' }
  ]}
];

/* ---------- 状態（クラウドから取得したデータのメモリ上キャッシュ） ---------- */
let STATE = { logs: [], water: [], env: [], tasks: {} };
let apiUrl = localStorage.getItem(API_URL_KEY) || '';

/* ---------- ユーティリティ ---------- */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2, '0');
function localDateStr(d = new Date()) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function localTimeStr(d = new Date()) { return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function fmtDate(iso) { const d = new Date(iso + 'T00:00:00'); return `${d.getMonth() + 1}/${d.getDate()}(${'日月火水木金土'[d.getDay()]})`; }
function daysUntil(iso) { return Math.round((new Date(iso + 'T00:00:00') - new Date(localDateStr() + 'T00:00:00')) / 86400000); }

function parseNum(v) {
  if (v === null || v === undefined || v === '') return null;
  const s = String(v).normalize('NFKC').replace(/[ー−–—~〜～]/g, '-').trim();
  const range = s.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/);
  if (range) return (parseFloat(range[1]) + parseFloat(range[2])) / 2;
  const one = s.match(/\d+(?:\.\d+)?/);
  return one ? parseFloat(one[0]) : null;
}
const numOrNull = v => (v === '' || v === undefined || v === null || isNaN(parseFloat(v))) ? null : parseFloat(v);

function resizeImage(file, max = 800) {
  return new Promise(resolve => {
    if (!file || !file.size) return resolve(null);
    const reader = new FileReader();
    reader.onerror = () => resolve(null);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => resolve(null);
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.7));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function downloadCSV(filename, rows) {
  if (!rows.length) { alert('出力するデータがありません。'); return; }
  const csv = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }));
  a.download = filename; a.click();
}
function downloadText(filename, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = filename; a.click();
}

/* ---------- クラウドAPI呼び出し ---------- */
function setBanner(kind, text) {
  const b = $('syncBanner');
  b.className = 'sync-banner sync-' + kind;
  b.textContent = text;
  b.classList.toggle('hidden', kind === 'ok' && !text);
}
function requireApi() {
  if (!apiUrl) { alert('先に「データ取り込み・出力」タブでクラウド連携先(URL)を設定してください。'); return false; }
  return true;
}
async function apiPost(action, payload) {
  const res = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, payload }) });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || '不明なエラー');
  return data;
}
async function apiGetAll() {
  const res = await fetch(apiUrl + (apiUrl.includes('?') ? '&' : '?') + 't=' + Date.now());
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || '不明なエラー');
  return data;
}

async function syncAll(opts = {}) {
  if (!apiUrl) { setBanner('warn', 'クラウド連携先が未設定です。「データ取り込み・出力」タブで設定してください。'); return; }
  if (!opts.silent) setBanner('busy', '同期中...');
  try {
    const data = await apiGetAll();
    STATE = { logs: data.logs || [], water: data.water || [], env: data.env || [], tasks: data.tasks || {} };
    setBanner('ok', '');
    $('apiStatus').textContent = '接続OK（最終同期: ' + new Date().toLocaleTimeString('ja-JP') + '）';
    refresh();
  } catch (err) {
    console.error(err);
    setBanner('error', '同期に失敗しました：' + err.message + '（URL・公開設定・通信環境を確認してください）');
    $('apiStatus').textContent = '接続エラー';
  }
}

/* ---------- タブ ---------- */
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    $(btn.dataset.tab).classList.add('active');
    refresh();
  });
});

function refresh() {
  renderDashboard(); renderWaterTable(); renderLogList(); renderMilestones(); renderSidebar();
}

/* ---------- クラウド連携先の設定 ---------- */
$('apiUrl').value = apiUrl;
$('btnSaveApi').addEventListener('click', () => {
  const v = $('apiUrl').value.trim();
  if (!v) { alert('URLを入力してください。'); return; }
  apiUrl = v;
  localStorage.setItem(API_URL_KEY, apiUrl);
  syncAll();
});

/* ---------- 班ごとの記録フォーム ---------- */
document.querySelectorAll('.log-form[data-team]').forEach(form => {
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!requireApi()) return;
    const btn = form.querySelector('button[type="submit"]');
    const team = form.dataset.team;
    const fd = new FormData(form);
    const fields = {};
    for (const [k, v] of fd.entries()) { if (k !== 'photo' && v !== '') fields[k] = v; }
    const photoDataUrl = await resizeImage(fd.get('photo'));
    const id = uid();

    btn.disabled = true; btn.textContent = '保存中...';
    try {
      await apiPost('addLog', { id, team, createdAt: new Date().toISOString(), fields, photoDataUrl });
      if (team === 'iot') {
        const w = numOrNull(fields.waterTemp), r = numOrNull(fields.roomTemp), h = numOrNull(fields.humidity), p = numOrNull(fields.pressure);
        if ([w, r, h, p].some(v => v !== null)) {
          await apiPost('addEnvBulk', { rows: [{ k: `${fields.date} ${fields.time}|m|${id}`, d: fields.date, t: fields.time, w, r, h, p, s: 'manual' }] });
        }
      }
      form.reset(); setDefaults();
      await syncAll({ silent: true });
      alert(TEAM_LABEL[team] + 'の記録を保存しました。');
    } catch (err) {
      console.error(err); alert('保存に失敗しました：' + err.message);
    } finally {
      btn.disabled = false; btn.textContent = '保存';
    }
  });
});

/* ---------- 水質検査 ---------- */
$('waterForm').addEventListener('submit', async e => {
  e.preventDefault();
  if (!requireApi()) return;
  const btn = e.target.querySelector('button[type="submit"]');
  const fd = new FormData(e.target);
  const rec = {}; for (const [k, v] of fd.entries()) rec[k] = String(v).trim();
  const existing = STATE.water.find(x => x.date === rec.date);
  rec.id = existing ? existing.id : uid();

  btn.disabled = true; btn.textContent = '保存中...';
  try {
    await apiPost('upsertWater', rec);
    e.target.reset(); setDefaults();
    await syncAll({ silent: true });
    alert(existing ? '同じ日付の水質データを更新しました。' : '水質データを保存しました。');
  } catch (err) {
    console.error(err); alert('保存に失敗しました：' + err.message);
  } finally {
    btn.disabled = false; btn.textContent = '水質データを保存';
  }
});

function sortedWater() { return STATE.water.slice().sort((a, b) => a.date.localeCompare(b.date)); }

function renderWaterTable() {
  const rows = sortedWater();
  const table = $('wqTable');
  if (!rows.length) { table.innerHTML = '<tr><td>まだ水質データがありません。</td></tr>'; return; }
  const usedRows = WATER_ROWS.filter(([key]) => key !== 'salinity' || rows.some(r => r.salinity));
  let html = '<tr><th>項目 / 日付</th>' + rows.map(r => `<th>${fmtDate(r.date)}<button class="icon-del" data-del-water="${r.id}" title="この日を削除">×</button></th>`).join('') + '</tr>';
  usedRows.forEach(([key, label]) => {
    html += `<tr><td>${label}</td>` + rows.map(r => {
      const v = r[key];
      if (!v) return '<td class="empty-cell">-</td>';
      const flag = (key === 'no2' || key === 'nh3') && (parseNum(v) || 0) > 0;
      return `<td class="${flag ? 'flag' : ''}">${esc(v)}</td>`;
    }).join('') + '</tr>';
  });
  table.innerHTML = html;
}
$('wqTable').addEventListener('click', async e => {
  const id = e.target.dataset.delWater;
  if (!id || !requireApi() || !confirm('この日の水質データを削除しますか？')) return;
  try { await apiPost('deleteWater', { id }); await syncAll({ silent: true }); }
  catch (err) { alert('削除に失敗しました：' + err.message); }
});

/* ---------- 記録一覧 ---------- */
function renderLogList() {
  const filter = $('filterTeam').value;
  const logs = STATE.logs.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const wrap = $('logList');
  const list = filter === 'all' ? logs : logs.filter(l => l.team === filter);
  if (!list.length) { wrap.innerHTML = '<p class="chart-note">まだ記録がありません。</p>'; return; }
  wrap.innerHTML = list.map(l => {
    const f = l.fields || {};
    const fields = Object.entries(f).filter(([k]) => !COMMON_FIELDS.includes(k))
      .map(([k, v]) => `<span><b>${esc(FIELD_LABEL[k] || k)}</b>: ${esc(v)}</span>`).join('');
    return `<div class="log-item" data-team="${l.team}">
      <div class="log-item-head">
        <span><b>${TEAM_LABEL[l.team]}</b> ／ ${esc(f.date)} ${esc(f.time)}</span>
        <span>担当: ${esc(f.author || '-')}<button class="icon-del del" data-del-log="${l.id}" title="削除">×</button></span>
      </div>
      <div class="log-item-fields">${fields}</div>
      ${f.summary ? `<p>${esc(f.summary)}</p>` : ''}
      ${f.handover ? `<p class="handover">引き継ぎ: ${esc(f.handover)}</p>` : ''}
      ${l.photo ? `<img src="${l.photo}" alt="記録写真">` : ''}
    </div>`;
  }).join('');
}
$('filterTeam').addEventListener('change', renderLogList);
$('logList').addEventListener('click', async e => {
  const id = e.target.dataset.delLog;
  if (!id || !requireApi() || !confirm('この記録を削除しますか？（関連する環境データも削除されます）')) return;
  try {
    await apiPost('deleteLog', { id });
    await apiPost('deleteEnvByLogId', { logId: id });
    await syncAll({ silent: true });
  } catch (err) { alert('削除に失敗しました：' + err.message); }
});

/* ---------- サイドバー ---------- */
function renderSidebar() {
  const next = WORK_DAYS.find(d => daysUntil(d) >= 0);
  if (next) { const n = daysUntil(next); $('nextSession').textContent = `次回作業日: ${fmtDate(next)}${n === 0 ? '（今日）' : `（あと${n}日）`}`; }
  else { const w = WRAP_DAYS.find(d => daysUntil(d) >= 0); $('nextSession').textContent = w ? `次回: ${fmtDate(w)}（まとめ）` : '作業日は終了しました'; }
  const last = STATE.logs.map(l => l.createdAt).sort().pop();
  $('lastSync').textContent = last ? '最終記録: ' + new Date(last).toLocaleString('ja-JP') : '最終記録: --';
}

/* ---------- ダッシュボード ---------- */
let chartEnv, chartWQ, chartCorr;
const FONT = { family: 'Inter' };
function sortedEnv() { return STATE.env.slice().sort((a, b) => (a.d + a.t).localeCompare(b.d + b.t)); }

function renderDashboard() {
  const env = sortedEnv();
  const lastOf = key => { for (let i = env.length - 1; i >= 0; i--) if (env[i][key] !== null && env[i][key] !== undefined) return env[i]; return null; };
  const set = (id, key) => { const r = lastOf(key); $(id).textContent = r ? r[key] : '--'; };
  set('statTemp', 'w'); set('statRoom', 'r'); set('statHumid', 'h'); set('statPress', 'p');
  const latest = env[env.length - 1];
  $('statNote').textContent = latest ? `最新の記録: ${latest.d} ${latest.t}（${latest.s === 'sd' ? 'SDカードログ' : '手入力'}）` : 'まだ環境データがありません。SDカードのログを取り込むか、手入力してください。';

  const msgs = [];
  const w = lastOf('w');
  if (w && (w.w < WATER_TEMP_RANGE.min || w.w > WATER_TEMP_RANGE.max)) msgs.push(`水温が目安範囲（${WATER_TEMP_RANGE.min}〜${WATER_TEMP_RANGE.max}℃）から外れています（${w.w}℃）。`);
  const wq = sortedWater().pop();
  if (wq) {
    const hits = [];
    if ((parseNum(wq.nh3) || 0) > 0) hits.push('アンモニア');
    if ((parseNum(wq.no2) || 0) > 0) hits.push('亜硝酸塩');
    if (hits.length) msgs.push(`${fmtDate(wq.date)}の水質検査で ${hits.join('・')} が検出されています。生体の様子を確認してください。`);
  }
  const lastIot = STATE.logs.filter(l => l.team === 'iot').sort((a, b) => a.createdAt.localeCompare(b.createdAt)).pop();
  if (lastIot && lastIot.fields.loggerStatus === '記録が止まっている') msgs.push('RTC・SDカードの記録が止まっていると報告されています。');
  const box = $('alertBox');
  box.innerHTML = msgs.map(m => `⚠ ${esc(m)}`).join('<br>');
  box.classList.toggle('hidden', !msgs.length);

  drawEnvChart(env);
  drawWaterChart();
  drawCorrChart(env);
}

function drawEnvChart(env) {
  if (chartEnv) chartEnv.destroy();
  const n = env.length, nsd = env.filter(e => e.s === 'sd').length;
  $('envNote').textContent = n ? `${n}件（SDカード ${nsd}件／手入力 ${n - nsd}件）のうち最新500件を表示` : 'データがありません。';
  if (!n) return;
  const rows = env.slice(-500);
  const ds = (label, key, color, axis) => ({ label, data: rows.map(r => r[key]), borderColor: color, backgroundColor: color, yAxisID: axis, spanGaps: true, tension: 0.2, pointRadius: rows.length > 100 ? 0 : 3 });
  chartEnv = new Chart($('chartEnv'), {
    type: 'line',
    data: { labels: rows.map(r => r.d.slice(5) + ' ' + r.t), datasets: [ds('水温(℃)', 'w', '#3b7ea1', 'y'), ds('室温(℃)', 'r', '#d98e2b', 'y'), ds('湿度(%)', 'h', '#5b8c5a', 'y1'), ds('気圧(hPa)', 'p', '#7a5c9e', 'y2')] },
    options: { responsive: true, interaction: { mode: 'index', intersect: false }, plugins: { legend: { labels: { font: FONT } } },
      scales: { x: { ticks: { font: FONT, maxTicksLimit: 10 } }, y: { position: 'left', title: { display: true, text: '℃', font: FONT } },
        y1: { position: 'right', title: { display: true, text: '%', font: FONT }, grid: { drawOnChartArea: false } },
        y2: { position: 'right', title: { display: true, text: 'hPa', font: FONT }, grid: { drawOnChartArea: false } } } }
  });
}

function drawWaterChart() {
  if (chartWQ) chartWQ.destroy();
  const rows = sortedWater();
  if (!rows.length) return;
  const ds = (label, key, color, axis) => ({ label, data: rows.map(r => parseNum(r[key])), borderColor: color, backgroundColor: color, yAxisID: axis, spanGaps: true, tension: 0.2 });
  chartWQ = new Chart($('chartWaterQuality'), {
    type: 'line',
    data: { labels: rows.map(r => r.date), datasets: [ds('pH', 'ph', '#3b7ea1', 'y'), ds('アンモニア NH3', 'nh3', '#d98e2b', 'y1'), ds('亜硝酸塩 NO2', 'no2', '#b3452f', 'y1'), ds('硝酸塩 NO3', 'no3', '#5b8c5a', 'y1')] },
    options: { responsive: true, interaction: { mode: 'index', intersect: false }, plugins: { legend: { labels: { font: FONT } } },
      scales: { x: { ticks: { font: FONT } }, y: { position: 'left', title: { display: true, text: 'pH', font: FONT } },
        y1: { position: 'right', title: { display: true, text: 'NH3・NO2・NO3', font: FONT }, grid: { drawOnChartArea: false } } } }
  });
}

function drawCorrChart(env) {
  if (chartCorr) chartCorr.destroy();
  const target = $('corrTarget').value;
  const logs = STATE.logs;
  const avg = pairs => { const m = {}; pairs.forEach(([d, v]) => { (m[d] = m[d] || []).push(v); }); return Object.fromEntries(Object.entries(m).map(([d, a]) => [d, a.reduce((x, y) => x + y, 0) / a.length])); };
  const height = avg(logs.filter(l => l.team === 'agri' && numOrNull(l.fields.height) !== null).map(l => [l.fields.date, parseFloat(l.fields.height)]));
  const other = target === 'temp'
    ? avg(env.filter(e => e.w !== null && e.w !== undefined).map(e => [e.d, e.w]))
    : avg(sortedWater().filter(r => parseNum(r.no3) !== null).map(r => [r.date, parseNum(r.no3)]));
  const dates = Array.from(new Set([...Object.keys(height), ...Object.keys(other)])).sort();
  if (!dates.length) return;
  const label = target === 'temp' ? '水温 日平均(℃)' : '硝酸塩 NO3';
  chartCorr = new Chart($('chartCorrelation'), {
    type: 'line',
    data: { labels: dates, datasets: [
      { label, data: dates.map(d => other[d] ?? null), borderColor: '#3b7ea1', backgroundColor: '#3b7ea1', yAxisID: 'y', spanGaps: true },
      { label: '小松菜 草丈 平均(cm)', data: dates.map(d => height[d] ?? null), borderColor: '#5b8c5a', backgroundColor: '#5b8c5a', yAxisID: 'y1', spanGaps: true }
    ] },
    options: { responsive: true, interaction: { mode: 'index', intersect: false }, plugins: { legend: { labels: { font: FONT } } },
      scales: { x: { ticks: { font: FONT } }, y: { position: 'left', title: { display: true, text: label, font: FONT } },
        y1: { position: 'right', title: { display: true, text: '草丈 (cm)', font: FONT }, grid: { drawOnChartArea: false } } } }
  });
}
$('corrTarget').addEventListener('change', () => drawCorrChart(sortedEnv()));

/* ---------- スケジュール・マイルストーン ---------- */
function renderMilestones() {
  const state = STATE.tasks;
  const all = PHASES.flatMap(p => p.items);
  const doneAll = all.filter(t => state[t.id] === true).length;
  const remaining = WORK_DAYS.filter(d => daysUntil(d) >= 0).length;

  $('summaryRow').innerHTML = `
    <div class="summary-card"><div class="num">${remaining} / ${WORK_DAYS.length}</div><div class="lab">残りの作業日（10/5〜12/21）</div></div>
    <div class="summary-card"><div class="num">${WRAP_DAYS.length}</div><div class="lab">まとめ・資料作成日（1/18〜2/8）</div></div>
    <div class="summary-card"><div class="num">${Math.round(doneAll / all.length * 100)}%</div><div class="lab">全体の達成率（${doneAll} / ${all.length}）</div></div>`;

  const nextDate = [...WORK_DAYS, ...WRAP_DAYS, PRESENT_DAY].find(d => daysUntil(d) >= 0);
  const chip = (d, type, label) => `<div class="session ${type} ${daysUntil(d) < 0 ? 'past' : ''} ${d === nextDate ? 'next' : ''}"><b>${fmtDate(d)}</b><span>${label}</span></div>`;
  $('sessionStrip').innerHTML =
    WORK_DAYS.map((d, i) => chip(d, 'work', `作業 ${i + 1}回目`)).join('') +
    WRAP_DAYS.map((d, i) => chip(d, 'wrap', `まとめ ${i + 1}`)).join('') +
    chip(PRESENT_DAY, 'present', '発表週（予定）') +
    `<p class="session-legend" style="width:100%">青＝実験・装置の作業日／緑＝データまとめ・資料作成／橙＝発表。次の予定は枠で強調されます。</p>`;

  $('milestoneWrap').innerHTML = '';
  PHASES.forEach(ph => {
    const done = ph.items.filter(t => state[t.id] === true).length;
    const pct = Math.round(done / ph.items.length * 100);
    const card = document.createElement('div');
    card.className = 'phase-card';
    card.innerHTML = `
      <div class="phase-head"><h3>${ph.title}</h3><span>${done} / ${ph.items.length} 完了</span></div>
      <div class="phase-period">${ph.period}</div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
      <div class="checklist"></div>`;
    const list = card.querySelector('.checklist');
    ph.items.forEach(t => {
      const label = document.createElement('label');
      label.className = 'task' + (state[t.id] === true ? ' done' : '');
      label.innerHTML = `<input type="checkbox" ${state[t.id] === true ? 'checked' : ''}>
        <span class="txt">${esc(t.text)}</span>
        <span class="badge when">${esc(t.when)}</span>${t.added ? '<span class="badge added">追加提案</span>' : ''}`;
      label.querySelector('input').addEventListener('change', async e => {
        if (!requireApi()) { e.target.checked = !e.target.checked; return; }
        const checked = e.target.checked;
        try { await apiPost('setTask', { id: t.id, checked }); STATE.tasks[t.id] = checked; renderMilestones(); }
        catch (err) { alert('更新に失敗しました：' + err.message); e.target.checked = !checked; }
      });
      list.appendChild(label);
    });
    $('milestoneWrap').appendChild(card);
  });
}

/* ---------- SDカードログの取り込み ---------- */
function splitCSVLine(line) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
    else if ((c === ',' || c === '\t') && !q) { out.push(cur.trim()); cur = ''; }
    else cur += c;
  }
  out.push(cur.trim());
  return out;
}
function parseTs(s) {
  const m = String(s).match(/(\d{4})[-\/年](\d{1,2})[-\/月](\d{1,2})日?(?:[T\s]+(\d{1,2}):(\d{2}))?/);
  if (!m) return null;
  return { d: `${m[1]}-${pad(m[2])}-${pad(m[3])}`, t: m[4] ? `${pad(m[4])}:${m[5]}` : '00:00' };
}

$('btnImportSd').addEventListener('click', async () => {
  if (!requireApi()) return;
  const file = $('sdFile').files[0];
  const out = $('sdResult');
  if (!file) { out.textContent = 'CSVファイルを選んでください。'; return; }
  const text = (await file.text()).replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) { out.textContent = 'データ行が見つかりません。'; return; }

  const head = splitCSVLine(lines[0]);
  const find = (re, skip = -1) => head.findIndex((h, i) => i !== skip && re.test(h));
  const iTs = find(/日時|datetime|timestamp/i);
  const iDate = find(/^(日付|date)$/i), iTime = find(/^(時刻|時間|time)$/i);
  const iW = find(/水温|water/i);
  const iR = find(/室温|気温|room|air|temp/i, iW);
  const iH = find(/湿度|hum/i), iP = find(/気圧|press|hpa/i);
  if ((iTs < 0 && iDate < 0) || [iW, iR, iH, iP].every(i => i < 0)) {
    out.textContent = '見出しを認識できませんでした。1行目に「日時,水温,室温,湿度,気圧」のような見出しが必要です。';
    return;
  }

  const thin = $('sdThin').checked;
  const known = new Set(STATE.env.map(e => e.k));
  const seenHour = new Set();
  const rows = [];
  lines.slice(1).forEach(line => {
    const c = splitCSVLine(line);
    const ts = iTs >= 0 ? parseTs(c[iTs]) : parseTs(c[iDate] + ' ' + (iTime >= 0 ? c[iTime] : ''));
    if (!ts) return;
    const k = `${ts.d} ${ts.t}|sd`;
    if (known.has(k)) return;
    if (thin) { const hk = ts.d + ts.t.slice(0, 2); if (seenHour.has(hk)) return; seenHour.add(hk); }
    const g = i => (i >= 0 ? numOrNull(c[i]) : null);
    rows.push({ k, d: ts.d, t: ts.t, w: g(iW), r: g(iR), h: g(iH), p: g(iP), s: 'sd' });
    known.add(k);
  });

  if (!rows.length) { out.textContent = '新しく取り込めるデータがありませんでした（すでに取り込み済み、または形式を確認してください）。'; return; }
  out.textContent = `${rows.length}件を送信中...`;
  try {
    const res = await apiPost('addEnvBulk', { rows });
    out.textContent = `${res.added}件を取り込みました（重複スキップ ${res.skipped}件）。`;
    await syncAll({ silent: true });
  } catch (err) {
    out.textContent = '取り込みに失敗しました：' + err.message;
  }
});

/* ---------- CSV出力 ---------- */
$('btnExportLogs').addEventListener('click', () => {
  const logs = STATE.logs.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const extra = Array.from(new Set(logs.flatMap(l => Object.keys(l.fields || {}).filter(k => !COMMON_FIELDS.includes(k)))));
  const rows = [['班', '日付', '時間', '担当者', '作業概要', '引き継ぎ事項', ...extra.map(k => FIELD_LABEL[k] || k)]];
  logs.forEach(l => rows.push([TEAM_LABEL[l.team], l.fields.date, l.fields.time, l.fields.author, l.fields.summary, l.fields.handover, ...extra.map(k => l.fields[k])]));
  downloadCSV('aquaponics_logs.csv', rows);
});
$('btnExportEnv').addEventListener('click', () => {
  const rows = [['日付', '時間', '水温(℃)', '室温(℃)', '湿度(%)', '気圧(hPa)', '取得元']];
  sortedEnv().forEach(e => rows.push([e.d, e.t, e.w, e.r, e.h, e.p, e.s === 'sd' ? 'SDカード' : '手入力']));
  downloadCSV('aquaponics_env.csv', rows);
});
$('btnExportWQ').addEventListener('click', () => {
  const w = sortedWater();
  const used = WATER_ROWS.filter(([k]) => k !== 'salinity' || w.some(r => r.salinity));
  const rows = [['項目 / 日付', ...w.map(r => r.date)], ...used.map(([k, label]) => [label, ...w.map(r => r[k] || '')])];
  downloadCSV('aquaponics_water_quality.csv', w.length ? rows : []);
});

/* ---------- スナップショット保存 ---------- */
$('btnBackup').addEventListener('click', () => {
  const data = { exportedAt: new Date().toISOString(), ...STATE };
  downloadText(`aquaponics_snapshot_${localDateStr()}.json`, JSON.stringify(data), 'application/json');
});

/* ---------- 全データ削除 ---------- */
$('btnClearAll').addEventListener('click', async () => {
  if (!requireApi()) return;
  if (!confirm('Googleスプレッドシート上の全データを削除します。班員全員から見えなくなります。よろしいですか？')) return;
  try { await apiPost('clearAll', {}); await syncAll({ silent: true }); alert('削除しました。'); }
  catch (err) { alert('削除に失敗しました：' + err.message); }
});

/* ---------- 初期化 ---------- */
function setDefaults() {
  document.querySelectorAll('input[name="date"]').forEach(el => { if (!el.value) el.value = localDateStr(); });
  document.querySelectorAll('input[type="time"]').forEach(el => { if (!el.value) el.value = localTimeStr(); });
}
setDefaults();
refresh();
if (apiUrl) syncAll(); else setBanner('warn', 'クラウド連携先が未設定です。「データ取り込み・出力」タブで設定してください。');
