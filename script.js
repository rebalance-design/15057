/*
 * Вставте URL розгорнутого Google Apps Script Web App нижче.
 * Приклад: https://script.google.com/macros/s/AKfycb.../exec
 */
const APPS_SCRIPT_URL = 'PASTE_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE';
const MAX_FILE_SIZE = 8 * 1024 * 1024;
const ALLOWED_FILE_EXTENSIONS = ['p7s', 'jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'];

const navToggle = document.querySelector('.nav-toggle');
const nav = document.querySelector('.site-nav');

if (navToggle && nav) {
  navToggle.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });

  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      nav.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });
}

const form = document.querySelector('#join-form');
const nameField = document.querySelector('#name');
const orgField = document.querySelector('#organization');
const roleField = document.querySelector('#role');
const formatField = document.querySelector('#join-format');
const fileField = document.querySelector('#signed-file');
const preview = document.querySelector('#statement-preview');
const copyButton = document.querySelector('#copy-statement');
const submitButton = document.querySelector('#submit-button');
const formStatus = document.querySelector('#form-status');
const formStartedAt = Date.now();

function buildStatement() {
  const name = nameField?.value.trim() || '________________________';
  const org = orgField?.value.trim();
  const role = roleField?.value.trim();
  const format = formatField?.value || 'як підписант / підписантка';
  let identity = name;
  const details = [role, org].filter(Boolean).join(', ');

  if (details) identity += `, ${details}`;

  return `Я, ${identity}, підтверджую, що ознайомився / ознайомилася з текстом публічної резолюції щодо підтримки законопроєкту №15057 та приєднуюся до неї ${format}.\n\nДаю згоду на зазначення мого імені / назви організації у списку підписантів цієї резолюції.\n\nМені відомо, що резолюція може бути подана до Міністерства оборони України, профільних комітетів Верховної Ради України, інших державних органів, а також оприлюднена в межах адвокації законопроєкту №15057.`;
}

function updatePreview() {
  if (preview) preview.textContent = buildStatement();
}

[nameField, orgField, roleField, formatField].forEach((field) => {
  field?.addEventListener('input', updatePreview);
  field?.addEventListener('change', updatePreview);
});

copyButton?.addEventListener('click', async () => {
  const text = buildStatement();

  try {
    await navigator.clipboard.writeText(text);
    copyButton.textContent = 'Скопійовано';
    setTimeout(() => { copyButton.textContent = 'Скопіювати текст заяви'; }, 1800);
  } catch {
    showStatus('Не вдалося скопіювати текст. Виділіть його та скопіюйте вручну.', 'error');
  }
});

function showStatus(message, type) {
  if (!formStatus) return;
  formStatus.textContent = message;
  formStatus.className = `form-status visible ${type}`;
}

function clearStatus() {
  if (!formStatus) return;
  formStatus.textContent = '';
  formStatus.className = 'form-status';
}

function getFileExtension(filename) {
  return filename.split('.').pop()?.toLowerCase() || '';
}

function validateFile(file) {
  if (!file) return;

  const extension = getFileExtension(file.name);
  if (!ALLOWED_FILE_EXTENSIONS.includes(extension)) {
    throw new Error('Додайте файл .p7s або зображення у форматі JPG, PNG, WEBP, HEIC чи HEIF.');
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error('Розмір файла не повинен перевищувати 8 МБ.');
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = () => reject(new Error('Не вдалося прочитати вибраний файл.'));
    reader.readAsDataURL(file);
  });
}

async function buildPayload(formElement) {
  const data = new FormData(formElement);
  const file = fileField?.files?.[0];
  validateFile(file);

  const payload = {
    name: String(data.get('name') || '').trim(),
    organization: String(data.get('organization') || '').trim(),
    role: String(data.get('role') || '').trim(),
    email: String(data.get('email') || '').trim(),
    phone: String(data.get('phone') || '').trim(),
    joinFormat: String(data.get('join_format') || '').trim(),
    comment: String(data.get('comment') || '').trim(),
    consentPublication: data.get('consent_publication') === 'on',
    consentData: data.get('consent_data') === 'on',
    website: String(data.get('website') || '').trim(),
    statement: buildStatement(),
    pageUrl: window.location.href,
    startedAt: formStartedAt,
    submittedAt: Date.now(),
    file: null,
  };

  if (file) {
    payload.file = {
      name: file.name,
      type: file.type || 'application/octet-stream',
      size: file.size,
      base64: await fileToBase64(file),
    };
  }

  return payload;
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearStatus();

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.includes('PASTE_GOOGLE')) {
    showStatus('Форма ще не підключена до Google Таблиці. Спочатку вставте URL вебзастосунку в script.js.', 'error');
    return;
  }

  const originalButtonText = submitButton?.textContent || 'Надіслати дані';

  try {
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Надсилання…';
    }

    const payload = await buildPayload(form);
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow',
    });

    const rawResponse = await response.text();
    let result;

    try {
      result = JSON.parse(rawResponse);
    } catch {
      throw new Error('Сервер повернув некоректну відповідь. Перевірте налаштування Google Apps Script.');
    }

    if (!result.ok) {
      throw new Error(result.message || 'Не вдалося надіслати заяву.');
    }

    form.reset();
    updatePreview();
    showStatus('Дякуємо. Ваші дані успішно надіслано.', 'success');
  } catch (error) {
    console.error(error);
    showStatus(error instanceof Error ? error.message : 'Сталася помилка під час надсилання. Спробуйте ще раз.', 'error');
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = originalButtonText;
    }
  }
});

fileField?.addEventListener('change', () => {
  clearStatus();
  const file = fileField.files?.[0];

  try {
    validateFile(file);
  } catch (error) {
    fileField.value = '';
    showStatus(error instanceof Error ? error.message : 'Недопустимий файл.', 'error');
  }
});

updatePreview();
