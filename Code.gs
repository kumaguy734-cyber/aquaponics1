/**
 * Web App からの GET リクエストを処理（スプレッドシートのデータを読み込んで返却）
 */
function doGet(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = sheet.getDataRange().getValues();
    
    var resultData = [];
    
    // 2行目以降（ヘッダーを除く）のデータをオブジェクトに変換
    for (var i = 1; i < data.length; i++) {
      resultData.push({
        timestamp: data[i][0], // 1列目: 日時
        value: data[i][1]      // 2列目: 数値・データ
      });
    }

    var output = {
      status: 'success',
      data: resultData
    };

    return createJsonResponse(output);

  } catch (err) {
    var errorOutput = {
      status: 'error',
      message: err.toString()
    };
    return createJsonResponse(errorOutput);
  }
}

/**
 * Web App からの POST リクエストを処理（データをスプレッドシートに追記）
 */
function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var postData = JSON.parse(e.postData.contents);

    // 受信したデータをスプレッドシートの最終行に追加
    if (postData.timestamp && postData.value) {
      sheet.appendRow([postData.timestamp, postData.value]);
    } else if (Array.isArray(postData)) {
      postData.forEach(function(row) {
        sheet.appendRow([row.timestamp, row.value]);
      });
    }

    var output = {
      status: 'success',
      message: 'Data saved successfully'
    };

    return createJsonResponse(output);

  } catch (err) {
    var errorOutput = {
      status: 'error',
      message: err.toString()
    };
    return createJsonResponse(errorOutput);
  }
}

/**
 * JSON形式でレスポンスを作成するヘルパー関数（CORS対応）
 */
function createJsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
