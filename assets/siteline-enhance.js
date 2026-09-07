/** Siteline enhance base64 loader (instrument tray). */
const PARTS = ['siteline-enhance.b0.txt', 'siteline-enhance.b1.txt', 'siteline-enhance.b2.txt', 'siteline-enhance.b3.txt', 'siteline-enhance.b4.txt', 'siteline-enhance.b5.txt', 'siteline-enhance.b6.txt', 'siteline-enhance.b7.txt', 'siteline-enhance.b8.txt', 'siteline-enhance.b9.txt', 'siteline-enhance.b10.txt'];
(async () => {
  try {
    const base = new URL('.', import.meta.url);
    const texts = await Promise.all(
      PARTS.map((p) =>
        fetch(new URL(p, base)).then((r) => {
          if (!r.ok) throw new Error(p + ' ' + r.status);
          return r.text();
        }),
      ),
    );
    const b64 = texts.join('').replace(/\s+/g, '');
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const code = new TextDecoder().decode(bytes);
    const s = document.createElement('script');
    s.textContent = code;
    document.head.appendChild(s);
  } catch (e) {
    console.warn('[siteline-enhance] loader failed', e);
  }
})();
