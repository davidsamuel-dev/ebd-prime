/**
 * Modo apresentação: scroll com snap + animações ao entrar no slide.
 */
(() => {
  const SNAP_MS = 720;
  const WHEEL_THRESHOLD = 20;
  const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const REVEAL_SELECTORS = [
    '.slide-inner > .tag',
    '.slide-header',
    '.slide-inner > h3',
    '.slide-inner > .lead',
    '.slide-inner > .subtitle',
    '.slide-inner > .subtitle-lg',
    '.slide-inner > .cover-top',
    '.slide-inner > .cover-meta',
    '.slide-inner > .footer-url',
    '.slide-inner > .flowchart-legend',
    '.slide-inner > .flowchart-body',
    '.slide-inner > .flowchart-foot',
    '.slide-inner > .arch-flow',
    '.slide-inner > .screen-layout',
    '.slide-inner > table',
    '.slide-inner > .code-block',
    '.slide-inner > .two-col-content',
    '.slide-inner > .stat-row',
    '.slide-inner > .timing',
    '.grid-2 > *',
    '.grid-3 > *',
    '.bullets > li',
    '.card',
    '.arch-box',
    '.flow-lane',
    '.flow-bridge',
    '.cover-meta > div',
    '.stat-row .stat',
    '.context-visuals',
    '.context-figure',
    '.solution-header-row',
    '.solution-cards > *',
    '.qr-grid > *',
    '.deploy-flow',
    '.deploy-cards > *',
    '.deploy-bullets > li',
  ];

  function prepareSlide(slide) {
    const inner = slide.querySelector('.slide-inner');
    if (!inner) return;

    inner.querySelectorAll('h1, h2').forEach((el) => {
      if (el.classList.contains('typewriter-target')) return;
      const text = el.textContent.trim();
      el.dataset.typeText = text;
      el.classList.add('typewriter-target');
      if (!REDUCED_MOTION) el.textContent = '';
    });

    let step = 0;
    REVEAL_SELECTORS.forEach((selector) => {
      inner.querySelectorAll(selector).forEach((el) => {
        if (el.classList.contains('reveal')) return;
        if (el.closest('.typewriter-target')) return;
        el.classList.add('reveal');
        el.style.setProperty('--reveal-delay', `${step * 0.08}s`);
        step += 1;
      });
    });
  }

  function clearSlideTimers(slide) {
    if (slide._animTimers) {
      slide._animTimers.forEach((id) => window.clearTimeout(id));
      slide._animTimers = [];
    }
  }

  function resetSlide(slide) {
    clearSlideTimers(slide);
    slide.classList.remove('is-active');
    slide.querySelectorAll('.reveal').forEach((el) => el.classList.remove('is-visible'));
    slide.querySelectorAll('.typewriter-target').forEach((el) => {
      el.classList.remove('is-typing', 'is-done');
      if (REDUCED_MOTION) {
        el.textContent = el.dataset.typeText || '';
      } else {
        el.textContent = '';
      }
    });
  }

  function typewrite(el, text, speed = 26) {
    return new Promise((resolve) => {
      if (!text) {
        resolve();
        return;
      }
      el.classList.add('is-typing');
      el.classList.remove('is-done');
      let i = 0;

      const tick = () => {
        const slide = el.closest('.slide');
        if (!slide?.classList.contains('is-active')) {
          el.classList.remove('is-typing');
          resolve();
          return;
        }
        el.textContent = text.slice(0, i);
        i += 1;
        if (i <= text.length) {
          window.setTimeout(tick, speed);
        } else {
          el.classList.remove('is-typing');
          el.classList.add('is-done');
          resolve();
        }
      };

      tick();
    });
  }

  function playSlideAnimations(slide) {
    clearSlideTimers(slide);
    slide.classList.add('is-active');
    const timers = [];
    slide._animTimers = timers;

    if (REDUCED_MOTION) {
      slide.querySelectorAll('.typewriter-target').forEach((el) => {
        el.textContent = el.dataset.typeText || '';
      });
      slide.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible'));
      return;
    }

    timers.push(
      window.setTimeout(() => {
        slide
          .querySelectorAll('.tag.reveal, .slide-header.reveal')
          .forEach((el) => el.classList.add('is-visible'));
      }, 80),
    );

    const titles = [...slide.querySelectorAll('.typewriter-target')];
    titles.forEach((el, idx) => {
      timers.push(
        window.setTimeout(() => {
          const speed = el.matches('h1') ? 30 : 22;
          void typewrite(el, el.dataset.typeText || '', speed);
        }, 220 + idx * 350),
      );
    });

    timers.push(
      window.setTimeout(() => {
        slide.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible'));
      }, 520),
    );
  }

  function init() {
    const deck = document.querySelector('.deck');
    if (!deck) return;

    const slides = [...deck.querySelectorAll(':scope > section.slide')];
    if (!slides.length) return;

    slides.forEach((slide) => {
      const viewport = document.createElement('div');
      viewport.className = 'slide-viewport';
      slide.parentNode.insertBefore(viewport, slide);
      viewport.appendChild(slide);
      prepareSlide(slide);
    });

    const viewports = [...document.querySelectorAll('.slide-viewport')];
    document.documentElement.classList.add('present-mode');
    document.body.classList.add('present-mode');

    let current = 0;
    let locked = false;
    let activeSlide = null;

    const progress = document.createElement('div');
    progress.className = 'present-progress';
    progress.setAttribute('aria-live', 'polite');
    document.body.appendChild(progress);

    const hint = document.createElement('div');
    hint.className = 'present-hint';
    hint.textContent = 'Scroll · ↑↓ · Espaço';
    document.body.appendChild(hint);

    function updateProgress() {
      progress.textContent = `${String(current + 1).padStart(2, '0')} / ${String(viewports.length).padStart(2, '0')}`;
    }

    function setActiveSlide(index) {
      const slide = slides[index];
      if (!slide || slide === activeSlide) return;
      if (activeSlide) resetSlide(activeSlide);
      activeSlide = slide;
      playSlideAnimations(slide);
    }

    function goTo(index, instant = false) {
      const next = Math.max(0, Math.min(viewports.length - 1, index));
      current = next;
      viewports[next].scrollIntoView({
        behavior: instant ? 'auto' : 'smooth',
        block: 'center',
      });
      setActiveSlide(next);
      updateProgress();
    }

    const observer = new IntersectionObserver(
      (entries) => {
        let best = null;
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (!best || entry.intersectionRatio > best.ratio) {
              best = { el: entry.target, ratio: entry.intersectionRatio };
            }
          }
        });
        if (best) {
          const idx = viewports.indexOf(best.el);
          if (idx >= 0 && idx !== current) {
            current = idx;
            setActiveSlide(idx);
            updateProgress();
          }
        }
      },
      { threshold: [0.35, 0.55, 0.75] },
    );
    viewports.forEach((vp) => observer.observe(vp));

    function onStep(direction) {
      if (locked) return;
      const next = current + direction;
      if (next < 0 || next >= viewports.length) return;
      locked = true;
      goTo(next);
      window.setTimeout(() => {
        locked = false;
      }, SNAP_MS);
    }

    window.addEventListener(
      'wheel',
      (e) => {
        if (Math.abs(e.deltaY) < WHEEL_THRESHOLD) return;
        e.preventDefault();
        onStep(e.deltaY > 0 ? 1 : -1);
      },
      { passive: false },
    );

    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        onStep(1);
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        onStep(-1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        locked = false;
        goTo(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        locked = false;
        goTo(viewports.length - 1);
      }
    });

    window.setTimeout(() => hint.classList.add('is-hidden'), 4500);

    updateProgress();
    goTo(0, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
