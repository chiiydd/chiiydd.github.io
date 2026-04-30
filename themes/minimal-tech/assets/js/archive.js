// archive.js — client-side fuzzy search over title + tags on /archive/.
// Hydrates [data-archive-row] entries; no external deps.

(function () {
  const input = document.querySelector('[data-archive-input]');
  if (!input) return;

  const list = document.querySelector('[data-archive-list]');
  const sub = document.querySelector('[data-archive-sub]');
  const empty = document.querySelector('[data-archive-empty]');
  const emptyQ = document.querySelector('[data-archive-empty-q]');
  const clearBtn = document.querySelector('[data-archive-clear]');

  const rows = [...document.querySelectorAll('[data-archive-row]')].map((el) => ({
    el,
    title: el.dataset.title || '',
    tags: (el.dataset.tags || '').split(',').map((s) => s.trim()).filter(Boolean),
    titleSpan: el.querySelector('[data-archive-title]'),
    tagsSpan: el.querySelector('[data-archive-tags]'),
    originalTitle: null,
  }));

  // Cache the original title HTML so we can restore it.
  rows.forEach((r) => { r.originalTitle = r.titleSpan.innerHTML; });

  const totalCount = rows.length;
  const baseSubText = sub.textContent;

  // Subsequence fuzzy match. Returns null on miss, else { score, indices }.
  function fuzzy(q, s) {
    if (!q) return { score: 0, indices: [] };
    const ql = q.toLowerCase();
    const sl = s.toLowerCase();
    let qi = 0, firstHit = -1, lastHit = -1;
    const idx = [];
    for (let si = 0; si < sl.length && qi < ql.length; si++) {
      if (sl[si] === ql[qi]) {
        if (firstHit < 0) firstHit = si;
        lastHit = si;
        idx.push(si);
        qi++;
      }
    }
    if (qi < ql.length) return null;
    return { score: (lastHit - firstHit) + firstHit * 0.5, indices: idx };
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  function highlight(text, indices) {
    if (!indices || !indices.length) return escapeHtml(text);
    const set = new Set(indices);
    let out = '';
    for (let i = 0; i < text.length; i++) {
      const ch = escapeHtml(text[i]);
      out += set.has(i) ? `<mark class="hl">${ch}</mark>` : ch;
    }
    return out;
  }

  function render(q) {
    const trimmed = q.trim();
    let visible = 0;

    rows.forEach((r) => {
      if (!trimmed) {
        r.el.hidden = false;
        // Restore original anchor + title (no highlights).
        r.titleSpan.innerHTML = r.originalTitle;
        r.tagsSpan.hidden = true;
        r.tagsSpan.innerHTML = '';
        visible++;
        return;
      }

      const titleHit = fuzzy(trimmed, r.title);
      const tagHits = r.tags
        .map((t) => ({ tag: t, hit: fuzzy(trimmed, t) }))
        .filter((x) => x.hit);

      if (!titleHit && !tagHits.length) {
        r.el.hidden = true;
        return;
      }

      visible++;
      r.el.hidden = false;

      // Render title with anchor + highlights
      const href = r.el.dataset.href;
      const titleHtml = titleHit
        ? highlight(r.title, titleHit.indices)
        : escapeHtml(r.title);
      r.titleSpan.innerHTML = `<a href="${href}">${titleHtml}</a>`;

      // Render matched tags
      if (tagHits.length) {
        r.tagsSpan.hidden = false;
        r.tagsSpan.innerHTML = tagHits
          .map(({ tag, hit }) => `<span class="tag tag--hit">#${highlight(tag, hit.indices)}</span>`)
          .join('');
      } else {
        r.tagsSpan.hidden = true;
        r.tagsSpan.innerHTML = '';
      }

      // Stash score for sorting
      const titleScore = titleHit ? titleHit.score : Infinity;
      const tagScore = tagHits.length ? Math.min(...tagHits.map((x) => x.hit.score)) + 2 : Infinity;
      r.el.dataset.score = String(Math.min(titleScore, tagScore));
    });

    // Update year-section visibility + counts
    document.querySelectorAll('[data-year]').forEach((sec) => {
      const visibleRows = sec.querySelectorAll('[data-archive-row]:not([hidden])');
      sec.hidden = visibleRows.length === 0;
      const count = sec.querySelector('[data-year-count]');
      if (count) count.textContent = visibleRows.length;

      // When searching, sort visible rows by score
      if (trimmed && visibleRows.length > 1) {
        const ul = sec.querySelector('ul');
        const sorted = [...visibleRows].sort(
          (a, b) => parseFloat(a.dataset.score || '0') - parseFloat(b.dataset.score || '0')
        );
        sorted.forEach((r) => ul.appendChild(r));
      }
    });

    // Subtitle + empty state
    if (trimmed) {
      sub.textContent = `${visible} match${visible === 1 ? '' : 'es'} for "${trimmed}"`;
      empty.hidden = visible !== 0;
      if (emptyQ) emptyQ.textContent = trimmed;
      list.hidden = visible === 0;
    } else {
      sub.textContent = baseSubText;
      empty.hidden = true;
      list.hidden = false;
    }

    if (clearBtn) clearBtn.hidden = !trimmed;
  }

  input.addEventListener('input', (e) => render(e.target.value));
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      input.value = '';
      input.focus();
      render('');
    });
  }

  // Allow ?q=... deep links
  const urlQ = new URLSearchParams(location.search).get('q');
  if (urlQ) {
    input.value = urlQ;
    render(urlQ);
  }
})();
