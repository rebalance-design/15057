// Event pages share the homepage's navigation behaviour without loading its form code.
(() => {
  const button=document.querySelector('.nav-toggle');
  const nav=document.querySelector('.site-header .site-nav');
  if (!button || !nav) return;
  const en=document.documentElement.lang==='en';
  const setOpen=open=>{
    nav.classList.toggle('open',open);
    button.setAttribute('aria-expanded',String(open));
    button.setAttribute('aria-label',en?(open?'Close menu':'Open menu'):(open?'Закрити меню':'Відкрити меню'));
  };
  button.addEventListener('click',()=>setOpen(button.getAttribute('aria-expanded')!=='true'));
  nav.addEventListener('click',event=>{if(event.target.closest('a'))setOpen(false);});
  document.addEventListener('click',event=>{if(!nav.contains(event.target)&&!button.contains(event.target))setOpen(false);});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&button.getAttribute('aria-expanded')==='true'){setOpen(false);button.focus();}});
  window.matchMedia('(max-width: 1000px)').addEventListener('change',event=>{if(!event.matches)setOpen(false);});
})();
