/*
 * Форма приєднання до ГО «Майбутнє має право»
 */

const APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbydApJpw28lEfSdQCHiueX346ae_-mNHq_KUi6HzwhRnaiW1abQU1hO1DRyPYkuPvMK/exec';

const MAX_FILE_SIZE = 8 * 1024 * 1024;

const ALLOWED_FILE_EXTENSIONS = [
  'p7s',
  'pdf',
  'jpg',
  'jpeg',
  'png',
  'webp',
  'heic',
  'heif',
];

/* Мобільне меню */
const navToggle = document.querySelector('.nav-toggle');
const nav = document.querySelector('.site-nav');

function closeMobileNav() {
  if (!navToggle || !nav) return;

  nav.classList.remove('open');
  navToggle.setAttribute('aria-expanded', 'false');
  navToggle.setAttribute('aria-label', 'Відкрити меню');
}

if (navToggle && nav) {
  navToggle.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('open');

    navToggle.setAttribute('aria-expanded', String(isOpen));
    navToggle.setAttribute(
      'aria-label',
      isOpen ? 'Закрити меню' : 'Відкрити меню'
    );
  });

  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', closeMobileNav);
  });

  document.addEventListener('click', (event) => {
    if (!nav.classList.contains('open')) return;

    const target = event.target;
    if (!(target instanceof Node)) return;

    if (!nav.contains(target) && !navToggle.contains(target)) {
      closeMobileNav();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && nav.classList.contains('open')) {
      closeMobileNav();
      navToggle.focus();
    }
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 920) {
      closeMobileNav();
    }
  });
}

/* Форма приєднання */
const form = document.querySelector('#join-form');
const fileField = document.querySelector('#signed-file');
const submitButton = document.querySelector('#submit-button');
const formStatus = document.querySelector('#form-status');
const formStartedAt = Date.now();

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

function getMimeTypeFromExtension(filename) {
  const extension = getFileExtension(filename);

  const mimeTypes = {
    p7s: 'application/pkcs7-signature',
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    heic: 'image/heic',
    heif: 'image/heif',
  };

  return mimeTypes[extension] || 'application/octet-stream';
}

function validateFile(file) {
  if (!file) {
    throw new Error(
      'Додайте підписану заяву у форматі .p7s, PDF або її чітку копію.'
    );
  }

  const extension = getFileExtension(file.name);

  if (!ALLOWED_FILE_EXTENSIONS.includes(extension)) {
    throw new Error(
      'Додайте файл .p7s, PDF або зображення у форматі JPG, PNG, WEBP, HEIC чи HEIF.'
    );
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

    reader.onerror = () => {
      reject(new Error('Не вдалося прочитати вибраний файл.'));
    };

    reader.readAsDataURL(file);
  });
}

async function buildPayload(formElement) {
  const data = new FormData(formElement);
  const file = fileField?.files?.[0];

  validateFile(file);

  return {
    personalDataConsent: data.get('consent_data') === 'on',
    joinConsent: data.get('consent_publication') === 'on',

    fileName: file.name,
    mimeType: getMimeTypeFromExtension(file.name),
    fileSize: file.size,
    fileData: await fileToBase64(file),

    website: String(data.get('website') || '').trim(),
    pageUrl: window.location.href,
    startedAt: formStartedAt,
    submittedAt: Date.now(),
  };
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearStatus();

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  if (!APPS_SCRIPT_URL || !APPS_SCRIPT_URL.endsWith('/exec')) {
    showStatus(
      'Форма ще не підключена до Google Apps Script.',
      'error'
    );
    return;
  }

  const originalButtonText =
    submitButton?.textContent || 'Надіслати заяву';

  try {
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Надсилання…';
    }

    const payload = await buildPayload(form);

    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
      redirect: 'follow',
    });

    const rawResponse = await response.text();
    let result;

    try {
      result = JSON.parse(rawResponse);
    } catch {
      throw new Error(
        'Сервер повернув некоректну відповідь. Перевірте налаштування Google Apps Script.'
      );
    }

    if (!result.success) {
      throw new Error(
        result.message || 'Не вдалося надіслати заяву.'
      );
    }

    form.reset();
    window.location.assign('thank-you.html');
  } catch (error) {
    console.error(error);

    showStatus(
      error instanceof Error
        ? error.message
        : 'Сталася помилка під час надсилання. Спробуйте ще раз.',
      'error'
    );
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

    showStatus(
      error instanceof Error
        ? error.message
        : 'Недопустимий файл.',
      'error'
    );
  }
});

/* PDF-модальні вікна: резолюція та правовий бриф */
const modalOpeners = document.querySelectorAll('[data-open-modal]');
const modalClosers = document.querySelectorAll('[data-close-modal]');

let activeModal = null;
let lastFocusedElement = null;

function getModalFocusableElements(modal) {
  return [
    ...modal.querySelectorAll(
      'a[href], button:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])'
    ),
  ].filter(
    (element) =>
      element instanceof HTMLElement &&
      element.offsetParent !== null
  );
}

const PDFJS_VERSION = '6.1.200';
const PDFJS_BUILD_URL =
  `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build`;

let pdfJsModulePromise = null;
const mobilePdfRenderState = new WeakMap();

function isMobilePdfView() {
  return window.matchMedia('(max-width: 700px)').matches;
}

function loadPdfJs() {
  if (!pdfJsModulePromise) {
    pdfJsModulePromise = import(`${PDFJS_BUILD_URL}/pdf.min.mjs`)
      .then((pdfjsLib) => {
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          `${PDFJS_BUILD_URL}/pdf.worker.min.mjs`;
        return pdfjsLib;
      });
  }

  return pdfJsModulePromise;
}

function getOrCreateMobilePdfViewer(modal) {
  const wrap = modal.querySelector('.pdf-frame-wrap');
  if (!(wrap instanceof HTMLElement)) return null;

  let viewer = wrap.querySelector('.pdf-mobile-viewer');

  if (!(viewer instanceof HTMLElement)) {
    viewer = document.createElement('div');
    viewer.className = 'pdf-mobile-viewer';
    viewer.setAttribute('aria-label', 'Перегляд PDF-документа');
    wrap.append(viewer);
  }

  return viewer;
}

function showMobilePdfError(viewer, baseUrl) {
  viewer.innerHTML = '';

  const message = document.createElement('p');
  message.className = 'pdf-mobile-error';
  message.append('Не вдалося завантажити документ у вбудованому перегляді. ');

  const link = document.createElement('a');
  link.href = baseUrl;
  link.target = '_blank';
  link.rel = 'noopener';
  link.textContent = 'Відкрити PDF окремо';

  message.append(link, '.');
  viewer.append(message);
}

async function renderMobilePdf(modal) {
  if (!isMobilePdfView()) return;

  const frame = modal.querySelector('.pdf-frame');
  if (!(frame instanceof HTMLIFrameElement)) return;

  const baseUrl = frame.dataset.pdfSrc;
  if (!baseUrl) return;

  const viewer = getOrCreateMobilePdfViewer(modal);
  if (!viewer) return;

  const availableWidth = Math.max(
    240,
    Math.floor(viewer.clientWidth - 20)
  );

  const previousState = mobilePdfRenderState.get(modal);

  if (
    previousState?.status === 'ready' &&
    Math.abs(previousState.width - availableWidth) < 18
  ) {
    return;
  }

  if (previousState?.status === 'loading') {
    return previousState.promise;
  }

  viewer.innerHTML =
    '<p class="pdf-mobile-loading">Завантаження документа…</p>';

  const renderPromise = (async () => {
    try {
      const pdfjsLib = await loadPdfJs();
      const loadingTask = pdfjsLib.getDocument({ url: baseUrl });
      const pdf = await loadingTask.promise;

      const pages = document.createElement('div');
      pages.className = 'pdf-mobile-pages';

      viewer.innerHTML = '';
      viewer.append(pages);

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const initialViewport = page.getViewport({ scale: 1 });
        const scale = availableWidth / initialViewport.width;
        const viewport = page.getViewport({ scale });
        const outputScale = Math.min(window.devicePixelRatio || 1, 2);

        const pageWrap = document.createElement('div');
        pageWrap.className = 'pdf-mobile-page';

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d', { alpha: false });

        if (!context) {
          throw new Error('Canvas is not supported');
        }

        canvas.width = Math.max(
          1,
          Math.floor(viewport.width * outputScale)
        );
        canvas.height = Math.max(
          1,
          Math.floor(viewport.height * outputScale)
        );
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        canvas.setAttribute(
          'aria-label',
          `Сторінка ${pageNumber} з ${pdf.numPages}`
        );

        pageWrap.append(canvas);
        pages.append(pageWrap);

        await page.render({
          canvasContext: context,
          viewport,
          transform:
            outputScale === 1
              ? null
              : [outputScale, 0, 0, outputScale, 0, 0],
        }).promise;

        page.cleanup();
      }

      mobilePdfRenderState.set(modal, {
        status: 'ready',
        width: availableWidth,
      });
    } catch (error) {
      console.error('Не вдалося відобразити PDF:', error);
      showMobilePdfError(viewer, baseUrl);
      mobilePdfRenderState.set(modal, {
        status: 'error',
        width: availableWidth,
      });
    }
  })();

  mobilePdfRenderState.set(modal, {
    status: 'loading',
    width: availableWidth,
    promise: renderPromise,
  });

  return renderPromise;
}

function preparePdfContent(modal) {
  const frame = modal.querySelector('.pdf-frame');
  if (!(frame instanceof HTMLIFrameElement)) return;

  const baseUrl = frame.dataset.pdfSrc;
  if (!baseUrl) return;

  if (isMobilePdfView()) {
    frame.removeAttribute('src');
    requestAnimationFrame(() => renderMobilePdf(modal));
    return;
  }

  const nextSrc =
    `${baseUrl}#page=1&view=FitH&toolbar=1&navpanes=0`;

  if (frame.getAttribute('src') !== nextSrc) {
    frame.setAttribute('src', nextSrc);
  }
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);

  if (!(modal instanceof HTMLElement)) return;

  if (activeModal && activeModal !== modal) {
    closeModal(activeModal, false);
  }

  preparePdfContent(modal);

  lastFocusedElement = document.activeElement;
  activeModal = modal;
  modal.hidden = false;
  document.body.classList.add('modal-open');

  requestAnimationFrame(() => {
    modal.classList.add('is-open');

    const closeButton = modal.querySelector('.pdf-modal-close');

    if (closeButton instanceof HTMLElement) {
      closeButton.focus();
    }
  });
}

function closeModal(modal = activeModal, restoreFocus = true) {
  if (!(modal instanceof HTMLElement) || modal.hidden) return;

  modal.classList.remove('is-open');
  document.body.classList.remove('modal-open');

  window.setTimeout(() => {
    modal.hidden = true;

    if (activeModal === modal) {
      activeModal = null;
    }

    if (
      restoreFocus &&
      lastFocusedElement instanceof HTMLElement
    ) {
      lastFocusedElement.focus();
    }
  }, 180);
}


let pdfResizeTimer = null;

window.addEventListener('resize', () => {
  if (!(activeModal instanceof HTMLElement) || !isMobilePdfView()) return;

  window.clearTimeout(pdfResizeTimer);
  pdfResizeTimer = window.setTimeout(() => {
    const viewer = activeModal.querySelector('.pdf-mobile-viewer');
    const state = mobilePdfRenderState.get(activeModal);

    if (!(viewer instanceof HTMLElement) || !state) return;

    const nextWidth = Math.max(240, Math.floor(viewer.clientWidth - 20));

    if (Math.abs(state.width - nextWidth) >= 18) {
      mobilePdfRenderState.delete(activeModal);
      renderMobilePdf(activeModal);
    }
  }, 220);
});

modalOpeners.forEach((button) => {
  button.addEventListener('click', () => {
    const modalId = button.getAttribute('data-open-modal');

    if (modalId) {
      openModal(modalId);
    }
  });
});

modalClosers.forEach((button) => {
  button.addEventListener('click', () => {
    const modal = button.closest('.pdf-modal');

    if (modal instanceof HTMLElement) {
      closeModal(modal);
    }
  });
});

document.addEventListener('keydown', (event) => {
  if (
    !(activeModal instanceof HTMLElement) ||
    activeModal.hidden
  ) {
    return;
  }

  if (event.key === 'Escape') {
    closeModal(activeModal);
    return;
  }

  if (event.key !== 'Tab') return;

  const focusable = getModalFocusableElements(activeModal);

  if (!focusable.length) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (
    event.shiftKey &&
    document.activeElement === first
  ) {
    event.preventDefault();
    last.focus();
  } else if (
    !event.shiftKey &&
    document.activeElement === last
  ) {
    event.preventDefault();
    first.focus();
  }
});
