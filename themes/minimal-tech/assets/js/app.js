// app.js — small enhancements: theme toggle, code-block copy, TOC scroll-spy.

(function () {
  // ── Theme toggle ────────────────────────────────────────────────────────
  const root = document.documentElement;
  const btn = document.querySelector('[data-theme-toggle]');
  const label = document.querySelector('[data-theme-label]');

  function setLabel() {
    if (label) label.textContent = root.dataset.theme === 'dark' ? 'dark' : 'light';
  }
  setLabel();

  if (btn) {
    btn.addEventListener('click', () => {
      const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      try { localStorage.setItem('theme', next); } catch (e) {}
      setLabel();
    });
  }

  // ── Copy buttons on Hugo/Chroma code blocks ─────────────────────────────
  // Hugo emits `<pre class="chroma">…</pre>` (or wrapped in a div).
  document.querySelectorAll('pre.chroma, .highlight pre').forEach((pre) => {
    if (pre.dataset.copyAdded) return;
    pre.dataset.copyAdded = '1';

    const wrapper = document.createElement('div');
    wrapper.className = 'code';
    pre.parentNode.insertBefore(wrapper, pre);

    const head = document.createElement('div');
    head.className = 'code__head';

    const langSpan = document.createElement('span');
    langSpan.className = 'code__lang';
    const codeEl = pre.querySelector('code');
    let lang = 'code';
    if (codeEl) {
      const m = (codeEl.className || '').match(/language-(\w+)/);
      if (m) lang = m[1];
    }
    langSpan.textContent = lang;

    const copyBtn = document.createElement('button');
    copyBtn.className = 'code__copy';
    copyBtn.type = 'button';
    copyBtn.textContent = 'copy';
    copyBtn.addEventListener('click', () => {
      const text = pre.innerText;
      navigator.clipboard?.writeText(text);
      copyBtn.textContent = '✓ copied';
      setTimeout(() => { copyBtn.textContent = 'copy'; }, 1400);
    });

    head.appendChild(langSpan);
    head.appendChild(copyBtn);
    wrapper.appendChild(head);
    wrapper.appendChild(pre);
  });

  // ── TOC scroll-spy ─────────────────────────────────────────────────────
  const toc = document.querySelector('[data-toc]');
  if (toc) {
    const links = toc.querySelectorAll('a[href^="#"]');
    if (links.length) {
      const targets = [...links].map((a) => {
        const id = decodeURIComponent(a.getAttribute('href').slice(1));
        return { a, el: document.getElementById(id) };
      }).filter((x) => x.el);

      const onScroll = () => {
        let active = targets[0];
        for (const t of targets) {
          if (t.el.getBoundingClientRect().top < 140) active = t;
        }
        targets.forEach((t) => t.a.parentElement?.classList.toggle('is-active', t === active));
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }
  }
})();
