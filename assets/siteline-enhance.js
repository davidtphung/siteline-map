/** Siteline enhance loader (Observe|GIS). Parts: OIM+HIFLD/EIA click inspect. */
const PARTS = ["siteline-enhance.part0.txt", "siteline-enhance.part1.txt", "siteline-enhance.part2.txt", "siteline-enhance.part3.txt"];
(async () => {
  try {
    const base = new URL('.', import.meta.url);
    const texts = await Promise.all(PARTS.map((p) => fetch(new URL(p, base)).then((r) => {
      if (!r.ok) throw new Error(p + ' ' + r.status);
      return r.text();
    })));
    const s = document.createElement('script');
    s.textContent = texts.join('');
    document.head.appendChild(s);
  } catch (e) { console.warn('[siteline-enhance] loader failed', e); }
})();
