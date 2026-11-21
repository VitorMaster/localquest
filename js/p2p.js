/* Localquest — transporte ponto a ponto (WebRTC) para a Sala presencial.
 * Sem servidor: os aparelhos trocam "códigos" (QR ou texto) uma única vez para se conectar; depois conversam direto
 * pela mesma rede (por exemplo, o ponto de acesso do celular do anfitrião). Formato: anfitrião ⇄ cada participante (estrela). */
(function () {
  const Q = window.Q;
  const P = (Q.P2P = {});

  P.supported = () => typeof RTCPeerConnection !== 'undefined';

  /* ---------- códigos de pareamento (SDP comprimido) ---------- */
  const b64 = (u8) => btoa(String.fromCharCode(...u8)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unb64 = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
  const pipe = async (u8, Stream) => new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(new Stream('deflate-raw'))).arrayBuffer());

  P.encode = async (desc) => {
    const raw = new TextEncoder().encode(JSON.stringify({ t: desc.type, s: desc.sdp }));
    if (typeof CompressionStream !== 'undefined') return 'LQ1.' + b64(await pipe(raw, CompressionStream));
    return 'LQ0.' + b64(raw);
  };
  P.decode = async (code) => {
    const c = String(code).replace(/\s+/g, '');
    const m = c.match(/^LQ([01])\.(.+)$/);
    if (!m) throw new Error('Código inválido. Copie o código inteiro, começando por LQ.');
    let u8 = unb64(m[2]);
    if (m[1] === '1') {
      if (typeof DecompressionStream === 'undefined') throw new Error('Este navegador não consegue ler o código. Use um navegador mais recente.');
      u8 = await pipe(u8, DecompressionStream);
    }
    const o = JSON.parse(new TextDecoder().decode(u8));
    return { type: o.t, sdp: o.s };
  };

  const gathered = (pc, ms = 3500) =>
    new Promise((resolve) => {
      if (pc.iceGatheringState === 'complete') return resolve();
      const done = () => { pc.removeEventListener('icegatheringstatechange', chk); clearTimeout(t); resolve(); };
      const chk = () => pc.iceGatheringState === 'complete' && done();
      const t = setTimeout(done, ms);
      pc.addEventListener('icegatheringstatechange', chk);
    });

  /* ---------- mensagens grandes em pedaços ---------- */
  const CH = 12000;
  const sendBig = (ch, obj) => {
    if (!ch || ch.readyState !== 'open') return false;
    const s = JSON.stringify(obj);
    const id = Math.random().toString(36).slice(2, 8);
    const n = Math.max(1, Math.ceil(s.length / CH));
    for (let i = 0; i < n; i++) ch.send(`${id}|${i}|${n}|${s.slice(i * CH, (i + 1) * CH)}`);
    return true;
  };
  const receiver = (onMsg) => {
    const parts = new Map();
    return (ev) => {
      const m = String(ev.data).match(/^([^|]+)\|(\d+)\|(\d+)\|([\s\S]*)$/);
      if (!m) return;
      const [, id, i, n, body] = m;
      const e = parts.get(id) || { n: +n, got: [], c: 0 };
      if (e.got[+i] == null) { e.got[+i] = body; e.c++; }
      parts.set(id, e);
      if (e.c === e.n) { parts.delete(id); try { onMsg(JSON.parse(e.got.join(''))); } catch (_) {} }
    };
  };

  const newPc = () => new RTCPeerConnection({ iceServers: [] }); // só rede local: não depende de internet

  /* ---------- anfitrião ---------- */
  P.Host = class {
    constructor() { this.peers = new Map(); this.onMessage = () => {}; this.onPeersChange = () => {}; this.onOpen = () => {}; }
    /** Cria um convite (oferta). Retorna { id, code }. */
    async invite() {
      const id = 'p' + Math.random().toString(36).slice(2, 7);
      const pc = newPc();
      const ch = pc.createDataChannel('lq', { ordered: true });
      const peer = { id, pc, ch, open: false, nick: '' };
      this.peers.set(id, peer);
      ch.onmessage = receiver((m) => this.onMessage(id, m));
      ch.onopen = () => { peer.open = true; this.onOpen(id); this.onPeersChange(); };
      const drop = () => { if (peer.open) { peer.open = false; this.onPeersChange(); } };
      ch.onclose = drop;
      pc.onconnectionstatechange = () => { if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) drop(); };
      await pc.setLocalDescription(await pc.createOffer());
      await gathered(pc);
      return { id, code: await P.encode(pc.localDescription) };
    }
    async accept(id, answerCode) {
      const peer = this.peers.get(id);
      if (!peer) throw new Error('Convite expirado. Gere um novo.');
      await peer.pc.setRemoteDescription(await P.decode(answerCode));
    }
    cancel(id) { const p = this.peers.get(id); if (p && !p.open) { try { p.pc.close(); } catch (_) {} this.peers.delete(id); } }
    send(id, msg) { const p = this.peers.get(id); return p ? sendBig(p.ch, msg) : false; }
    broadcast(msg) { this.peers.forEach((p) => p.open && sendBig(p.ch, msg)); }
    connected() { return [...this.peers.values()].filter((p) => p.open).length; }
    close() { this.peers.forEach((p) => { try { p.pc.close(); } catch (_) {} }); this.peers.clear(); }
  };

  /* ---------- participante ---------- */
  P.Guest = class {
    constructor() { this.pc = null; this.ch = null; this.open = false; this.onMessage = () => {}; this.onOpen = () => {}; this.onClose = () => {}; }
    /** Recebe o código do anfitrião e devolve o código de resposta. */
    async join(offerCode) {
      const pc = (this.pc = newPc());
      pc.ondatachannel = (e) => {
        const ch = (this.ch = e.channel);
        ch.onmessage = receiver((m) => this.onMessage(m));
        ch.onopen = () => { this.open = true; this.onOpen(); };
        ch.onclose = () => { this.open = false; this.onClose(); };
      };
      pc.onconnectionstatechange = () => { if (['failed', 'closed', 'disconnected'].includes(pc.connectionState) && this.open) { this.open = false; this.onClose(); } };
      await pc.setRemoteDescription(await P.decode(offerCode));
      await pc.setLocalDescription(await pc.createAnswer());
      await gathered(pc);
      return P.encode(pc.localDescription);
    }
    send(msg) { return sendBig(this.ch, msg); }
    close() { try { this.pc && this.pc.close(); } catch (_) {} }
  };

  /* ---------- QR: gerar e ler ---------- */
  P.qr = (text, canvas, size = 300) => {
    const qr = window.qrcode(0, 'L');
    qr.addData(text);
    qr.make();
    const n = qr.getModuleCount(), cell = Math.max(2, Math.floor(size / (n + 8)));
    const dim = cell * (n + 8);
    canvas.width = canvas.height = dim;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, dim, dim);
    ctx.fillStyle = '#000';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) ctx.fillRect((c + 4) * cell, (r + 4) * cell, cell, cell);
    canvas.style.width = '100%'; canvas.style.maxWidth = size + 'px'; canvas.style.imageRendering = 'pixelated';
  };

  /** Liga a câmera e chama onCode(texto) ao ler um QR. Retorna { stop }. */
  P.scan = async (video, onCode) => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('A câmera só funciona em páginas seguras (https). Use a opção de colar o código.');
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    video.srcObject = stream;
    video.setAttribute('playsinline', 'true');
    await video.play();
    const cv = document.createElement('canvas'), ctx = cv.getContext('2d', { willReadFrequently: true });
    let alive = true;
    const loop = () => {
      if (!alive) return;
      if (video.readyState >= 2 && video.videoWidth) {
        const k = Math.min(1, 640 / video.videoWidth);
        cv.width = Math.round(video.videoWidth * k); cv.height = Math.round(video.videoHeight * k);
        ctx.drawImage(video, 0, 0, cv.width, cv.height);
        const img = ctx.getImageData(0, 0, cv.width, cv.height);
        const res = window.jsQR && window.jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
        if (res && res.data) { alive = false; stream.getTracks().forEach((t) => t.stop()); onCode(res.data); return; }
      }
      setTimeout(loop, 120);
    };
    loop();
    return { stop: () => { alive = false; stream.getTracks().forEach((t) => t.stop()); } };
  };
})();
