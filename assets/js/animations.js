/* ══════════════════════════════════════════════════════════════
   CUTELARIA CASTEL — Lenis + GSAP ScrollTrigger
   Reveals curtos, fluidez Igloo-style, sem scrub agressivo.
══════════════════════════════════════════════════════════════ */
gsap.registerPlugin(ScrollTrigger);

/* ── Lenis smooth scroll ── */
var lenis = new Lenis({
  lerp: 0.085,
  smoothWheel: true,
  syncTouch: false,
  wheelMultiplier: 1.0,
  touchMultiplier: 1.0
});
function lenisRaf(time) { lenis.raf(time); requestAnimationFrame(lenisRaf); }
requestAnimationFrame(lenisRaf);
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.lagSmoothing(500, 33);

// Lenis começa parado se o preloader está ativo — destravado por __startHero
if (document.body.classList.contains('preloading')) {
  lenis.stop();
}

/* ── Hero entrance (pausado até preloader liberar) ── */
gsap.set('.scroll-item', { opacity: 0, y: 32 });

// Castelo do hero começa BEM em cima, fora da tela, pra cair
gsap.set('.hero-castle', { opacity: 0, y: -window.innerHeight * 0.8, scale: 1.4, rotation: -4 });

var heroTl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out', duration: 1.2 } });
heroTl
  // Castelo aterrissa com peso — power3.out conforme regra do projeto
  .to('.hero-castle', {
    opacity: 1, y: 0, scale: 1, rotation: 0,
    duration: 1.35, ease: 'power3.out',
    onComplete: function () {
      // flutuação contínua — sine puro (não inOut)
      gsap.to('.hero-castle', {
        y: -22, duration: 3.4, repeat: -1, yoyo: true, ease: 'sine.out'
      });
    }
  }, 0.2)

  .to('.hero-eyebrow',           { opacity: 1, y: 0 }, 0.9)
  .to('.hero-title',             { opacity: 1, y: 0 }, 1.1)
  .to('.hero-subtitle',          { opacity: 1, y: 0 }, 1.3)
  .to('.hero-actions',           { opacity: 1, y: 0 }, 1.5)
  .to('.hero-stats',             { opacity: 1, y: 0 }, 1.7)
  .to('.hero-scroll-indicator',  { opacity: 1     }, 2.0);

// Exposto para o preloader chamar quando os portões abrirem
window.__startHero = function () {
  if (!heroTl.paused()) return; // idempotente — pode ser chamado várias vezes
  lenis.start();
  heroTl.play();
};

// Failsafe: se o preloader não chamou __startHero em 10s, dispara automático
setTimeout(function () {
  if (heroTl.paused()) window.__startHero();
}, 10000);

/* ── Hero parallax suave ── */
gsap.to('.hero-content', {
  yPercent: -15,
  ease: 'none',
  scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.8 }
});

/* ── Hero stage parallax (camadas de fundo) ── */
document.querySelectorAll('.hero .hero-stage[data-parallax]').forEach(function (stage) {
  var depth = parseFloat(stage.getAttribute('data-parallax')) || 0.3;
  gsap.to(stage, {
    yPercent: depth * 100,
    ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
  });
});

/* ── Reveal genérico: ATRELADO AO SCROLL (scrub) ── */
document.querySelectorAll('.scroll-item').forEach(function (el) {
  if (el.closest('.hero')) return;
  if (el.classList.contains('property-card'))    return;
  if (el.classList.contains('region-card'))      return;
  if (el.classList.contains('testimonial-card')) return;
  gsap.fromTo(el,
    { opacity: 0, y: 32 },
    {
      opacity: 1, y: 0, ease: 'none',
      scrollTrigger: {
        trigger: el,
        start: 'top 92%',     // começa a revelar quando entra por baixo
        end: 'top 55%',       // totalmente visível ao subir até ~meia tela
        scrub: true
      }
    }
  );
});

/* ── Card groups com stagger: ATRELADO AO SCROLL (scrub) ──
   Os cards revelam em sequência conforme a roda do mouse rola. */
function staggerGroup(parentSel, itemSel, opts) {
  opts = opts || {};
  var parent = document.querySelector(parentSel);
  if (!parent) return;
  var items = parent.querySelectorAll(itemSel);
  if (!items.length) return;
  gsap.set(items, { opacity: 0, y: opts.y || 30 });
  gsap.to(items, {
    opacity: 1, y: 0, ease: 'none',
    stagger: opts.stagger || 0.4,        // offset maior pra leitura sequencial no scrub
    scrollTrigger: {
      trigger: parent,
      start: opts.start || 'top 88%',
      end: opts.end || 'top 42%',
      scrub: true
    }
  });
}

staggerGroup('.properties-grid',   '.property-card',    { y: 40 });
staggerGroup('.regions-grid',      '.region-card',      { y: 40, start: 'top 90%' });
staggerGroup('.testimonials-grid', '.testimonial-card', { y: 36 });

/* ── Book scene reveal: livro SURGE DA ESQUERDA → DIREITA e para na posição final ── */
(function () {
  var scene = document.querySelector('.book-scene');
  if (!scene) return;
  var book = scene.querySelector('.book');
  var shadow = scene.querySelector('.book-table-shadow');
  var ornaments = scene.querySelectorAll('.book-cover-emblem, .book-cover-title, .book-cover-ornament, .book-cover-frame');
  if (!book) return;

  // estado inicial: livro fora de quadro à ESQUERDA, capa lateralizada e invisível
  gsap.set(book, {
    opacity: 0,
    xPercent: -180,            // fora da tela à esquerda
    scale: 0.72,
    y: 0,
    rotationY: 55,             // capa quase de perfil enquanto desliza
    rotationX: 6,
    rotationZ: -8,
    transformOrigin: '50% 60%'
  });
  if (shadow) gsap.set(shadow, { opacity: 0, scaleX: 0.4, x: -40 });
  if (ornaments.length) gsap.set(ornaments, { opacity: 0, y: 10 });

  // Timeline ATRELADA AO SCROLL: o livro desliza da esquerda → direita
  // conforme a roda do mouse rola, parando na posição final.
  var tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: scene,
      start: 'top 90%',
      end: 'top 35%',
      scrub: true
    }
  });

  // livro desliza da esquerda e gira até a posição final
  tl.to(book, {
    opacity: 1, xPercent: 0, scale: 1, y: 0,
    rotationY: -14, rotationX: 4, rotationZ: -2
  }, 0);

  // sombra acompanha
  if (shadow) tl.to(shadow, { opacity: 1, scaleX: 1, x: 0 }, 0.1);

  // ornamentos da capa surgem no trecho final do scroll
  if (ornaments.length) {
    tl.to(ornaments, { opacity: 1, y: 0, stagger: 0.1 }, 0.55);
  }
})();

/* ── Credentials reveal ── */
(function () {
  var parent = document.querySelector('.about-credentials');
  if (!parent) return;
  var items = parent.querySelectorAll('.credential');
  if (!items.length) return;
  gsap.set(items, { opacity: 0, x: -20, clipPath: 'inset(0 100% 0 0)' });
  var sobreSection = document.getElementById('sobre');
  // ATRELADO AO SCROLL: credenciais revelam em sequência conforme a rolagem
  var tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: sobreSection || parent,
      start: 'top 80%',
      end: 'top 38%',
      scrub: true
    }
  });
  items.forEach(function (el, i) {
    tl.to(el, { opacity: 1, x: 0, clipPath: 'inset(0 0% 0 0)' }, i * 0.4);
  });
})();

/* ── CTA card reveal: castelo e ornamentos sobem ATRELADO AO SCROLL ── */
(function () {
  var els = document.querySelectorAll('.cta-card-castle, .cta-card-ornament');
  if (!els.length) return;
  gsap.set(els, { opacity: 0, y: 20 });
  gsap.to(els, {
    opacity: 1, y: 0, ease: 'none', stagger: 0.3,
    scrollTrigger: { trigger: '.cta-card', start: 'top 85%', end: 'top 48%', scrub: true }
  });
})();

/* ── Counter ── */
ScrollTrigger.create({
  trigger: '.hero-stats', start: 'top 80%', once: true,
  onEnter: function () {
    document.querySelectorAll('.stat-number').forEach(function (el) {
      var target = parseInt(el.getAttribute('data-target'));
      var obj = { val: 0 };
      gsap.to(obj, {
        val: target, duration: 1.8, ease: 'power2.out',
        onUpdate: function () { el.textContent = Math.floor(obj.val); }
      });
    });
  }
});

/* ── Navbar scrolled ── */
var navbar = document.getElementById('navbar');
var navTicking = false;
function navUpdate() {
  navbar.classList.toggle('navbar-scrolled', window.pageYOffset > 80);
  navTicking = false;
}
window.addEventListener('scroll', function () {
  if (!navTicking) { requestAnimationFrame(navUpdate); navTicking = true; }
}, { passive: true });

/* ── Mobile menu ── */
var menuBtn = document.getElementById('mobileMenuBtn');
var mobileMenu = document.getElementById('mobileMenu');
if (menuBtn && mobileMenu) {
  menuBtn.addEventListener('click', function () {
    menuBtn.classList.toggle('active');
    mobileMenu.classList.toggle('open');
    document.body.classList.toggle('menu-open');
  });
  document.querySelectorAll('.mobile-link').forEach(function (link) {
    link.addEventListener('click', function () {
      menuBtn.classList.remove('active');
      mobileMenu.classList.remove('open');
      document.body.classList.remove('menu-open');
    });
  });
}

/* ── Smooth scroll anchors via Lenis ── */
document.querySelectorAll('a[href^="#"]').forEach(function (a) {
  a.addEventListener('click', function (e) {
    var href = a.getAttribute('href');
    if (!href || href === '#') return;
    var target = document.querySelector(href);
    if (!target) return;
    e.preventDefault();
    lenis.scrollTo(target, { offset: -40, duration: 1.2 });
  });
});

window.addEventListener('load', function () { ScrollTrigger.refresh(); });

/* ── Filtros de catálogo ── */
(function () {
  var chips = document.querySelectorAll('.filter-chip');
  var cards = document.querySelectorAll('#catalogGrid .property-card');
  var emptyMsg = document.getElementById('catalogEmpty');
  if (!chips.length || !cards.length) return;

  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      var filter = chip.getAttribute('data-filter');
      chips.forEach(function (c) { c.classList.remove('is-active'); });
      chip.classList.add('is-active');

      var visible = 0;
      cards.forEach(function (card) {
        var match = filter === 'all' || card.getAttribute('data-category') === filter;
        if (match) {
          card.classList.remove('is-hidden');
          visible++;
        } else {
          card.classList.add('is-hidden');
        }
      });

      if (emptyMsg) emptyMsg.hidden = visible > 0;
      ScrollTrigger.refresh();
    });
  });
})();
