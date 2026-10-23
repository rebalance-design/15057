/* Progressive enhancement only. All articles and links work without JS. */
(() => {
  const english = document.documentElement.lang === 'en';
  document.querySelectorAll('.story-questionnaire').forEach(card => {
    const facts = card.querySelector('dl');
    if (!facts || facts.children.length <= 3) return;
    const rows = [...facts.children].slice(3);
    const details = document.createElement('details');
    details.className = 'story-details';
    const summary = document.createElement('summary');
    summary.textContent = english ? 'The family’s needs and full story' : 'Потреби родини та повна історія';
    const full = document.createElement('dl');
    full.append(...rows);
    details.append(summary, full);
    facts.after(details);
  });

  const section = document.querySelector('#media');
  if (!section) return;
  const cards = [...section.querySelectorAll('.media-card')];
  const toolbar = section.querySelector('.media-toolbar');
  const filters = [...section.querySelectorAll('[data-media-filter]')];
  const status = section.querySelector('.media-count');
  const pageSize = 6;
  let activeFilter = 'all';
  let expanded = false;

  // Keep all secondary source links, grouped with native keyboard-accessible details.
  cards.forEach(card => {
    const links = card.querySelector('.media-links');
    const extra = [...links.querySelectorAll('a')].slice(1);
    if (extra.length > 1) {
      const details = document.createElement('details');
      details.className = 'media-more-links';
      const summary = document.createElement('summary');
      summary.textContent = english ? `More links (${extra.length})` : `Інші посилання (${extra.length})`;
      details.append(summary, ...extra);
      links.append(details);
    }
    const img = card.querySelector('.media-cover img');
    if (img) {
      const fallback = () => { img.hidden = true; };
      img.addEventListener('error', fallback);
      if (img.complete && img.naturalWidth === 0) fallback();
    }
  });

  const moreWrap = document.createElement('div');
  moreWrap.className = 'media-more-wrap';
  const more = document.createElement('button');
  more.type = 'button';
  more.className = 'button media-more-button';
  more.setAttribute('aria-controls', 'media-results');
  more.setAttribute('aria-expanded', 'false');
  moreWrap.append(more);
  section.querySelector('.media-grid').after(moreWrap);

  function render() {
    const matches = cards.filter(card => activeFilter === 'all' || card.dataset.mediaType === activeFilter);
    let shown = 0;
    cards.forEach(card => {
      const match = matches.includes(card);
      const visible = match && (expanded || shown < pageSize);
      card.hidden = !visible;
      if (visible) shown++;
    });
    filters.forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.mediaFilter === activeFilter));
      const count = cards.filter(card => button.dataset.mediaFilter === 'all' || card.dataset.mediaType === button.dataset.mediaFilter).length;
      button.querySelector('span').textContent = count;
    });
    status.textContent = english ? `Showing ${shown} of ${matches.length}` : `Показано ${shown} із ${matches.length}`;
    moreWrap.hidden = shown === matches.length;
    more.textContent = english ? `Show the rest (${matches.length - shown})` : `Показати решту (${matches.length - shown})`;
    more.setAttribute('aria-expanded', String(expanded));
  }

  filters.forEach(button => button.addEventListener('click', () => {
    activeFilter = button.dataset.mediaFilter;
    expanded = false;
    render();
  }));
  more.addEventListener('click', () => {
    const next = cards.find(card => card.hidden && (activeFilter === 'all' || card.dataset.mediaType === activeFilter));
    expanded = true;
    render();
    next?.querySelector('a')?.focus({preventScroll: true});
  });
  toolbar.hidden = false;
  render();
})();
