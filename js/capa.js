/* Capa: o país desenhado pelos 18.352 hexágonos urbanos (centróides).
   Azul = urbano oficial; âmbar = reclassificado para urbano. */
(function () {
  async function draw() {
    const cv = document.getElementById('capa-canvas');
    if (!cv) return;
    const [hex, prov] = await Promise.all([
      DATA.get('data/hex_urbanos_rd.geojson'),
      DATA.get('data/provincias.geojson')
    ]);
    const css = getComputedStyle(document.documentElement);
    const C = { urban: css.getPropertyValue('--urban').trim(), reclass: css.getPropertyValue('--reclass').trim(), line: css.getPropertyValue('--line').trim() };

    function render() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = cv.clientWidth, h = cv.clientHeight;
      cv.width = w * dpr; cv.height = h * dpr;
      const ctx = cv.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      // extensão da RD
      const bb = [-72.05, 17.45, -68.3, 19.98];
      const k = Math.cos(18.7 * Math.PI / 180);
      const narrow = w < 760;
      const boxW = narrow ? w * 1.05 : w * 0.66, boxH = narrow ? h * 0.55 : h * 0.86;
      const s = Math.min(boxW / ((bb[2] - bb[0]) * k), boxH / (bb[3] - bb[1]));
      const ox = narrow ? (w - (bb[2] - bb[0]) * k * s) / 2 : w - (bb[2] - bb[0]) * k * s - w * 0.03;
      const oy = narrow ? h * 0.06 : (h - (bb[3] - bb[1]) * s) / 2;
      const P = (x, y) => [ox + (x - bb[0]) * k * s, oy + (bb[3] - y) * s];

      // contorno das províncias
      ctx.strokeStyle = C.line; ctx.lineWidth = 0.8;
      prov.features.filter(f => f.geometry).forEach(f => {
        const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
        polys.forEach(poly => poly.forEach(ring => {
          ctx.beginPath();
          ring.forEach(([x, y], i) => { const [px, py] = P(x, y); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
          ctx.stroke();
        }));
      });
      // hexágonos
      const r0 = Math.max(0.6, s * 0.0016);
      hex.features.forEach(f => {
        const [x, y] = f.geometry.coordinates; const [px, py] = P(x, y);
        const p = f.properties.p, rec = f.properties.r === 1;
        const r = r0 * (0.7 + Math.min(1.6, Math.sqrt(p) / 30));
        ctx.globalAlpha = rec ? 0.95 : 0.25 + Math.min(0.6, p / 2500);
        ctx.fillStyle = rec ? C.reclass : C.urban;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i + Math.PI / 6; ctx.lineTo(px + r * Math.cos(a), py + r * Math.sin(a)); }
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    }
    render();
    let t; window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(render, 150); });
  }
  window.CAPA = { draw };
})();
