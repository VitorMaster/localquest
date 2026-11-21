/* Localquest — gráficos em SVG puro (sem dependências). */
(function () {
  const Q = window.Q;
  const C = (Q.Charts = {});
  let uid = 0;

  /** Anel de progresso com gradiente. value 0..1 */
  C.ring = (value, o = {}) => {
    const size = o.size || 132, stroke = o.stroke || 12, r = (size - stroke) / 2, circ = 2 * Math.PI * r;
    const v = Q.clamp(value || 0, 0, 1), id = 'rg' + ++uid;
    const c1 = o.c1 || 'var(--accent)', c2 = o.c2 || 'var(--accent2)';
    return `<div class="ring" style="width:${size}px;height:${size}px">
      <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${Q.esc(o.label || '')} ${Math.round(v * 100)}%">
        <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
        <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--track)" stroke-width="${stroke}"/>
        <circle class="ring-v" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="url(#${id})" stroke-width="${stroke}" stroke-linecap="round"
          stroke-dasharray="${circ}" stroke-dashoffset="${circ * (1 - v)}" style="--c:${circ}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
      </svg>
      <div class="ring-t"><b>${o.text != null ? o.text : Math.round(v * 100) + '%'}</b>${o.label ? `<small>${Q.esc(o.label)}</small>` : ''}</div>
    </div>`;
  };

  /** Radar. items: [{label, value 0..1}] (precisa ≥3 eixos) */
  C.radar = (items, o = {}) => {
    const size = o.size || 320, cx = size / 2, cy = size / 2, R = size / 2 - 58, n = items.length;
    if (n < 3) return '';
    const pt = (i, k) => {
      const a = (Math.PI * 2 * i) / n - Math.PI / 2;
      return [cx + Math.cos(a) * R * k, cy + Math.sin(a) * R * k];
    };
    const grid = [0.25, 0.5, 0.75, 1]
      .map((k) => `<polygon points="${items.map((_, i) => pt(i, k).join(',')).join(' ')}" fill="none" stroke="var(--line)" stroke-width="1"/>`)
      .join('');
    const axes = items.map((_, i) => `<line x1="${cx}" y1="${cy}" x2="${pt(i, 1)[0]}" y2="${pt(i, 1)[1]}" stroke="var(--line)"/>`).join('');
    const poly = items.map((it, i) => pt(i, Q.clamp(it.value, 0.02, 1)).join(',')).join(' ');
    const dots = items.map((it, i) => { const [x, y] = pt(i, Q.clamp(it.value, 0.02, 1)); return `<circle cx="${x}" cy="${y}" r="4" fill="var(--accent2)" stroke="var(--card-solid)" stroke-width="2"><title>${Q.esc(it.label)}: ${Math.round(it.value * 100)}%</title></circle>`; }).join('');
    const labels = items.map((it, i) => {
      const [x, y] = pt(i, 1.2);
      const anchor = x < cx - 8 ? 'end' : x > cx + 8 ? 'start' : 'middle';
      const lab = it.label.length > 16 ? it.label.slice(0, 15) + '…' : it.label;
      return `<text x="${x}" y="${y}" text-anchor="${anchor}" class="rad-l">${Q.esc(lab)}<tspan x="${x}" dy="1.2em" class="rad-v">${Math.round(it.value * 100)}%</tspan></text>`;
    }).join('');
    const id = 'rd' + ++uid;
    return `<svg class="radar" viewBox="0 0 ${size} ${size}" role="img" aria-label="Desempenho por matéria">
      <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".55"/><stop offset="1" stop-color="var(--accent2)" stop-opacity=".55"/></linearGradient></defs>
      ${grid}${axes}<polygon points="${poly}" fill="url(#${id})" stroke="var(--accent2)" stroke-width="2" stroke-linejoin="round" class="rad-poly"/>${dots}${labels}</svg>`;
  };

  /** Linhas. series: [{name,color,values:[0..1|null]}], labels:[string] */
  C.lines = (series, labels, o = {}) => {
    const W = o.w || 560, H = o.h || 220, pl = 34, pr = 12, pt = 12, pb = 26;
    const n = labels.length;
    if (!n) return '';
    const x = (i) => pl + (n === 1 ? (W - pl - pr) / 2 : (i * (W - pl - pr)) / (n - 1));
    const y = (v) => pt + (1 - v) * (H - pt - pb);
    const grid = [0, 0.25, 0.5, 0.75, 1].map((g) => `<line x1="${pl}" x2="${W - pr}" y1="${y(g)}" y2="${y(g)}" stroke="var(--line)"/><text x="${pl - 6}" y="${y(g) + 4}" text-anchor="end" class="ax">${Math.round(g * 100)}</text>`).join('');
    const step = Math.ceil(n / 8);
    const xl = labels.map((l, i) => (i % step === 0 || i === n - 1 ? `<text x="${x(i)}" y="${H - 8}" text-anchor="middle" class="ax">${Q.esc(l)}</text>` : '')).join('');
    const paths = series.map((s) => {
      const pts = s.values.map((v, i) => (v == null ? null : [x(i), y(v)])).filter(Boolean);
      if (!pts.length) return '';
      const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
      const area = s.area ? `<path d="${d} L${pts[pts.length - 1][0]} ${y(0)} L${pts[0][0]} ${y(0)} Z" fill="${s.color}" opacity=".12"/>` : '';
      const dots = pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="${s.color}" stroke="var(--card-solid)" stroke-width="2"><title>${Q.esc(s.name)}: ${Math.round(s.values.filter((v) => v != null)[i] * 100)}%</title></circle>`).join('');
      return `${area}<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>${dots}`;
    }).join('');
    return `<svg class="lines" viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolução">${grid}${xl}${paths}</svg>`;
  };

  /** Barra horizontal de valor 0..1 com rótulo. */
  C.bar = (label, value, o = {}) => {
    const v = Q.clamp(value || 0, 0, 1);
    return `<div class="hbar"><div class="hbar-h"><span>${Q.esc(label)}</span><b>${o.text != null ? o.text : Math.round(v * 100) + '%'}</b></div>
      <div class="hbar-t"><i style="width:${v * 100}%;background:${o.color || Q.scoreColor(v)}"></i></div>${o.sub ? `<small class="muted">${Q.esc(o.sub)}</small>` : ''}</div>`;
  };
})();
