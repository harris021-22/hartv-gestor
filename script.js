/**
 * Landing Page de Pedido de Casamento Interativo
 * - Fundo dinâmico com partículas de corações e estrelas
 * - Botão "Não" fujão com física de fuga por aproximação
 * - Celebração com confetes, Web Audio sintetizado e carta romântica
 */

document.addEventListener('DOMContentLoaded', () => {
  // Elementos do DOM
  const btnSim = document.getElementById('btn-sim');
  const btnNao = document.getElementById('btn-nao');
  const naoText = document.getElementById('nao-text');
  const actionsBox = document.getElementById('actions-box');
  const proposalCard = document.getElementById('proposal-card');
  const celebrationCard = document.getElementById('celebration-card');
  const escapeCounter = document.getElementById('escape-counter');
  const currentTimestamp = document.getElementById('current-timestamp');
  const btnConfettiMore = document.getElementById('btn-confetti-more');
  const btnRestart = document.getElementById('btn-restart');
  const soundToggle = document.getElementById('sound-toggle');
  const soundIcon = document.getElementById('sound-icon');
  const soundTooltip = document.querySelector('.sound-tooltip');
  const canvas = document.getElementById('bg-canvas');
  const ctx = canvas.getContext('2d');

  // Estado da aplicação
  let soundEnabled = true;
  let escapeCount = 0;
  let audioCtx = null;

  // Frases bem-humoradas exibidas no contador de tentativas (o botão mantém sempre o texto "Não")
  const escapePhrases = [
    "Tá fugindo por quê? 😂",
    "Ih, tá com medo da verdade? 🙈",
    "Assume logo, ninguém tá vendo! 🏳️‍🌈",
    "O botão 'Não' recusou o seu toque! 💅",
    "Não adianta correr, o destino é inevitável! ✨",
    "Tentando disfarçar? Não vai rolar! 🏃💨",
    "A ciência já comprovou! 🔬",
    "Só existe uma resposta válida: SIM! 🌈"
  ];

  /* ==========================================================================
     1. Web Audio API: Efeitos Sonoros Elegantes (Zero dependências externas)
     ========================================================================== */
  function getAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  // Som suave de pulo / fuga ("whoosh / pop")
  function playDodgeSound() {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      // Frequência modulada para tom brincalhão
      const startFreq = 280 + Math.random() * 80;
      const endFreq = 540 + Math.random() * 120;
      osc.frequency.setValueAtTime(startFreq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(endFreq, ctx.currentTime + 0.14);

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) {
      // Navegadores que bloqueiam áudio automático
    }
  }

  // Fanfarra romântica de harpa / sinos ao clicar no SIM
  function playCelebrationChime() {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      // Acorde maior brilhante (Doce e triunfante: C5, E5, G5, B5, C6)
      const chord = [523.25, 659.25, 783.99, 987.77, 1046.50, 1318.51];
      
      chord.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = index % 2 === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + index * 0.1);

        const startTime = ctx.currentTime + index * 0.09;
        const duration = 1.4;

        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.linearRampToValueAtTime(0.12, startTime + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + duration + 0.1);
      });
    } catch (e) {
      console.warn("Áudio não disponível", e);
    }
  }

  // Controle de Mute / Unmute
  soundToggle.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    soundIcon.textContent = soundEnabled ? '🔊' : '🔇';
    soundTooltip.textContent = soundEnabled ? 'Som ativado' : 'Som desativado';
    if (soundEnabled) {
      getAudioContext();
    }
  });

  /* ==========================================================================
     2. Mecânica do Botão NÃO (Fuga Fluida e Inteligente pela Tela)
     ========================================================================== */
  let isFleeing = false;

  // Efeito visual sutil de fumaça / rastro onde o botão estava
  function createEscapeSmoke(x, y) {
    const puff = document.createElement('div');
    puff.className = 'escape-puff';
    const icons = ['💨', '✨', '💨', '🏃💨', '✨'];
    puff.textContent = icons[Math.floor(Math.random() * icons.length)];
    puff.style.left = `${x}px`;
    puff.style.top = `${y}px`;
    document.body.appendChild(puff);
    setTimeout(() => {
      puff.remove();
    }, 550);
  }

  function moveNaoButton(cursorX, cursorY) {
    if (isFleeing) return;
    isFleeing = true;

    // Mantém rigorosamente o texto "Não" no botão
    naoText.textContent = "Não";

    const buttonWidth = 140;
    const buttonHeight = 52;

    // Converte para posição fixa e move diretamente para o document.body
    // Isso é CRÍTICO: remove o botão de dentro do card (que possui backdrop-filter),
    // garantindo que as coordenadas left/top sejam 100% relativas à janela real (viewport).
    if (!btnNao.classList.contains('fleeing')) {
      const initialRect = btnNao.getBoundingClientRect();
      document.body.appendChild(btnNao);
      btnNao.classList.add('fleeing');
      btnNao.style.left = `${initialRect.left}px`;
      btnNao.style.top = `${initialRect.top}px`;
      void btnNao.offsetWidth; // Força reflow para animação fluida
    }

    // Posição atual do botão no viewport
    const rect = btnNao.getBoundingClientRect();
    const currentLeft = rect.left;
    const currentTop = rect.top;
    const currentCenterX = currentLeft + buttonWidth / 2;
    const currentCenterY = currentTop + buttonHeight / 2;

    // Solta rastro divertido no ponto onde ele estava
    createEscapeSmoke(currentCenterX, currentCenterY);

    // Margem de segurança estrita para NUNCA sair da tela
    const margin = 28;
    const minLeft = margin;
    const minTop = margin;
    const maxLeft = Math.max(minLeft, window.innerWidth - buttonWidth - margin);
    const maxTop = Math.max(minTop, window.innerHeight - buttonHeight - margin);

    let targetLeft, targetTop;

    const hasValidCursor = Number.isFinite(cursorX) && Number.isFinite(cursorY);

    if (hasValidCursor) {
      // Vetor de fuga apontando na direção oposta ao mouse
      let dx = currentCenterX - cursorX;
      let dy = currentCenterY - cursorY;

      // Se o mouse estiver exatamente sobre o centro, cria vetor aleatório
      if (Math.abs(dx) < 2 && Math.abs(dy) < 2) {
        dx = (Math.random() - 0.5) * 20;
        dy = (Math.random() - 0.5) * 20;
      }

      const len = Math.hypot(dx, dy) || 1;
      dx /= len;
      dy /= len;

      // Adiciona uma leve variação angular (-30° a +30°)
      const angle = (Math.random() - 0.5) * (Math.PI * 0.33);
      const fleeX = dx * Math.cos(angle) - dy * Math.sin(angle);
      const fleeY = dx * Math.sin(angle) + dy * Math.cos(angle);

      // Distância que o botão percorre pela tela (entre 180px e 320px)
      const distance = 190 + Math.random() * 130;
      const proposedLeft = currentLeft + fleeX * distance;
      const proposedTop = currentTop + fleeY * distance;

      // Se a rota proposta estiver confortavelmente dentro da tela, usa ela
      if (proposedLeft >= minLeft && proposedLeft <= maxLeft && proposedTop >= minTop && proposedTop <= maxTop) {
        targetLeft = proposedLeft;
        targetTop = proposedTop;
      } else {
        // Se bater na borda, escolhe entre 20 posições na tela a que fica mais distante do cursor
        let bestDist = -1;
        let bestX = minLeft;
        let bestY = minTop;

        for (let i = 0; i < 20; i++) {
          const testX = minLeft + Math.random() * (maxLeft - minLeft);
          const testY = minTop + Math.random() * (maxTop - minTop);
          const d = Math.hypot(testX - cursorX, testY - cursorY);
          if (d > bestDist) {
            bestDist = d;
            bestX = testX;
            bestY = testY;
          }
        }
        targetLeft = bestX;
        targetTop = bestY;
      }
    } else {
      // Salto aleatório seguro quando chamado sem coordenadas
      targetLeft = minLeft + Math.random() * (maxLeft - minLeft);
      targetTop = minTop + Math.random() * (maxTop - minTop);
    }

    // Trava de segurança absoluta contra NaN ou valores inválidos
    if (!Number.isFinite(targetLeft) || !Number.isFinite(targetTop)) {
      targetLeft = minLeft + (maxLeft - minLeft) * 0.5;
      targetTop = minTop + (maxTop - minTop) * 0.5;
    }

    // Clamping final incondicional: o botão NUNCA ultrapassa as bordas da tela
    targetLeft = Math.min(Math.max(minLeft, Math.round(targetLeft)), maxLeft);
    targetTop = Math.min(Math.max(minTop, Math.round(targetTop)), maxTop);

    // Aplica a nova posição e uma inclinação brincalhona
    const randomTilt = (Math.random() - 0.5) * 16;
    btnNao.style.left = `${targetLeft}px`;
    btnNao.style.top = `${targetTop}px`;
    btnNao.style.transform = `rotate(${randomTilt}deg) scale(1.02)`;

    // Incrementa contagem de tentativas
    escapeCount++;

    // Mensagens bem-humoradas exibidas no contador de tentativas (abaixo do card)
    if (escapeCount >= 2) {
      const phraseIndex = (escapeCount - 2) % escapePhrases.length;
      escapeCounter.textContent = `😂 Tentativas de fugir do destino: ${escapeCount} — ${escapePhrases[phraseIndex]}`;
      escapeCounter.style.opacity = '1';
    }

    playDodgeSound();

    // Libera a próxima fuga após a transição suave
    setTimeout(() => {
      btnNao.style.transform = `rotate(0deg) scale(1)`;
      isFleeing = false;
    }, 280);
  }

  // Ativação por Proximidade do Cursor (o botão começa a fugir antes mesmo de tocar!)
  window.addEventListener('mousemove', (e) => {
    if (proposalCard.classList.contains('hidden')) return;

    const rect = btnNao.getBoundingClientRect();
    const btnW = rect.width > 0 ? rect.width : 140;
    const btnH = rect.height > 0 ? rect.height : 52;
    const btnCenterX = rect.left + btnW / 2;
    const btnCenterY = rect.top + btnH / 2;

    const distance = Math.hypot(e.clientX - btnCenterX, e.clientY - btnCenterY);

    // Quando o mouse chega a menos de 95px, desliza e foge pela tela
    if (distance < 95) {
      moveNaoButton(e.clientX, e.clientY);
    }
  });

  // Ativação por Hover direto (caso o cursor entre em alta velocidade)
  btnNao.addEventListener('mouseenter', (e) => moveNaoButton(e.clientX, e.clientY));
  btnNao.addEventListener('mouseover', (e) => moveNaoButton(e.clientX, e.clientY));

  // Ativação por Toque Mobile (previne o toque e foge na hora)
  btnNao.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    moveNaoButton(touch ? touch.clientX : null, touch ? touch.clientY : null);
  }, { passive: false });

  // Ativação por clique direto como proteção extra
  btnNao.addEventListener('click', (e) => {
    e.preventDefault();
    moveNaoButton(e.clientX, e.clientY);
  });

  // Garante que o botão seja mantido dentro da tela mesmo se a janela for redimensionada
  window.addEventListener('resize', () => {
    if (!btnNao.classList.contains('fleeing') || proposalCard.classList.contains('hidden')) return;
    const buttonWidth = 140;
    const buttonHeight = 52;
    const curLeft = parseFloat(btnNao.style.left);
    const curTop = parseFloat(btnNao.style.top);

    const margin = 28;
    const maxL = Math.max(margin, window.innerWidth - buttonWidth - margin);
    const maxT = Math.max(margin, window.innerHeight - buttonHeight - margin);

    const safeL = Number.isFinite(curLeft) ? curLeft : margin;
    const safeT = Number.isFinite(curTop) ? curTop : margin;

    btnNao.style.left = `${Math.min(Math.max(margin, safeL), maxL)}px`;
    btnNao.style.top = `${Math.min(Math.max(margin, safeT), maxT)}px`;
  });

  /* ==========================================================================
     3. Ação do Botão SIM (Celebração de Amor, Confetes e Transição)
     ========================================================================== */
  btnSim.addEventListener('click', () => {
    // Registra o momento exato
    const now = new Date();
    const options = { 
      day: '2-digit', 
      month: 'long', 
      year: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    };
    currentTimestamp.textContent = now.toLocaleDateString('pt-BR', options);

    // Oculta o card da pergunta e exibe o da celebração
    proposalCard.classList.add('hidden');
    celebrationCard.classList.remove('hidden');

    // Se o botão não estiver solto pela tela, esconde
    btnNao.style.display = 'none';

    // Toca som triunfante
    playCelebrationChime();

    // Dispara cascata massiva de confetes e corações
    launchConfettiBurst();
    launchHeartFireworks();
  });

  // Botão de mais confetes na celebração
  btnConfettiMore.addEventListener('click', () => {
    playCelebrationChime();
    launchConfettiBurst();
    launchHeartFireworks();
  });

  // Botão para reiniciar a brincadeira
  btnRestart.addEventListener('click', () => {
    celebrationCard.classList.add('hidden');
    proposalCard.classList.remove('hidden');

    // Devolve o botão Não para dentro do actions-box caso tenha sido movido para o body
    if (btnNao.parentElement !== actionsBox) {
      actionsBox.appendChild(btnNao);
    }

    // Restaura botão Não
    btnNao.classList.remove('fleeing');
    btnNao.style.display = '';
    btnNao.style.left = '';
    btnNao.style.top = '';
    btnNao.style.transform = '';
    naoText.textContent = "Não";
    escapeCount = 0;
    isFleeing = false;
    escapeCounter.textContent = "";
  });

  /* ==========================================================================
     4. Sistema de Partículas de Confetes & Corações
     ========================================================================== */
  const confettiParticles = [];
  const romanticColors = ['#ff0055', '#ff7700', '#ffd700', '#00e676', '#00b0ff', '#d500f9', '#ffffff', '#ff4081'];

  function createConfettiPiece(x, y) {
    const angle = Math.random() * Math.PI * 2;
    const velocity = 8 + Math.random() * 12;
    const isHeart = Math.random() > 0.45;

    return {
      x: x || window.innerWidth / 2,
      y: y || window.innerHeight / 2,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity - 4,
      size: isHeart ? 16 + Math.random() * 12 : 7 + Math.random() * 7,
      color: romanticColors[Math.floor(Math.random() * romanticColors.length)],
      rotation: Math.random() * 360,
      vRot: (Math.random() - 0.5) * 12,
      alpha: 1,
      gravity: 0.22,
      drag: 0.96,
      isHeart: isHeart,
      wobble: Math.random() * 10
    };
  }

  function launchConfettiBurst() {
    for (let i = 0; i < 90; i++) {
      confettiParticles.push(createConfettiPiece(window.innerWidth * 0.5, window.innerHeight * 0.45));
    }
    // Rajadas das laterais
    for (let i = 0; i < 40; i++) {
      confettiParticles.push(createConfettiPiece(window.innerWidth * 0.2, window.innerHeight * 0.7));
      confettiParticles.push(createConfettiPiece(window.innerWidth * 0.8, window.innerHeight * 0.7));
    }
  }

  function launchHeartFireworks() {
    let count = 0;
    const interval = setInterval(() => {
      const rx = window.innerWidth * (0.15 + Math.random() * 0.7);
      const ry = window.innerHeight * (0.2 + Math.random() * 0.5);
      for (let i = 0; i < 30; i++) {
        confettiParticles.push(createConfettiPiece(rx, ry));
      }
      count++;
      if (count > 4) clearInterval(interval);
    }, 380);
  }

  /* ==========================================================================
     5. Canvas Interativo: Fundo com Estrelas Cintilantes e Corações Flutuantes
     ========================================================================== */
  let bgParticles = [];

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  window.addEventListener('resize', () => {
    resizeCanvas();
    initBgParticles();
  });
  resizeCanvas();

  function initBgParticles() {
    bgParticles = [];
    const count = Math.min(Math.floor((window.innerWidth * window.innerHeight) / 12000), 75);

    for (let i = 0; i < count; i++) {
      bgParticles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: 2 + Math.random() * 4,
        speedY: 0.3 + Math.random() * 0.8,
        speedX: (Math.random() - 0.5) * 0.4,
        alpha: 0.2 + Math.random() * 0.6,
        isHeart: Math.random() > 0.6,
        pulseSpeed: 0.02 + Math.random() * 0.03,
        pulseVal: Math.random() * Math.PI
      });
    }
  }
  initBgParticles();

  // Função auxiliar para desenhar corações no Canvas
  function drawHeart(context, x, y, size, color, alpha) {
    context.save();
    context.globalAlpha = alpha;
    context.fillStyle = color;
    context.beginPath();
    const topCurveHeight = size * 0.3;
    context.moveTo(x, y + topCurveHeight);
    // curva superior esquerda
    context.bezierCurveTo(
      x, y, 
      x - size / 2, y, 
      x - size / 2, y + topCurveHeight
    );
    // curva inferior esquerda até a ponta
    context.bezierCurveTo(
      x - size / 2, y + (size + topCurveHeight) / 2, 
      x, y + (size + topCurveHeight) / 1.2, 
      x, y + size
    );
    // curva inferior direita
    context.bezierCurveTo(
      x, y + (size + topCurveHeight) / 1.2, 
      x + size / 2, y + (size + topCurveHeight) / 2, 
      x + size / 2, y + topCurveHeight
    );
    // curva superior direita
    context.bezierCurveTo(
      x + size / 2, y, 
      x, y, 
      x, y + topCurveHeight
    );
    context.closePath();
    context.fill();
    context.restore();
  }

  // Loop de Animação 60fps
  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Partículas do Fundo (Corações e Estrelas suaves)
    for (let p of bgParticles) {
      p.y -= p.speedY;
      p.x += Math.sin(p.pulseVal) * 0.4;
      p.pulseVal += p.pulseSpeed;

      if (p.y < -20) {
        p.y = canvas.height + 20;
        p.x = Math.random() * canvas.width;
      }

      const curAlpha = p.alpha * (0.7 + Math.sin(p.pulseVal) * 0.3);

      if (p.isHeart) {
        drawHeart(ctx, p.x, p.y, p.size * 2.2, '#ff6b8b', curAlpha);
      } else {
        // Estrelas brilhantes circulares com halo
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 235, 205, ${curAlpha})`;
        ctx.fill();
      }
    }

    // 2. Partículas de Confetes da Celebração
    for (let i = confettiParticles.length - 1; i >= 0; i--) {
      const c = confettiParticles[i];
      c.x += c.vx;
      c.y += c.vy;
      c.vy += c.gravity;
      c.vx *= c.drag;
      c.rotation += c.vRot;
      c.alpha -= 0.007;

      if (c.alpha <= 0 || c.y > canvas.height + 50) {
        confettiParticles.splice(i, 1);
        continue;
      }

      if (c.isHeart) {
        drawHeart(ctx, c.x, c.y, c.size, c.color, c.alpha);
      } else {
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate((c.rotation * Math.PI) / 180);
        ctx.globalAlpha = c.alpha;
        ctx.fillStyle = c.color;
        ctx.fillRect(-c.size / 2, -c.size / 2, c.size, c.size * 0.6);
        ctx.restore();
      }
    }

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
});
