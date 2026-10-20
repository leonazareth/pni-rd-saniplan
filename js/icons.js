/* Ícones de traço (24x24), cor herdada via currentColor. */
(function () {
  const S = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const ICONS = {
    people: S('<circle cx="7" cy="7" r="2.3"/><circle cx="17" cy="7" r="2.3"/><circle cx="12" cy="10" r="2.3"/><path d="M3 18c0-3 2-5 4-5s2.3.6 3 1.4M21 18c0-3-2-5-4-5s-2.3.6-3 1.4M7.5 21c0-3.2 2-5.5 4.5-5.5s4.5 2.3 4.5 5.5"/>'),
    sat: S('<rect x="9" y="9" width="6" height="6" rx="1" transform="rotate(45 12 12)"/><path d="M5.5 5.5l3 3M15.5 15.5l3 3M3 8l5-5 3 3-5 5zM13 18l5-5 3 3-5 5z"/><path d="M4 20c1.5 0 3-1.5 3-3"/>'),
    roads: S('<path d="M3 7h18M3 16h18M8 3v18M16 3v18"/><path d="M11 11.5h2" stroke-dasharray="1 2"/>'),
    bldg: S('<path d="M4 21V9l6-3v15M10 21V4l10 4v13M2 21h20"/><path d="M13 10h1M16 10h1M13 13h1M16 13h1M13 16h1M16 16h1M6.5 12h1M6.5 15h1"/>'),
    // rede coletora: dois ramais chegando ao coletor tronco, sentido do fluxo e PVs (adaptado do ícone RedBasica)
    pipes: S('<path d="M3.7 3.7v5.3l8.3 2.8M20.3 3.7v3.5L12 10.2M12 4v15.6" stroke-width="1.8"/><path d="M9.8 14.3l2.2 2.2 2.2-2.2" stroke-width="1.8"/><circle cx="3.7" cy="3.7" r="1.4" fill="currentColor" stroke="none"/><circle cx="20.3" cy="3.7" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="4" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="20.2" r="1.4" fill="currentColor" stroke="none"/>'),
    cost: S('<path d="M12 3v18M16.5 7.5c-.8-1.3-2.4-2-4.5-2-2.6 0-4.3 1.3-4.3 3.1 0 4.4 9 2.3 9 6.6 0 1.9-1.9 3.3-4.7 3.3-2.3 0-4.1-.9-4.9-2.4"/>'),
    hex: S('<path d="M8 3.5l4 2.3v4.6l-4 2.3-4-2.3V5.8zM16 8.1l4 2.3V15l-4 2.3-4-2.3v-4.6zM8 12.7l4 2.3v4.6l-4 2.3-4-2.3V15z"/>'),
    coins: S('<ellipse cx="9" cy="7" rx="5.5" ry="2.3"/><path d="M3.5 7v4c0 1.3 2.5 2.3 5.5 2.3s5.5-1 5.5-2.3V7"/><path d="M9.5 15.7c.9 1 3 1.6 5 1.6 3 0 5.5-1 5.5-2.3v-4c0-1.3-2.5-2.3-5.5-2.3"/><path d="M14.5 11.3c3 0 5.5-1 5.5-2.3M9.5 19.7c.9 1 3 1.6 5 1.6 3 0 5.5-1 5.5-2.3v-4"/>'),
    bars: S('<path d="M3 21h18"/><rect x="5" y="12" width="3" height="9"/><rect x="10.5" y="8" width="3" height="13"/><rect x="16" y="4" width="3" height="17"/>'),
    rank: S('<path d="M4 6h3M4 12h3M4 18h3"/><path d="M10 6h10M10 12h7M10 18h4"/><path d="M19 15l2 2.5-2 2.5"/>')
  };
  window.ICONS = ICONS;
  window.renderIcons = (root = document) => root.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = ICONS[el.dataset.icon] || ''; });
})();
