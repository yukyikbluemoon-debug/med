const SHEET_MEDICINES = 'Medicines';
const SHEET_CONFIG = 'Config';
const DRIVE_FOLDER_NAME = 'Medicine App Photos';

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    const action = body.action;

    if (action === 'list') {
      return json({ ok: true, medicines: listMedicines(), config: getConfig() });
    }

    if (action === 'saveMedicine') {
      const medicine = saveMedicine(body.medicine);
      return json({ ok: true, medicine });
    }

    if (action === 'deleteMedicine') {
      deleteMedicine(body.id);
      return json({ ok: true });
    }

    if (action === 'saveConfig') {
      saveConfig(body.config || {});
      installReminderTriggers();
      return json({ ok: true, config: getConfig() });
    }

    if (action === 'sendTestTelegram') {
      sendTelegramMessage('ทดสอบแจ้งเตือนจากแอปตารางยา');
      return json({ ok: true });
    }

    throw new Error('Unknown action');
  } catch (error) {
    return json({ ok: false, error: error.message });
  }
}

function listMedicines() {
  const sheet = getSheet(SHEET_MEDICINES, [
    'id',
    'name',
    'dose',
    'periods',
    'meal',
    'note',
    'imageUrl',
    'imageFileId',
    'updatedAt',
  ]);
  const rows = sheet.getDataRange().getValues();
  return rows.slice(1).filter(row => row[0]).map(row => ({
    id: row[0],
    name: row[1],
    dose: row[2],
    periods: safeJson(row[3], []),
    meal: row[4],
    note: row[5],
    imageUrl: row[6],
    imageFileId: row[7],
    updatedAt: row[8],
  }));
}

function saveMedicine(medicine) {
  if (!medicine || !medicine.name || !medicine.dose) {
    throw new Error('Missing medicine data');
  }

  const sheet = getSheet(SHEET_MEDICINES, [
    'id',
    'name',
    'dose',
    'periods',
    'meal',
    'note',
    'imageUrl',
    'imageFileId',
    'updatedAt',
  ]);

  const id = medicine.id || Utilities.getUuid();
  const current = findMedicineById(id);
  let imageUrl = medicine.imageUrl || '';
  let imageFileId = medicine.imageFileId || current.imageFileId || '';

  if (imageUrl.indexOf('data:image') === 0) {
    const uploaded = saveImageToDrive(imageUrl, `${id}.jpg`, imageFileId);
    imageUrl = uploaded.url;
    imageFileId = uploaded.fileId;
  }

  const row = [
    id,
    medicine.name,
    medicine.dose,
    JSON.stringify(medicine.periods || []),
    medicine.meal || 'ไม่ระบุ',
    medicine.note || '',
    imageUrl,
    imageFileId,
    new Date().toISOString(),
  ];

  const rowIndex = findRowIndex(sheet, id);
  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }

  return {
    id,
    name: medicine.name,
    dose: medicine.dose,
    periods: medicine.periods || [],
    meal: medicine.meal || 'ไม่ระบุ',
    note: medicine.note || '',
    imageUrl,
    imageFileId,
  };
}

function deleteMedicine(id) {
  const sheet = getSheet(SHEET_MEDICINES, []);
  const rowIndex = findRowIndex(sheet, id);
  if (rowIndex > 0) {
    sheet.deleteRow(rowIndex);
  }
}

function findMedicineById(id) {
  return listMedicines().find(item => item.id === id) || {};
}

function getConfig() {
  const sheet = getSheet(SHEET_CONFIG, ['key', 'value']);
  const rows = sheet.getDataRange().getValues();
  const values = {};
  rows.slice(1).forEach(row => {
    if (row[0]) values[row[0]] = safeJson(row[1], row[1]);
  });
  return values;
}

function saveConfig(config) {
  const sheet = getSheet(SHEET_CONFIG, ['key', 'value']);
  sheet.clearContents();
  sheet.appendRow(['key', 'value']);
  Object.keys(config).forEach(key => {
    sheet.appendRow([key, JSON.stringify(config[key])]);
  });
}

function installReminderTriggers() {
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === 'runMedicineReminders') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  ScriptApp.newTrigger('runMedicineReminders').timeBased().everyMinutes(5).create();
}

function runMedicineReminders() {
  const config = getConfig();
  const times = config.times || {};
  const notify = config.notify || {};
  const now = new Date();
  const current = Utilities.formatDate(now, Session.getScriptTimeZone(), 'HH:mm');
  const periodId = Object.keys(times).find(key => times[key] === current && notify[key] !== false);
  if (!periodId) return;

  const sentKey = `sent_${periodId}_${Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyyMMdd_HHmm')}`;
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty(sentKey)) return;

  const periodLabels = {
    morning: 'เช้า',
    noon: 'กลางวัน',
    evening: 'เย็น',
    bedtime: 'ก่อนนอน',
  };
  const medicines = listMedicines().filter(item => (item.periods || []).indexOf(periodId) >= 0);
  if (!medicines.length) return;

  const lines = medicines.map(item => `- ${item.name}: ${item.dose} ${item.meal || ''}`.trim());
  sendTelegramMessage(`ถึงเวลากินยา: ${periodLabels[periodId] || periodId}\n${lines.join('\n')}`);
  props.setProperty(sentKey, '1');
}

function sendTelegramMessage(text) {
  const config = getConfig();
  const token = config.telegramBotToken;
  const chatId = config.telegramChatId;
  if (!token || !chatId) throw new Error('Missing Telegram config');

  UrlFetchApp.fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ chat_id: chatId, text }),
    muteHttpExceptions: true,
  });
}

function saveImageToDrive(dataUrl, fileName, oldFileId) {
  const parts = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!parts) throw new Error('Invalid image data');

  const bytes = Utilities.base64Decode(parts[2]);
  const blob = Utilities.newBlob(bytes, parts[1], fileName);
  const folder = getPhotoFolder();

  if (oldFileId) {
    try {
      DriveApp.getFileById(oldFileId).setTrashed(true);
    } catch (error) {
      // Keep saving the new image even if the old image cannot be removed.
    }
  }

  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return {
    fileId: file.getId(),
    url: `https://drive.google.com/uc?export=view&id=${file.getId()}`,
  };
}

function getPhotoFolder() {
  const folders = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(DRIVE_FOLDER_NAME);
}

function getSheet(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  if (headers.length && sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  }
  return sheet;
}

function findRowIndex(sheet, id) {
  if (!id || sheet.getLastRow() < 2) return -1;
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  const index = values.findIndex(row => row[0] === id);
  return index >= 0 ? index + 2 : -1;
}

function safeJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

function json(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
