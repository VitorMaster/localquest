/* Atlas — utilitários gerais. Tudo vive no namespace global `Q` (sem build, funciona em file://). */
(function () {
  const Q = (window.Q = window.Q || {});

  Q.LETTERS = ['A', 'B', 'C', 'D'];

  Q.uid = (p = 'id') =>
    p + '_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);

  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  Q.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESC[c]);

  Q.$ = (sel, root = document) => root.querySelector(sel);
  Q.$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  Q.clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  Q.pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  Q.avg = (arr) => (arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : 0);

  Q.shuffle = (arr, rnd = Math.random) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  // Pseudo-aleatório com semente (para testes reprodutíveis)
  Q.seeded = (seed) => {
    let s = seed >>> 0 || 1;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  Q.fmtDur = (ms) => {
    const s = Math.round(ms / 1000);
    const m = Math.floor(s / 60);
    const r = s % 60;
    if (m >= 60) return Math.floor(m / 60) + 'h' + String(m % 60).padStart(2, '0');
    return m ? `${m}min ${String(r).padStart(2, '0')}s` : `${r}s`;
  };

  Q.fmtDate = (t, withTime = true) => {
    const d = new Date(t);
    const o = { day: '2-digit', month: 'short' };
    if (withTime) Object.assign(o, { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleString('pt-BR', o).replace('.', '');
  };

  Q.words = (s) => (String(s || '').trim().match(/\S+/g) || []).length;

  Q.debounce = (fn, ms) => {
    let t;
    return (...a) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...a), ms);
    };
  };

  Q.toast = (msg, kind = 'info', ms = 3800) => {
    const root = document.getElementById('toasts');
    if (!root) return;
    const el = document.createElement('div');
    el.className = 'toast ' + kind;
    el.textContent = msg;
    root.appendChild(el);
    requestAnimationFrame(() => el.classList.add('in'));
    setTimeout(() => {
      el.classList.remove('in');
      setTimeout(() => el.remove(), 300);
    }, ms);
  };

  /** Abre um modal. Retorna { el, close }. */
  Q.modal = (html, opts = {}) => {
    const root = document.getElementById('modal-root');
    const wrap = document.createElement('div');
    wrap.className = 'modal-back';
    wrap.innerHTML = `<div class="modal ${opts.cls || ''}" role="dialog" aria-modal="true">
      <button class="modal-x" data-close aria-label="Fechar">×</button>${html}</div>`;
    root.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add('in'));
    const close = () => {
      wrap.classList.remove('in');
      setTimeout(() => wrap.remove(), 200);
      if (opts.onClose) opts.onClose();
    };
    wrap.addEventListener('mousedown', (e) => {
      if (e.target === wrap && !opts.sticky) close();
    });
    wrap.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) close();
    });
    return { el: wrap.firstElementChild, close };
  };

  Q.confirm = (msg, okLabel = 'Confirmar') =>
    new Promise((resolve) => {
      const m = Q.modal(
        `<h3>Confirmar</h3><p>${Q.esc(msg)}</p>
         <div class="row end gap"><button class="btn ghost" data-close>Cancelar</button>
         <button class="btn danger" data-ok>${Q.esc(okLabel)}</button></div>`,
        { cls: 'small', onClose: () => resolve(false) }
      );
      m.el.querySelector('[data-ok]').addEventListener('click', () => {
        resolve(true);
        m.close();
      });
    });

  Q.download = (filename, text, type = 'application/json') => {
    const blob = new Blob([text], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 500);
  };

  Q.copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try {
        ok = document.execCommand('copy');
      } catch (_) {}
      ta.remove();
      return ok;
    }
  };

  Q.readFileText = (file) =>
    new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = rej;
      r.readAsText(file);
    });

  Q.blobToDataURL = (blob) =>
    new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = rej;
      r.readAsDataURL(blob);
    });

  Q.dataURLToBlob = (url) => {
    const [head, b64] = url.split(',');
    const type = (head.match(/data:([^;]+)/) || [])[1] || 'application/octet-stream';
    const bin = atob(b64);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return new Blob([u8], { type });
  };

  /** Cor (hsl) de um valor 0..1: vermelho → âmbar → verde */
  Q.scoreColor = (v) => {
    const h = Math.round(Q.clamp(v, 0, 1) * 135); // 0 = vermelho, 135 = verde
    return `hsl(${h} 72% 52%)`;
  };
})();
