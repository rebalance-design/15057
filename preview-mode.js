// Preview only. Production source files are unchanged.
document.addEventListener('submit', function (event) {
  if (event.target.id !== 'join-form') return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const status = document.getElementById('form-status');
  if (!status) return;
  status.className = 'form-status visible';
  status.setAttribute('role', 'status');
  status.textContent = document.documentElement.lang === 'en'
    ? 'This is preview version 2.0. Statements are not sent from this site.'
    : 'Це тестова версія 2.0. Заяви з цього сайту не надсилаються.';
}, true);
