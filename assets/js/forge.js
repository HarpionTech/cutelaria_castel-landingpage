/* ══════════════════════════════════════════════════════════════
   FORGE CANVAS v3 — embers cinematográficos (otimizado p/ 60fps mobile)
   • Sprites de glow PRÉ-RENDERIZADOS (drawImage) em vez de
     createRadialGradient por partícula/frame — elimina o gargalo de CPU.
   • Glow base dos clusters também é sprite estampado (não gradiente vivo).
   • Detecta mobile/coarse: DPR=1, menos partículas, menos clusters.
   • Mantém: temperatura de cor (hot→cool), twinkle, flash, death-fade.
══════════════════════════════════════════════════════════════ */
(function () {
  var canvas = document.getElementById('forgeCanvas');
  if (!canvas) return;

  // Respeita prefers-reduced-motion: desliga tudo.
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    canvas.style.display = 'none';
    return;
  }

  var ctx = canvas.getContext('2d', { alpha: true });
  var IS_MOBILE = (window.matchMedia && window.matchMedia('(max-width: 720px), (pointer: coarse)').matches);
  // DPR menor no mobile reduce drasticamente a taxa de fill do canvas.
  var DPR = IS_MOBILE ? 1 : Math.min(window.devicePixelRatio || 1, 2);

  var W = 0, H = 0;
  var particles = [];
  var maxParticles = 0;
  var clusters = [];
  var t = 0;

  function rand(a, b) { return a + Math.random() * (b - a); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  /* ── Sprites de glow pré-renderizados, bucketizados por matiz ──
     Cada sprite já contém core branco-quente + halo suave do tom.
     Desenhar = 1 drawImage (barato), em vez de 2-3 gradientes/frame. */
  var SPRITE_R = 48;                 // raio em px do sprite
  var SPRITE_SIZE = SPRITE_R * 2;
  var hueBuckets = [];               // matizes representativos
  var glowSprites = [];              // canvas por bucket
  (function buildSprites() {
    // quente→frio (vermelho→dourado) + um bucket vinho
    for (var h = 6; h <= 54; h += 4) hueBuckets.push(h);
    hueBuckets.push(351);            // wine
    for (var i = 0; i < hueBuckets.length; i++) {
      var hue = hueBuckets[i];
      var sat = hue > 300 ? 82 : 96;
      var c = document.createElement('canvas');
      c.width = c.height = SPRITE_SIZE;
      var g = c.getContext('2d');
      var grad = g.createRadialGradient(SPRITE_R, SPRITE_R, 0, SPRITE_R, SPRITE_R, SPRITE_R);
      grad.addColorStop(0.00, 'hsla(' + hue + ',' + sat + '%,96%,1)');
      grad.addColorStop(0.10, 'hsla(' + hue + ',' + sat + '%,72%,0.85)');
      grad.addColorStop(0.30, 'hsla(' + hue + ',' + sat + '%,55%,0.32)');
      grad.addColorStop(0.65, 'hsla(' + hue + ',' + sat + '%,42%,0.07)');
      grad.addColorStop(1.00, 'hsla(' + hue + ',' + sat + '%,30%,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
      glowSprites.push(c);
    }
  })();

  function spriteFor(hue) {
    // wine
    if (hue > 300) return glowSprites[glowSprites.length - 1];
    var idx = Math.round((hue - 6) / 4);
    if (idx < 0) idx = 0;
    if (idx > glowSprites.length - 2) idx = glowSprites.length - 2;
    return glowSprites[idx];
  }

  /* ── Glow base da forja: sprite radial único estampado por cluster ── */
  var BASE_R = 256;
  var baseGlow = (function () {
    var c = document.createElement('canvas');
    c.width = c.height = BASE_R * 2;
    var g = c.getContext('2d');
    var grad = g.createRadialGradient(BASE_R, BASE_R, 12, BASE_R, BASE_R, BASE_R);
    grad.addColorStop(0.00, 'rgba(255,110,50,0.16)');
    grad.addColorStop(0.18, 'rgba(220,80,35,0.09)');
    grad.addColorStop(0.50, 'rgba(140,32,44,0.04)');
    grad.addColorStop(1.00, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, BASE_R * 2, BASE_R * 2);
    return c;
  })();

  function resize() {
    W = canvas.clientWidth = window.innerWidth;
    H = canvas.clientHeight = window.innerHeight;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    maxParticles = IS_MOBILE ? 28 : Math.min(120, Math.round(W * H / 20000));

    var n = IS_MOBILE ? 3 : 5;
    clusters = [];
    for (var i = 0; i < n; i++) {
      clusters.push({
        cx: (i + 0.5 + (Math.random() - 0.5) * 0.4) * (W / n),
        spread: W / n * (0.4 + Math.random() * 0.35),
        weight: 0.7 + Math.random() * 0.6,
        breathPhase: Math.random() * Math.PI * 2
      });
    }
  }
  resize();
  var resizeRaf;
  window.addEventListener('resize', function () {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(resize);
  });

  function pickCluster() {
    var tot = 0; for (var i = 0; i < clusters.length; i++) tot += clusters[i].weight;
    var r = Math.random() * tot, acc = 0;
    for (var j = 0; j < clusters.length; j++) {
      acc += clusters[j].weight;
      if (r <= acc) return clusters[j];
    }
    return clusters[0];
  }

  function spawn() {
    var cluster = pickCluster();
    var x = cluster.cx + (Math.random() - 0.5) * cluster.spread * 2;
    var roll = Math.random();
    var type, r, vy, life, hueHot, hueCool, twinkleAmp, twinkleSpeed, trail, hasFlash;

    if (roll < 0.16) {
      type = 'ember'; r = rand(2.6, 5.0); vy = -rand(0.14, 0.34); life = rand(520, 820);
      hueHot = rand(8, 22); hueCool = rand(36, 46);
      twinkleAmp = rand(0.06, 0.14); twinkleSpeed = rand(0.03, 0.06); trail = 0;
      hasFlash = Math.random() < 0.18;
    } else if (roll < 0.52) {
      type = 'spark'; r = rand(1.3, 2.5); vy = -rand(0.32, 0.72); life = rand(280, 480);
      hueHot = rand(18, 30); hueCool = rand(38, 48);
      twinkleAmp = rand(0.2, 0.42); twinkleSpeed = rand(0.08, 0.16); trail = 0;
      hasFlash = Math.random() < 0.08;
    } else if (roll < 0.80) {
      type = 'dust'; r = rand(0.5, 1.3); vy = -rand(0.06, 0.20); life = rand(700, 1200);
      hueHot = rand(32, 42); hueCool = rand(44, 54);
      twinkleAmp = rand(0.35, 0.65); twinkleSpeed = rand(0.05, 0.13); trail = 0;
      hasFlash = false;
    } else if (roll < 0.94) {
      type = 'streak'; r = rand(0.9, 1.8); vy = -rand(0.95, 1.7); life = rand(160, 280);
      hueHot = rand(12, 24); hueCool = rand(34, 42);
      twinkleAmp = 0.18; twinkleSpeed = 0.1; trail = rand(10, 22);
      hasFlash = false;
    } else {
      type = 'wine'; r = rand(1.3, 2.6); vy = -rand(0.18, 0.48); life = rand(380, 580);
      hueHot = 351; hueCool = 351;
      twinkleAmp = rand(0.15, 0.32); twinkleSpeed = rand(0.06, 0.12); trail = 0;
      hasFlash = Math.random() < 0.1;
    }

    particles.push({
      x: x, y: H + rand(2, 36),
      vx: (Math.random() - 0.5) * 0.28, vy: vy,
      ay: -rand(0.0009, 0.0024), r: r, type: type,
      life: 0, maxLife: life,
      hueHot: hueHot, hueCool: hueCool,
      drift: rand(0.7, 2.0), driftSpeed: rand(0.011, 0.028), driftPhase: rand(0, Math.PI * 2),
      twinkleAmp: twinkleAmp, twinkleSpeed: twinkleSpeed, twinklePhase: rand(0, Math.PI * 2),
      trail: trail, depth: Math.random(),
      hasFlash: hasFlash, flashAt: hasFlash ? rand(0.25, 0.6) : -1, flashDone: false,
      heatWave: type === 'ember' ? rand(0.6, 1.2) : 0
    });
  }

  // Pausa o desenho apenas quando a aba está oculta (economia sem
  // afetar a experiência). As partículas seguem se movendo enquanto
  // a página estiver visível, inclusive durante o scroll.
  var pageVisible = true;
  document.addEventListener('visibilitychange', function () {
    pageVisible = !document.hidden;
  });

  function step() {
    // Não desenha enquanto a aba está oculta OU durante o preloader
    // (libera GPU/CPU para o mergulho do castelo + transição do túnel,
    // evitando engasgo/"corte" na animação de abertura no celular).
    if (!pageVisible || document.body.classList.contains('preloading')) {
      requestAnimationFrame(step); return;
    }
    t++;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';

    // Glow base — estampa o sprite radial por cluster (sem gradiente vivo)
    for (var k = 0; k < clusters.length; k++) {
      var cl = clusters[k];
      var pulse = 0.78 + 0.22 * Math.sin(t * 0.025 + cl.breathPhase);
      var bw = H * 1.2;
      ctx.globalAlpha = pulse;
      ctx.drawImage(baseGlow, cl.cx - bw / 2, H + 30 - bw / 2, bw, bw);
    }

    var spawnPerFrame = Math.min(3, Math.max(1, Math.round((maxParticles - particles.length) / 12)));
    for (var s = 0; s < spawnPerFrame && particles.length < maxParticles; s++) spawn();

    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.life++;

      p.vy += p.ay;
      p.vx += Math.sin(p.life * p.driftSpeed + p.driftPhase) * 0.014;
      var heatX = p.heatWave > 0 ? Math.sin(p.life * 0.18 + p.driftPhase) * p.heatWave : 0;
      p.x += p.vx + Math.sin(p.life * p.driftSpeed * 0.55 + p.driftPhase) * p.drift * 0.05 + heatX;
      p.y += p.vy;

      var lifeRatio = p.life / p.maxLife;
      var env;
      if (lifeRatio < 0.08)      env = lifeRatio / 0.08;
      else if (lifeRatio < 0.65) env = 1;
      else                       env = 1 - (lifeRatio - 0.65) / 0.35;
      if (env <= 0 || p.y < -25) { particles.splice(i, 1); continue; }

      var heat = Math.min(1, lifeRatio * 1.5);
      var hue = lerp(p.hueHot, p.hueCool, heat);
      var twk = 1 + Math.sin(p.life * p.twinkleSpeed + p.twinklePhase) * p.twinkleAmp;

      var flashMul = 1;
      if (p.hasFlash && !p.flashDone && lifeRatio >= p.flashAt) {
        var fe = lifeRatio - p.flashAt;
        if (fe < 0.08) { var fp = fe / 0.08; flashMul = 1 + 2.4 * (fp < 0.5 ? fp * 2 : (1 - fp) * 2); }
        else p.flashDone = true;
      }

      var alpha = Math.min(1.6, env * twk * flashMul);

      var depthScale = 0.7 + p.depth * 0.6;
      var rBase = p.r * depthScale;
      if (lifeRatio > 0.75) rBase *= 1 + ((lifeRatio - 0.75) / 0.25) * 0.5;
      var r = rBase * (flashMul > 1 ? lerp(1, 1.3, (flashMul - 1) / 2.4) : 1);

      // Trail dos streaks — barra sólida simples (sem gradiente)
      if (p.trail > 0) {
        ctx.globalAlpha = Math.min(1, alpha * 0.4);
        ctx.fillStyle = 'hsl(' + hue + ',100%,70%)';
        ctx.fillRect(p.x - r * 0.5, p.y, r, p.trail);
      }

      // Glow + core num único drawImage do sprite (halo embutido).
      // Diâmetro do sprite mapeia ao antigo halo (~r * 9).
      var sprite = spriteFor(hue);
      var d = r * (p.type === 'ember' ? 22 : 18);
      ctx.globalAlpha = Math.min(1, alpha * 0.85);
      ctx.drawImage(sprite, p.x - d / 2, p.y - d / 2, d, d);
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    requestAnimationFrame(step);
  }

  step();
})();
