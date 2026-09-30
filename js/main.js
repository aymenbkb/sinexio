/* =========================================================================
   SINEXIO — motion
   GSAP 3.13 + ScrollTrigger + ScrollSmoother (all free since 3.13).
   Motion is mostly scroll-linked rather than fire-once, so it responds to
   what the visitor does instead of performing at them.

   Reduced motion is handled by never creating the animation at all, rather
   than by animating quickly: nothing is ever hidden waiting for a tween.
   ========================================================================= */

gsap.registerPlugin(ScrollTrigger, ScrollSmoother);

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Keep the phone preview at the desktop proportions, including its height.
   Set this before scroll measurements; zoom leaves GSAP's reveal transform free. */
const dashboardStage = document.querySelector('.cockpit-stage');
if (dashboardStage) {
  let lastDashboardWidth = 0;
  const fitDashboard = () => {
    const width = dashboardStage.getBoundingClientRect().width;
    if (!width || width === lastDashboardWidth) return;
    lastDashboardWidth = width;
    dashboardStage.style.setProperty('--dashboard-scale', Math.min(1, width / 1160));
  };
  fitDashboard();
  new ResizeObserver(fitDashboard).observe(dashboardStage);
}

/* Decorative reveal. Returns null — and leaves the element exactly as the
   stylesheet drew it — when the visitor asked for reduced motion. */
function reveal(targets, vars) {
  if (REDUCED) return null;
  return gsap.from(targets, vars);
}

/* -------------------------------------------------------------------------
   1. Smooth scrolling
   ---------------------------------------------------------------------- */
let smoother = null;

if (!REDUCED) {
  smoother = ScrollSmoother.create({
    wrapper: '#smooth-wrapper',
    content: '#smooth-content',
    smooth: 1.15,          // seconds to catch up to the native scroll position
    effects: true,         // enables data-speed / data-lag parallax
    smoothTouch: false,    // native momentum feels better on touch
    normalizeScroll: false,
    ignoreMobileResize: true
  });
}

/* anchors have to go through the smoother, not the browser */
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', e => {
    const id = link.getAttribute('href');
    if (id === '#' || id.length < 2) return;
    const target = document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    closeDrawer();
    if (smoother) smoother.scrollTo(target, true, 'top 84px');
    else target.scrollIntoView({ behavior: 'auto' });
  });
});

/* -------------------------------------------------------------------------
   2. Nav — hide on downward scroll, reveal on upward scroll
   ---------------------------------------------------------------------- */
const nav = document.querySelector('.nav');
let navLastY = window.scrollY;
let navTravel = 0;

function showNav() {
  nav.classList.remove('nav-hidden');
  navTravel = 0;
}

nav.addEventListener('focusin', showNav);

ScrollTrigger.create({
  start: 0,
  end: 'max',
  onUpdate: self => {
    const y = Math.max(0, Math.min(self.scroll(), self.end));
    const delta = y - navLastY;
    navLastY = y;
    nav.classList.toggle('shrunk', y > 80);
    if (y <= 80 || document.body.classList.contains('drawer-open') || nav.querySelector(':focus-visible')) {
      showNav();
      return;
    }
    // Accumulate movement in one direction to ignore tiny trackpad jitters.
    if (Math.sign(delta) !== Math.sign(navTravel)) navTravel = 0;
    navTravel += delta;
    if (Math.abs(navTravel) >= 10) {
      nav.classList.toggle('nav-hidden', navTravel > 0);
      navTravel = 0;
    }
  }
});

/* the bar sits on white between the hero and the closing block */
ScrollTrigger.create({
  trigger: '.intro',
  start: 'top 84px',
  endTrigger: '.closing',
  end: 'top 84px',
  onToggle: self => nav.classList.toggle('on-light', self.isActive)
});

gsap.to('.progress i', {
  scaleX: 1, ease: 'none',
  scrollTrigger: { start: 0, end: 'max', scrub: .3 }
});

/* -------------------------------------------------------------------------
   3. Mobile drawer
   ---------------------------------------------------------------------- */
const burger = document.getElementById('burger');
const drawer = document.getElementById('drawer');
let drawerTween;

function openDrawer() {
  showNav();
  drawer.hidden = false;
  document.body.classList.add('drawer-open');
  burger.setAttribute('aria-expanded', 'true');
  burger.setAttribute('aria-label', 'Fermer le menu');
  if (smoother) smoother.paused(true);

  drawerTween = gsap.timeline()
    .to(drawer, { opacity: 1, duration: REDUCED ? .01 : .3, ease: 'power2.out' });

  if (!REDUCED) {
    drawerTween.from(drawer.querySelectorAll('a'),
      { y: 22, opacity: 0, duration: .45, stagger: .055, ease: 'power3.out' }, '-=.15');
  }
}

function closeDrawer() {
  if (drawer.hidden) return;
  document.body.classList.remove('drawer-open');
  burger.setAttribute('aria-expanded', 'false');
  burger.setAttribute('aria-label', 'Ouvrir le menu');
  if (drawerTween) drawerTween.kill();
  gsap.to(drawer, {
    opacity: 0, duration: REDUCED ? .01 : .25, ease: 'power2.in',
    onComplete: () => { drawer.hidden = true; if (smoother) smoother.paused(false); }
  });
}

burger.addEventListener('click', () => drawer.hidden ? openDrawer() : closeDrawer());
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });

/* -------------------------------------------------------------------------
   4. Hero — the one orchestrated, non-interactive moment on the page
   ---------------------------------------------------------------------- */
if (!REDUCED) {
  gsap.timeline({ defaults: { ease: 'power4.out' } })
    .from('.hero-media img', { scale: 1.14, duration: 2.2, ease: 'power2.out' }, 0)
    .from('.nav', { opacity: 0, duration: .9 }, .1)
    .from('.eyebrow', { y: 20, opacity: 0, duration: .7 }, .35)
    .from('.hero-title .line > span', { yPercent: 112, duration: 1.15, stagger: .085 }, .45)
    .from('.hero-lede', { y: 24, opacity: 0, duration: .8 }, '-=.75')
    .from('.hero-actions .btn', { y: 20, opacity: 0, duration: .7, stagger: .09 }, '-=.6')
    .from('.cue', { opacity: 0, duration: .7 }, '-=.4');

  gsap.to('.hero-inner', {
    y: -90, opacity: 0, ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom 40%', scrub: .6 }
  });
  gsap.to('.hero-media img', {
    yPercent: 12, ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: .6 }
  });
  gsap.to('.cue', {
    opacity: 0, ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: '30% top', scrub: .5 }
  });
}

/* -------------------------------------------------------------------------
   5. Section copy — one shared, quiet reveal
   ---------------------------------------------------------------------- */
gsap.utils.toArray('.chain-head, .feature-copy, .contact-copy').forEach(block => {
  reveal(block.children, {
    y: 30, opacity: 0, duration: .85, stagger: .07, ease: 'power3.out',
    scrollTrigger: { trigger: block, start: 'top 82%', once: true }
  });
});

reveal('.origin', {
  y: 26, opacity: 0, duration: .9, ease: 'power3.out',
  scrollTrigger: { trigger: '.origin', start: 'top 86%', once: true }
});

/* -------------------------------------------------------------------------
   6. Numbers that count up when they arrive
   ---------------------------------------------------------------------- */
function countUp(el) {
  const end = parseFloat(el.dataset.count);
  const dec = parseInt(el.dataset.dec || 0, 10);
  const pad = parseInt(el.dataset.pad || 0, 10);
  const pre = el.dataset.prefix || '';
  const suf = el.dataset.suffix || '';
  const group = el.dataset.group === '1';

  const format = v => {
    let s = v.toFixed(dec).replace('.', ',');           // French decimal comma
    if (pad) {
      const [int, frac] = s.split(',');
      s = int.padStart(pad, '0') + (frac ? ',' + frac : '');
    }
    if (group) s = s.replace(/\B(?=(\d{3})+(?!\d))/g, '\u202F');   // 28 460
    return pre + s + suf;
  };

  if (REDUCED) { el.textContent = format(end); return; }

  const counter = { v: 0 };
  gsap.to(counter, {
    v: end, duration: 1.7, ease: 'power2.out',
    onUpdate: () => { el.textContent = format(counter.v); }
  });
}

gsap.utils.toArray('[data-count]').forEach(el => {
  if (REDUCED) { countUp(el); return; }
  ScrollTrigger.create({ trigger: el, start: 'top 88%', once: true, onEnter: () => countUp(el) });
});

/* -------------------------------------------------------------------------
   7. The product — dashboard rises, routes draw, pins drop
   ---------------------------------------------------------------------- */
reveal('.dashboard', {
  y: 90, opacity: 0, rotateX: 8, transformPerspective: 1500, transformOrigin: '50% 100%',
  duration: 1.25, ease: 'power3.out',
  scrollTrigger: { trigger: '.cockpit-stage', start: 'top 80%', once: true }
});

reveal('.crm-row1 .crm-card, .crm-stat', {
  y: 20, opacity: 0, duration: .6, stagger: .06, ease: 'power3.out',
  scrollTrigger: { trigger: '.cockpit-stage', start: 'top 68%', once: true }
});

/* every orange route on the page draws itself into view */
if (!REDUCED) {
  gsap.utils.toArray('.route-line').forEach(path => {
    const len = path.getTotalLength();
    gsap.set(path, { strokeDasharray: len, strokeDashoffset: len });
    gsap.to(path, {
      strokeDashoffset: 0, duration: 1.6, ease: 'power2.inOut',
      scrollTrigger: { trigger: path.closest('section'), start: 'top 62%', once: true }
    });
  });
}

gsap.utils.toArray('.route-map, .agenda-map, .phone-map').forEach(map => {
  reveal(map.querySelectorAll('.pin'), {
    scale: 0, duration: .5, stagger: .12, ease: 'back.out(2)',
    scrollTrigger: { trigger: map, start: 'top 80%', once: true }
  });
});

/* -------------------------------------------------------------------------
   8. "La chaîne" — the steps move sideways while the section is pinned.
      Wide screens with motion allowed only; everywhere else it is a rail.
   ---------------------------------------------------------------------- */
/* The workflow stays pinned on desktop, but the tighter cards reduce the
   vertical travel needed to reveal the complete horizontal journey. */
const mm = gsap.matchMedia();

/* Once the orange panel is on screen the rail is no longer a progress bar —
   it is that panel's top edge — so it stops tracking and stays complete. */
let railLocked = false;

mm.add('(min-width: 761px) and (prefers-reduced-motion: no-preference)', () => {
  const viewport = document.querySelector('.chain-viewport');
  const track = document.querySelector('.chain-track');
  if (!viewport || !track) return;

  const distance = () => Math.max(0, track.scrollWidth - viewport.clientWidth);

  const horizontal = gsap.to(track, {
    x: () => -distance(),
    ease: 'none',
    scrollTrigger: {
      trigger: '.chain',
      start: 'top top',
      end: () => '+=' + (distance() + window.innerHeight * .28),
      pin: true,
      scrub: .7,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: self => gsap.set('.chain-rail i', { scaleX: self.progress })
    }
  });

  gsap.utils.toArray('.step').forEach(step => {
    gsap.from(step, {
      y: 28, opacity: 0, duration: .55, ease: 'power3.out',
      scrollTrigger: { trigger: step, containerAnimation: horizontal, start: 'left 96%', once: true }
    });
  });

  return () => horizontal.scrollTrigger && horizontal.scrollTrigger.kill();
});

/* Touch and reduced-motion users keep a native horizontal rail. */
mm.add('(max-width: 760px), (prefers-reduced-motion: reduce)', () => {
  const viewport = document.querySelector('.chain-viewport');
  const rail = document.querySelector('.chain-rail i');
  if (!viewport || !rail) return;
  const sync = () => {
    if (railLocked) return;
    const max = viewport.scrollWidth - viewport.clientWidth;
    gsap.set(rail, { scaleX: max > 0 ? viewport.scrollLeft / max : 1 });
  };
  viewport.addEventListener('scroll', sync, { passive: true });
  sync();
  return () => viewport.removeEventListener('scroll', sync);
});

/* -------------------------------------------------------------------------
   9. What Sinexio replaces
   ---------------------------------------------------------------------- */
/* The rail doubles as this panel's top edge, so it has to be whole by the
   time the panel arrives — otherwise the edge shows as a grey stub. */
function fillRail() {
  railLocked = true;
  if (REDUCED) gsap.set('.chain-rail i', { scaleX: 1 });
  else gsap.to('.chain-rail i', { scaleX: 1, duration: .45, ease: 'power2.out', overwrite: 'auto' });
}

ScrollTrigger.create({
  trigger: '.replace-band',
  start: 'top 96%',
  end: 'bottom top',
  onEnter: fillRail,
  onEnterBack: fillRail,
  /* covers a load that already starts at or below the panel (deep link,
     refresh mid-page), where onEnter never fires */
  onRefresh: self => { if (self.progress > 0) fillRail(); },
  onLeaveBack: () => { railLocked = false; }
});

if (!REDUCED) {
  const connectionPaths = gsap.utils.toArray('.connection-path');
  connectionPaths.forEach(path => {
    const length = path.getTotalLength();
    gsap.set(path, { strokeDasharray: length, strokeDashoffset: length });
  });

  gsap.timeline({ scrollTrigger: { trigger: '.replace', start: 'top 80%', once: true } })
    .from('.replace-new', { scale: .72, opacity: 0, duration: .72, ease: 'back.out(1.8)' })
    .from('.old-chip', { y: 16, opacity: 0, duration: .5, stagger: .06, ease: 'power3.out' }, '+=.16')
    .to(connectionPaths, { strokeDashoffset: 0, duration: .8, stagger: .1, ease: 'power2.inOut' }, '-=.12');
}

/* -------------------------------------------------------------------------
   10. Feature UI — the mockups settle into place
   ---------------------------------------------------------------------- */
gsap.utils.toArray('.ui-card').forEach(card => {
  reveal(card, {
    y: 52, opacity: 0, duration: 1, ease: 'power3.out',
    scrollTrigger: { trigger: card, start: 'top 86%', once: true }
  });
});

reveal('.slots li', {
  x: -20, opacity: 0, duration: .55, stagger: .09, ease: 'power3.out',
  scrollTrigger: { trigger: '.slots', start: 'top 86%', once: true }
});

reveal('.phone-photo-stage', {
  y: 72, opacity: 0, rotate: 4, duration: 1.1, ease: 'power4.out',
  scrollTrigger: { trigger: '.phone-photo-stage', start: 'top 88%', once: true }
});

reveal('.report-photo-stage', {
  y: 58, opacity: 0, rotate: -2, duration: 1.05, ease: 'power4.out',
  scrollTrigger: { trigger: '.report-photo-stage', start: 'top 86%', once: true }
});

gsap.utils.toArray('.chip').forEach(chip => {
  reveal(chip, {
    scale: .7, opacity: 0, duration: .65, ease: 'back.out(1.8)',
    scrollTrigger: { trigger: chip, start: 'top 94%', once: true }
  });
});

reveal('.ticks li', {
  x: -18, opacity: 0, duration: .6, stagger: .1, ease: 'power3.out',
  scrollTrigger: { trigger: '.ticks', start: 'top 88%', once: true }
});

/* -------------------------------------------------------------------------
   12. Closing
   ---------------------------------------------------------------------- */
reveal('.closing-title .line > span', {
  yPercent: 110, duration: 1.1, stagger: .1, ease: 'power4.out',
  scrollTrigger: { trigger: '.closing', start: 'top 62%', once: true }
});

if (!REDUCED) {
  gsap.fromTo('.closing-inner', { scale: .95 }, {
    scale: 1, ease: 'none',
    scrollTrigger: { trigger: '.closing', start: 'top bottom', end: 'center center', scrub: .8 }
  });
}

/* -------------------------------------------------------------------------
   13. Magnetic buttons
   ---------------------------------------------------------------------- */
if (!REDUCED && window.matchMedia('(pointer: fine)').matches) {
  document.querySelectorAll('.magnetic').forEach(el => {
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      gsap.to(el, {
        x: (e.clientX - r.left - r.width / 2) * .22,
        y: (e.clientY - r.top - r.height / 2) * .3,
        duration: .4, ease: 'power3.out'
      });
    });
    el.addEventListener('pointerleave', () => {
      gsap.to(el, { x: 0, y: 0, duration: .7, ease: 'elastic.out(1,.45)' });
    });
  });
}

/* -------------------------------------------------------------------------
   14. Demo form
   ---------------------------------------------------------------------- */
const form = document.querySelector('.form');

// Remove literal and percent-encoded CR/LF sequences before any form data is
// dispatched. The server applies the same rule; client-side checks are UX only.
function sanitizeFormValue(value) {
  return value.replace(/(?:\r|\n|%0a|%0d)/gi, '').trim();
}

function sanitizeDemoForm(formElement) {
  formElement.querySelectorAll('input[type="text"], input[type="email"]').forEach(input => {
    input.value = sanitizeFormValue(input.value);
  });
}

let demoFormSubmitting = false;

form?.addEventListener('submit', async e => {
  e.preventDefault();
  const note = form.querySelector('.form-note');
  const button = form.querySelector('.submit');
  if (demoFormSubmitting) return;

  sanitizeDemoForm(form);
  if (!form.reportValidity()) return;

  demoFormSubmitting = true;
  button.disabled = true;
  button.setAttribute('aria-disabled', 'true');
  button.textContent = 'Envoi en cours…';
  note.style.color = '';
  note.textContent = '';

  try {
    const formData = new FormData(form);
    const response = await fetch('/', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'Accept': 'application/json'
      },
      body: new URLSearchParams(formData).toString()
    });
    if (!response.ok) throw new Error('Envoi impossible. Réessayez dans quelques instants.');

    button.textContent = 'Demande envoyée';
    button.style.background = '#55D6A0';
    note.textContent = 'Nous revenons vers vous sous 24 h ouvrées.';
    if (!REDUCED) gsap.fromTo(button, { scale: .96 }, { scale: 1, duration: .6, ease: 'elastic.out(1,.5)' });
  } catch (error) {
    demoFormSubmitting = false;
    button.disabled = false;
    button.removeAttribute('aria-disabled');
    button.textContent = 'Réserver ma démo';
    note.style.color = '#FF8B72';
    note.textContent = 'Envoi impossible. Réessayez dans quelques instants.';
  }
});

/* -------------------------------------------------------------------------
   15. Keep trigger positions honest once images and fonts have landed
   ---------------------------------------------------------------------- */
window.addEventListener('load', () => ScrollTrigger.refresh());
if (document.fonts) document.fonts.ready.then(() => ScrollTrigger.refresh());
