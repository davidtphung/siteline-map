/** Siteline enhance gzip+b64 multi-part loader (instrument tray). */
const PARTS = ['siteline-enhance.gz0.txt', 'siteline-enhance.gz1.txt', 'siteline-enhance.gz2.txt', 'siteline-enhance.gz3.txt', 'siteline-enhance.gz4.txt'];
const base = new URL('.', import.meta.url);
const atlas = document.createElement('link');
atlas.rel = 'stylesheet';
atlas.href = new URL('siteline-atlas.css?v=atlas-sheet', base).href;
document.head.appendChild(atlas);
(async () => {
  try {
    const texts = await Promise.all(
      PARTS.map((p) =>
        fetch(new URL(p + '?v=noloop', base)).then((r) => {
          if (!r.ok) throw new Error(p + ' ' + r.status);
          return r.text();
        }),
      ),
    );
    const b64 = texts.join('').replace(/\s+/g, '');
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const stream = new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'));
    const code = await new Response(stream).text();
    const s = document.createElement('script');
    s.textContent = code;
    document.head.appendChild(s);
  } catch (e) {
    console.warn('[siteline-enhance] loader failed', e);
  }
})();
