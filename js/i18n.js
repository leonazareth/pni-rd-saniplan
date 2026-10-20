/* Traduções: i18n/<lang>.json. Chaves ausentes caem no português (pt.json).
   Marcação no HTML:
     data-i18n="a.b"        -> textContent
     data-i18n-html="a.b"   -> innerHTML (permite <strong>, <br>)
     data-i18n-list="a.b"   -> array de itens -> <li> */
(function () {
  const BASE = 'pt';
  const SUPPORTED = ['pt', 'es', 'en'];
  const dicts = {};
  const listeners = [];
  let lang = BASE;

  const get = (obj, key) => key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

  function t(key) {
    const v = get(dicts[lang], key);
    return v !== undefined ? v : get(dicts[BASE], key);
  }

  async function load(code) {
    if (dicts[code]) return dicts[code];
    const r = await fetch(`i18n/${code}.json`, { cache: 'no-cache' });
    dicts[code] = r.ok ? await r.json() : {};
    return dicts[code];
  }

  function apply(root = document) {
    root.querySelectorAll('[data-i18n]').forEach(el => {
      const v = t(el.dataset.i18n); if (typeof v === 'string') el.textContent = v;
    });
    root.querySelectorAll('[data-i18n-html]').forEach(el => {
      const v = t(el.dataset.i18nHtml); if (typeof v === 'string') el.innerHTML = v;
    });
    root.querySelectorAll('[data-i18n-title]').forEach(el => {
      const v = t(el.dataset.i18nTitle); if (typeof v === 'string') { el.title = v; el.setAttribute('aria-label', v); }
    });
    root.querySelectorAll('[data-i18n-list]').forEach(el => {
      const v = t(el.dataset.i18nList);
      if (Array.isArray(v)) el.innerHTML = v.map(s => `<li>${s}</li>`).join('');
    });
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-lang]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  }

  async function set(code) {
    if (!SUPPORTED.includes(code)) code = BASE;
    await load(BASE);
    await load(code);
    lang = code;
    try { localStorage.setItem('pni-lang', code); } catch (e) { /* sem armazenamento */ }
    apply();
    listeners.forEach(fn => fn(code));
  }

  function initial() {
    let saved = null;
    try { saved = localStorage.getItem('pni-lang'); } catch (e) { /* ignore */ }
    const fromUrl = new URLSearchParams(location.search).get('lang');
    return fromUrl || saved || BASE;
  }

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-lang]');
    if (b) set(b.dataset.lang);
  });

  window.I18N = { t, set, apply, initial, onChange: fn => listeners.push(fn), get lang() { return lang; } };
})();
