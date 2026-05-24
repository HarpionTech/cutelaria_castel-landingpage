/* ══════════════════════════════════════════════════════════════
   FORGE CANVAS v2 — embers cinematográficos subindo da forja
   • Temperatura de cor: ember nasce vermelho/laranja, esfria pra dourado conforme sobe
   • Flash events: 5% das partículas pulsam brilho súbito (carvão estalando)
   • Death fade: shrink + glow expansion no final
   • Halos radiais duplos com blending 'lighter'
   • Heat distortion: leve ondulação senoidal nas brasas grandes
══════════════════════════════════════════════════════════════ */
(function () {
  var canvas = document.getElementById('forgeCanvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var DPR = Math.min(window.devicePixelRatio || 1, 2);
  var W = 0, H = 0;
  var particles = [];
  var maxParticles = 0;
  var clusters = [];
  var t = 0;

  function resize() {
    W = canvas.clientWidth = window.innerWidth;
    H = canvas.clientHeight = window.innerHeight;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    maxParticles = W < 720 ? 55 : Math.min(140, Math.round(W * H / 18000));

    var n = W < 720 ? 3 : 5;
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
  window.addEventListener('resize', resize);

  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function pickCluster() {
    var tot = 0; for (var i = 0; i < clusters.length; i++) tot += clusters[i].weight;
    var r = Math.random() * tot;
    var acc = 0;
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
    var type, r, vy, life, hueHot, hueCool, sat, lum, twinkleAmp, twinkleSpeed, trail, hasFlash;

    if (roll < 0.16) {
      // EMBER — brasa grande, nasce laranja-vermelha, esfria pra dourado
      type = 'ember';
      r = rand(2.6, 5.0);
      vy = -rand(0.14, 0.34);
      life = rand(520, 820);
      hueHot = rand(8, 22);     // vermelho-laranja
      hueCool = rand(36, 46);   // dourado
      sat = rand(92, 100);
      lum = rand(55, 65);
      twinkleAmp = rand(0.06, 0.14);
      twinkleSpeed = rand(0.03, 0.06);
      trail = 0;
      hasFlash = Math.random() < 0.18;  // 18% piscam
    } else if (roll < 0.52) {
      // SPARK — fagulha dourada média
      type = 'spark';
      r = rand(1.3, 2.5);
      vy = -rand(0.32, 0.72);
      life = rand(280, 480);
      hueHot = rand(18, 30);
      hueCool = rand(38, 48);
      sat = rand(85, 100);
      lum = rand(62, 75);
      twinkleAmp = rand(0.2, 0.42);
      twinkleSpeed = rand(0.08, 0.16);
      trail = 0;
      hasFlash = Math.random() < 0.08;
    } else if (roll < 0.80) {
      // DUST — pó luminoso lento, fica muito tempo
      type = 'dust';
      r = rand(0.5, 1.3);
      vy = -rand(0.06, 0.20);
      life = rand(700, 1200);
      hueHot = rand(32, 42);
      hueCool = rand(44, 54);
      sat = rand(55, 80);
      lum = rand(72, 84);
      twinkleAmp = rand(0.35, 0.65);
      twinkleSpeed = rand(0.05, 0.13);
      trail = 0;
      hasFlash = false;
    } else if (roll < 0.94) {
      // STREAK — fagulha rápida com leve rastro
      type = 'streak';
      r = rand(0.9, 1.8);
      vy = -rand(0.95, 1.7);
      life = rand(160, 280);
      hueHot = rand(12, 24);
      hueCool = rand(34, 42);
      sat = 100;
      lum = rand(72, 86);
      twinkleAmp = 0.18;
      twinkleSpeed = 0.1;
      trail = rand(10, 22);
      hasFlash = false;
    } else {
      // WINE — fagulha vinho rara
      type = 'wine';
      r = rand(1.3, 2.6);
      vy = -rand(0.18, 0.48);
      life = rand(380, 580);
      hueHot = 348;
      hueCool = 354;
      sat = rand(72, 92);
      lum = rand(52, 64);
      twinkleAmp = rand(0.15, 0.32);
      twinkleSpeed = rand(0.06, 0.12);
      trail = 0;
      hasFlash = Math.random() < 0.1;
    }

    particles.push({
      x: x,
      y: H + rand(2, 36),
      vx: (Math.random() - 0.5) * 0.28,
      vy: vy,
      ay: -rand(0.0009, 0.0024),
      r: r,
      type: type,
      life: 0,
      maxLife: life,
      hueHot: hueHot, hueCool: hueCool,
      sat: sat, lum: lum,
      drift: rand(0.7, 2.0),
      driftSpeed: rand(0.011, 0.028),
      driftPhase: rand(0, Math.PI * 2),
      twinkleAmp: twinkleAmp,
      twinkleSpeed: twinkleSpeed,
      twinklePhase: rand(0, Math.PI * 2),
      trail: trail,
      depth: Math.random(),
      hasFlash: hasFlash,
      flashAt: hasFlash ? rand(0.25, 0.6) : -1,  // momento (fração da vida) do flash
      flashDone: false,
      heatWave: type === 'ember' ? rand(0.6, 1.2) : 0   // ember vibram horizontalmente
    });
  }

  function step() {
    t++;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, W, H);

    // Glow base — brasa da forja pulsando em cada cluster
    ctx.globalCompositeOperation = 'lighter';
    for (var k = 0; k < clusters.length; k++) {
      var cl = clusters[k];
      var pulse = 0.78 + 0.22 * Math.sin(t * 0.025 + cl.breathPhase);
      var grad = ctx.createRadialGradient(cl.cx, H + 30, 12, cl.cx, H + 30, H * 0.6);
      grad.addColorStop(0,    'rgba(255, 110, 50, ' + (0.14 * pulse) + ')');
      grad.addColorStop(0.18, 'rgba(220, 80, 35, ' + (0.08 * pulse) + ')');
      grad.addColorStop(0.5,  'rgba(140, 32, 44, ' + (0.035 * pulse) + ')');
      grad.addColorStop(1,    'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    }

    var spawnPerFrame = Math.min(3, Math.max(1, Math.round((maxParticles - particles.length) / 12)));
    for (var s = 0; s < spawnPerFrame && particles.length < maxParticles; s++) spawn();

    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.life++;

      // física
      p.vy += p.ay;
      p.vx += Math.sin(p.life * p.driftSpeed + p.driftPhase) * 0.014;
      // heat wave shimmer pra embers
      var heatX = p.heatWave > 0 ? Math.sin(p.life * 0.18 + p.driftPhase) * p.heatWave : 0;
      p.x += p.vx + Math.sin(p.life * p.driftSpeed * 0.55 + p.driftPhase) * p.drift * 0.05 + heatX;
      p.y += p.vy;

      var lifeRatio = p.life / p.maxLife;
      // envelope alpha
      var env;
      if (lifeRatio < 0.08)      env = lifeRatio / 0.08;
      else if (lifeRatio < 0.65) env = 1;
      else                       env = 1 - (lifeRatio - 0.65) / 0.35;
      if (env <= 0 || p.y < -25) { particles.splice(i, 1); continue; }

      // Temperatura: lerp hue conforme sobe (hot→cool baseado em lifeRatio)
      var heat = Math.min(1, lifeRatio * 1.5);   // primeiros 66% transicionam, depois fixa
      var hue = lerp(p.hueHot, p.hueCool, heat);
      // Quanto mais frio, menos saturado e mais claro
      var sat = lerp(p.sat, p.sat * 0.7, heat);
      var lum = lerp(p.lum, p.lum + 8, heat);

      // Twinkle
      var twk = 1 + Math.sin(p.life * p.twinkleSpeed + p.twinklePhase) * p.twinkleAmp;

      // Flash event — pico súbito de brilho num momento da vida
      var flashMul = 1;
      if (p.hasFlash && !p.flashDone && lifeRatio >= p.flashAt) {
        var flashElapsed = lifeRatio - p.flashAt;
        if (flashElapsed < 0.08) {
          // sobe rápido (0..0.04) e cai (0.04..0.08)
          var fp = flashElapsed / 0.08;
          flashMul = 1 + 2.4 * (fp < 0.5 ? fp * 2 : (1 - fp) * 2);
        } else {
          p.flashDone = true;
        }
      }

      var alpha = env * twk * flashMul;
      alpha = Math.min(1.6, alpha);

      // Depth scaling
      var depthScale = 0.7 + p.depth * 0.6;
      var rBase = p.r * depthScale;

      // Death fade: nos últimos 25%, raio cresce levemente enquanto desaparece (glow expansion)
      if (lifeRatio > 0.75) {
        var deathT = (lifeRatio - 0.75) / 0.25;
        rBase *= 1 + deathT * 0.5;
      }

      var r = rBase * (flashMul > 1 ? lerp(1, 1.3, (flashMul - 1) / 2.4) : 1);

      // Trail (streaks)
      if (p.trail > 0) {
        var tg = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.trail);
        tg.addColorStop(0, 'hsla(' + hue + ',' + sat + '%,' + lum + '%,' + (alpha * 0.5) + ')');
        tg.addColorStop(1, 'hsla(' + hue + ',' + sat + '%,' + (lum - 12) + '%,0)');
        ctx.fillStyle = tg;
        ctx.fillRect(p.x - r * 0.5, p.y, r, p.trail);
      }

      // Halo externo grande
      var haloR = r * (p.type === 'ember' ? 11 : 9);
      var hg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, haloR);
      hg.addColorStop(0,    'hsla(' + hue + ',' + sat + '%,' + lum + '%,' + (alpha * 0.26) + ')');
      hg.addColorStop(0.32, 'hsla(' + hue + ',' + sat + '%,' + (lum - 8) + '%,' + (alpha * 0.10) + ')');
      hg.addColorStop(0.7,  'hsla(' + hue + ',' + sat + '%,40%,' + (alpha * 0.04) + ')');
      hg.addColorStop(1,    'hsla(' + hue + ',' + sat + '%,30%,0)');
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.arc(p.x, p.y, haloR, 0, Math.PI * 2);
      ctx.fill();

      // Halo médio
      var midR = r * 4;
      var mg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, midR);
      mg.addColorStop(0, 'hsla(' + hue + ',' + sat + '%,' + Math.min(95, lum + 14) + '%,' + (alpha * 0.62) + ')');
      mg.addColorStop(1, 'hsla(' + hue + ',' + sat + '%,' + lum + '%,0)');
      ctx.fillStyle = mg;
      ctx.beginPath();
      ctx.arc(p.x, p.y, midR, 0, Math.PI * 2);
      ctx.fill();

      // Core — branco-quente nos grandes e nos flashes
      var coreLum = (p.type === 'ember' || p.type === 'streak' || flashMul > 1.5)
        ? 95
        : Math.min(92, lum + 18);
      ctx.fillStyle = 'hsla(' + hue + ',' + Math.min(100, sat) + '%,' + coreLum + '%,' + Math.min(1, alpha) + ')';
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalCompositeOperation = 'source-over';
    requestAnimationFrame(step);
  }

  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    canvas.style.display = 'none';
    return;
  }

  step();
})();
