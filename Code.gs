/**
 * アクアポニックス観測記録アプリ - バックエンド (Google Apps Script)
 * ------------------------------------------------------------
 * 使い方：
 * 1. 新しいGoogleスプレッドシートを作成する
 * 2. メニュー「拡張機能」→「Apps Script」を開く
 * 3. 中身をすべて削除して、このファイルの内容を貼り付ける
 * 4. 上部の「保存」→ 関数選択で setup を選び「実行」（初回のみ／シート自動作成）
 *    → 権限の許可を求められるので許可する
 * 5. 右上「デプロイ」→「新しいデプロイ」→ 種類「ウェブアプリ」
 *    - 実行ユーザー: 自分
 *    - アクセスできるユーザー: 全員
 *    → デプロイし、発行された「ウェブアプリのURL」をコピーする
 * 6. そのURLを、フロントエンド（index.htmlのアプリ）の
 *    「データ取り込み・出力」タブ → クラウド連携先 に貼り付けて保存する
 *
 * シート構成（setup()で自動作成されます）：
 *   Logs  : id, team, createdAt, date, time, author, summary, handover, fieldsJson, photoUrl
 *   Water : id, date, author, gh, no2, no3, cl2, ph, kh, nh3, level, salinity, note
 *   Env   : k, date, time, waterTemp, roomTemp, humidity, pressure, source
 *   Tasks : id, checked
 */

var SHEETS = {
  logs: { name: 'Logs', header: ['id', 'team', 'createdAt', 'date', 'time', 'author', 'summary', 'handover', 'fieldsJson', 'photoUrl'] },
  water: { name: 'Water', header: ['id', 'date', 'author', 'gh', 'no2', 'no3', 'cl2', 'ph', 'kh', 'nh3', 'level', 'salinity', 'note'] },
  env: { name: 'Env', header: ['k', 'date', 'time', 'waterTemp', 'roomTemp', 'humidity', 'pressure', 'source'] },
  tasks: { name: 'Tasks', header: ['id', 'checked'] }
};
var PHOTO_FOLDER_NAME = 'aquaponics_photos';

function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SHEETS).forEach(function (key) {
    var def = SHEETS[key];
    var sh = ss.getSheetByName(def.name);
    if (!sh) sh = ss.insertSheet(def.name);
    if (sh.getLastRow() === 0) sh.appendRow(def.header);
  });
  var def = ss.getSheetByName('シート1') || ss.getSheetByName('Sheet1');
  if (def && def.getLastRow() === 0 && def.getLastColumn() <= 1) ss.deleteSheet(def);
}

function sheetOf(key) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var def = SHEETS[key];
  var sh = ss.getSheetByName(def.name);
  if (!sh) { sh = ss.insertSheet(def.name); sh.appendRow(def.header); }
  return sh;
}

function rowsToObjects(sheet) {
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  var header = values[0];
  return values.slice(1).filter(function (r) { return r.some(function (c) { return c !== '' && c !== null; }); })
    .map(function (r) {
      var o = {};
      header.forEach(function (h, i) { o[h] = r[i]; });
      return o;
    });
}

function findRowIndexById(sheet, idCol, id) {
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][idCol]) === String(id)) return i + 1; // 1-based row number
  }
  return -1;
}

/* ---------- GET: 全データを返す ---------- */
function doGet(e) {
  var logs = rowsToObjects(sheetOf('logs')).map(function (r) {
    var fields = {};
    try { fields = JSON.parse(r.fieldsJson || '{}'); } catch (err) { fields = {}; }
    return { id: r.id, team: r.team, createdAt: r.createdAt, fields: fields, photo: r.photoUrl || null };
  });
  var water = rowsToObjects(sheetOf('water'));
  var env = rowsToObjects(sheetOf('env')).map(function (r) {
    return { k: r.k, d: r.date, t: r.time, w: numOrNull(r.waterTemp), r: numOrNull(r.roomTemp), h: numOrNull(r.humidity), p: numOrNull(r.pressure), s: r.source };
  });
  var tasksRows = rowsToObjects(sheetOf('tasks'));
  var tasks = {};
  tasksRows.forEach(function (r) { tasks[r.id] = (r.checked === true || r.checked === 'TRUE' || r.checked === 'true'); });

  return jsonOut({ ok: true, logs: logs, water: water, env: env, tasks: tasks });
}

function numOrNull(v) { return (v === '' || v === null || v === undefined) ? null : Number(v); }

/* ---------- POST: 書き込み系 ---------- */
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(25000);
    var body = JSON.parse(e.postData.contents);
    var action = body.action;
    var p = body.payload || {};
    var result;
    switch (action) {
      case 'addLog': result = addLog(p); break;
      case 'deleteLog': result = deleteLog(p); break;
      case 'upsertWater': result = upsertWater(p); break;
      case 'deleteWater': result = deleteWater(p); break;
      case 'addEnvBulk': result = addEnvBulk(p); break;
      case 'deleteEnvByLogId': result = deleteEnvByLogId(p); break;
      case 'setTask': result = setTask(p); break;
      case 'clearAll': result = clearAll(); break;
      default: return jsonOut({ ok: false, error: 'unknown action: ' + action });
    }
    return jsonOut(Object.assign({ ok: true }, result || {}));
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function addLog(p) {
  var photoUrl = '';
  if (p.photoDataUrl) photoUrl = savePhoto(p.photoDataUrl, p.id);
  var f = p.fields || {};
  var common = ['date', 'time', 'author', 'summary', 'handover'];
  var rest = {};
  Object.keys(f).forEach(function (k) { if (common.indexOf(k) < 0) rest[k] = f[k]; });
  sheetOf('logs').appendRow([p.id, p.team, p.createdAt, f.date || '', f.time || '', f.author || '', f.summary || '', f.handover || '', JSON.stringify(rest), photoUrl]);
  return { id: p.id, photoUrl: photoUrl };
}

function deleteLog(p) {
  var sh = sheetOf('logs');
  var i = findRowIndexById(sh, 0, p.id);
  if (i > 0) sh.deleteRow(i);
  return {};
}

function upsertWater(p) {
  var sh = sheetOf('water');
  var values = sh.getDataRange().getValues();
  var dateCol = SHEETS.water.header.indexOf('date');
  var foundRow = -1;
  for (var i = 1; i < values.length; i++) { if (values[i][dateCol] === p.date) { foundRow = i + 1; break; } }
  var row = SHEETS.water.header.map(function (h) { return h === 'id' ? (p.id || Utilities.getUuid()) : (p[h] || ''); });
  if (foundRow > 0) sh.getRange(foundRow, 1, 1, row.length).setValues([row]);
  else sh.appendRow(row);
  return {};
}

function deleteWater(p) {
  var sh = sheetOf('water');
  var i = findRowIndexById(sh, 0, p.id);
  if (i > 0) sh.deleteRow(i);
  return {};
}

function addEnvBulk(p) {
  var sh = sheetOf('env');
  var existing = {};
  sh.getDataRange().getValues().slice(1).forEach(function (r) { existing[r[0]] = true; });
  var rows = (p.rows || []).filter(function (r) { return !existing[r.k]; });
  if (rows.length) {
    var data = rows.map(function (r) { return [r.k, r.d, r.t, r.w, r.r, r.h, r.p, r.s]; });
    sh.getRange(sh.getLastRow() + 1, 1, data.length, data[0].length).setValues(data);
  }
  return { added: rows.length, skipped: (p.rows || []).length - rows.length };
}

function deleteEnvByLogId(p) {
  var sh = sheetOf('env');
  var values = sh.getDataRange().getValues();
  for (var i = values.length - 1; i >= 1; i--) {
    if (String(values[i][0]).indexOf('|m|' + p.logId) >= 0) sh.deleteRow(i + 1);
  }
  return {};
}

function setTask(p) {
  var sh = sheetOf('tasks');
  var i = findRowIndexById(sh, 0, p.id);
  if (i > 0) sh.getRange(i, 2).setValue(!!p.checked);
  else sh.appendRow([p.id, !!p.checked]);
  return {};
}

function clearAll() {
  Object.keys(SHEETS).forEach(function (key) {
    var sh = sheetOf(key);
    if (sh.getLastRow() > 1) sh.deleteRows(2, sh.getLastRow() - 1);
  });
  return {};
}

/* ---------- 写真をGoogleドライブに保存 ---------- */
function savePhoto(dataUrl, id) {
  var m = dataUrl.match(/^data:(image\/[a-zA-Z]+);base64,(.*)$/);
  if (!m) return '';
  var contentType = m[1], base64 = m[2];
  var bytes = Utilities.base64Decode(base64);
  var blob = Utilities.newBlob(bytes, contentType, id + '.jpg');
  var folders = DriveApp.getFoldersByName(PHOTO_FOLDER_NAME);
  var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(PHOTO_FOLDER_NAME);
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return 'https://drive.google.com/uc?export=view&id=' + file.getId();
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
