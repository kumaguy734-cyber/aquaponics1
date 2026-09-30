let chartInstance = null;
let appData = [];

document.addEventListener('DOMContentLoaded', () => {
  // 初期化処理
  const savedUrl = localStorage.getItem('gas_app_url');
  if (savedUrl) {
    document.getElementById('gas-url').value = savedUrl;
  }

  // イベントリスナーの登録
  document.getElementById('save-sync-btn').addEventListener('click', handleSaveAndSync);
  document.getElementById('import-btn').addEventListener('click', handleImportCSV);
  
  // 初期グラフ作成
  initChart();
});

// UIメッセージ表示 helper
function showStatusMessage(message, isError = true) {
  const statusEl = document.getElementById('status-message');
  statusEl.textContent = message;
  statusEl.className = `status-message ${isError ? 'error' : 'success'}`;
}

function clearStatusMessage() {
  const statusEl = document.getElementById('status-message');
  statusEl.className = 'status-message hidden';
  statusEl.textContent = '';
}

// Chart.js 初期化関数
function initChart() {
  if (typeof Chart === 'undefined') {
    showStatusMessage('Chart.js が読み込まれていません。scriptタグを確認してください。', true);
    return;
  }

  const ctx = document.getElementById('dataChart').getContext('2d');
  
  if (chartInstance) {
    chartInstance.destroy();
  }

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'データ値',
          data: [],
          borderColor: '#1e3d34',
          borderWidth: 2,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { display: true },
        y: { beginAtZero: true }
      }
    }
  });
}

// グラフ描画更新関数
function updateChart(labels, values) {
  if (!chartInstance) {
    initChart();
  }
  if (chartInstance) {
    chartInstance.data.labels = labels;
    chartInstance.data.datasets[0].data = values;
    chartInstance.update();
  }
}

// 保存して同期ボタンの処理
async function handleSaveAndSync() {
  clearStatusMessage();
  const urlInput = document.getElementById('gas-url').value.trim();
  const syncStatusText = document.getElementById('sync-status-text');

  if (!urlInput) {
    showStatusMessage('ウェブアプリのURLを入力してください。', true);
    return;
  }

  localStorage.setItem('gas_app_url', urlInput);
  syncStatusText.textContent = '通信中...';

  try {
    // データ取得 (GET通信)
    const response = await fetch(urlInput, {
      method: 'GET',
      mode: 'cors'
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.status === 'success') {
      syncStatusText.textContent = '同期完了';
      showStatusMessage('データの取得に成功しました。', false);

      if (result.data && Array.isArray(result.data)) {
        appData = result.data;
        const labels = appData.map(item => item.timestamp || item.date || '');
        const values = appData.map(item => item.value || item.temp || 0);
        updateChart(labels, values);
      }
    } else {
      throw new Error(result.message || 'データ取得エラー');
    }
  } catch (error) {
    console.error('Sync Error:', error);
    syncStatusText.textContent = '接続エラー';
    showStatusMessage(`同期に失敗しました : ${error.message} （URL・公開設定・通信環境を確認してください）`, true);
  }
}

// CSV取り込み処理
function handleImportCSV() {
  clearStatusMessage();
  const fileInput = document.getElementById('csv-file-input');
  const file = fileInput.files[0];

  if (!file) {
    showStatusMessage('CSVファイルを選択してください。', true);
    return;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    const text = e.target.result;
    parseAndProcessCSV(text);
  };
  reader.readAsText(file);
}

function parseAndProcessCSV(csvText) {
  const lines = csvText.split('\n').filter(line => line.trim() !== '');
  if (lines.length <= 1) {
    showStatusMessage('有効なCSVデータが見つかりませんでした。', true);
    return;
  }

  const labels = [];
  const values = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length >= 2) {
      labels.push(cols[0].trim());
      values.push(parseFloat(cols[1].trim()) || 0);
    }
  }

  updateChart(labels, values);
  showStatusMessage('CSVデータの取り込みが完了しました。', false);
}
