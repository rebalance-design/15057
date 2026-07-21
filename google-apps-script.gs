/**
 * Google Apps Script для приймання заяв із сайту.
 *
 * 1. Створіть Google Таблицю та папку в Google Drive.
 * 2. Вставте їхні ID у CONFIG.
 * 3. Розгорніть скрипт як Web App:
 *    Execute as: Me
 *    Who has access: Anyone
 * 4. URL Web App вставте в APPS_SCRIPT_URL у script.js.
 */

const CONFIG = {
  SPREADSHEET_ID: 'PASTE_GOOGLE_SHEET_ID_HERE',
  SHEET_NAME: 'Заявки',
  DRIVE_FOLDER_ID: 'PASTE_GOOGLE_DRIVE_FOLDER_ID_HERE',
  MAX_FILE_BYTES: 8 * 1024 * 1024,
  ALLOWED_FILE_EXTENSIONS: ['p7s', 'jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'],
};

const HEADERS = [
  'Дата й час',
  'ПІБ',
  'Організація / спільнота',
  'Посада / статус',
  'Email',
  'Телефон / месенджер',
  'Формат приєднання',
  'Коментар',
  'Згода на публікацію',
  'Згода на обробку даних',
  'Текст заяви',
  'Файл',
  'Сторінка',
];

function doPost(e) {
  const lock = LockService.getScriptLock();

  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error('Порожній запит.');
    }

    const data = JSON.parse(e.postData.contents);

    // Honeypot: бот заповнив приховане поле. Відповідаємо успіхом, але нічого не записуємо.
    if (cleanText_(data.website, 200)) {
      return json_({ ok: true });
    }

    validateSubmission_(data);
    preventRapidDuplicate_(data.email);

    lock.waitLock(15000);

    const sheet = getOrCreateSheet_();
    const fileUrl = data.file ? saveFile_(data.file, data.name) : '';

    sheet.appendRow([
      new Date(),
      safeCell_(data.name, 120),
      safeCell_(data.organization, 180),
      safeCell_(data.role, 180),
      safeCell_(data.email, 160),
      safeCell_(data.phone, 80),
      safeCell_(data.joinFormat, 180),
      safeCell_(data.comment, 2000),
      data.consentPublication ? 'Так' : 'Ні',
      data.consentData ? 'Так' : 'Ні',
      safeCell_(data.statement, 5000),
      fileUrl,
      safeCell_(data.pageUrl, 500),
    ]);

    return json_({ ok: true });
  } catch (error) {
    console.error(error);
    return json_({
      ok: false,
      message: error && error.message ? error.message : 'Помилка обробки заяви.',
    });
  } finally {
    try {
      lock.releaseLock();
    } catch (error) {
      // Lock міг не бути отриманий — це нормально.
    }
  }
}

function validateSubmission_(data) {
  const name = cleanText_(data.name, 120);
  const email = cleanText_(data.email, 160);
  const submittedAt = Number(data.submittedAt || 0);
  const startedAt = Number(data.startedAt || 0);

  if (!name) throw new Error('Не вказано ПІБ.');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Некоректний email.');
  if (!data.consentPublication || !data.consentData) throw new Error('Потрібно підтвердити обидві згоди.');

  // Проста перевірка проти автоматичного миттєвого відправлення.
  if (startedAt && submittedAt && submittedAt - startedAt < 2000) {
    throw new Error('Форму надіслано надто швидко. Спробуйте ще раз.');
  }

  if (data.file) validateFile_(data.file);
}

function validateFile_(file) {
  const filename = cleanText_(file.name, 240);
  const extension = getExtension_(filename);
  const size = Number(file.size || 0);

  if (!filename || !file.base64) throw new Error('Файл пошкоджений або не переданий.');
  if (CONFIG.ALLOWED_FILE_EXTENSIONS.indexOf(extension) === -1) {
    throw new Error('Дозволені лише .p7s або зображення JPG, PNG, WEBP, HEIC чи HEIF.');
  }
  if (!size || size > CONFIG.MAX_FILE_BYTES) throw new Error('Файл перевищує дозволені 8 МБ.');
}

function saveFile_(file, signerName) {
  const bytes = Utilities.base64Decode(file.base64);

  if (bytes.length > CONFIG.MAX_FILE_BYTES) {
    throw new Error('Файл перевищує дозволені 8 МБ.');
  }

  const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
  const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HH-mm-ss');
  const originalName = cleanFilename_(file.name || 'attachment');
  const safeSigner = cleanFilename_(signerName || 'signer');
  const finalName = `${timestamp}_${safeSigner}_${originalName}`;
  const mimeType = cleanText_(file.type, 120) || 'application/octet-stream';
  const blob = Utilities.newBlob(bytes, mimeType, finalName);
  const createdFile = folder.createFile(blob);

  return createdFile.getUrl();
}

function getOrCreateSheet_() {
  const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(CONFIG.SHEET_NAME);

  if (!sheet) sheet = spreadsheet.insertSheet(CONFIG.SHEET_NAME);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  }

  return sheet;
}

function preventRapidDuplicate_(email) {
  const normalizedEmail = cleanText_(email, 160).toLowerCase();
  const digest = Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, normalizedEmail)
  );
  const key = `submission_${digest.slice(0, 32)}`;
  const cache = CacheService.getScriptCache();

  if (cache.get(key)) {
    throw new Error('Заяву з цією email-адресою щойно вже було надіслано. Зачекайте хвилину.');
  }

  cache.put(key, '1', 60);
}

function cleanText_(value, maxLength) {
  return String(value == null ? '' : value).trim().slice(0, maxLength || 1000);
}

function safeCell_(value, maxLength) {
  const text = cleanText_(value, maxLength);

  // Захист від формул у Google Sheets.
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function cleanFilename_(value) {
  return cleanText_(value, 180)
    .replace(/[\\/:*?"<>|#%{}~&]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_');
}

function getExtension_(filename) {
  const parts = String(filename).toLowerCase().split('.');
  return parts.length > 1 ? parts.pop() : '';
}

function json_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
