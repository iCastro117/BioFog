/* ==========================================================================
   BioFog Panel — interacciones
   ========================================================================== */
(() => {
  'use strict';

  const $ = (selector, ctx = document) => ctx.querySelector(selector);
  const $$ = (selector, ctx = document) => Array.from(ctx.querySelectorAll(selector));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Menú móvil ---------- */
  const toggle = $('.nav-toggle');
  const menu = $('#nav-menu');

  const closeMenu = () => {
    if (!menu || !toggle) return;
    menu.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Abrir menú');
  };

  if (toggle && menu) {
    toggle.addEventListener('click', () => {
      const open = menu.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    });

    $$('.nav-link', menu).forEach((link) => link.addEventListener('click', closeMenu));

    document.addEventListener('click', (event) => {
      if (!event.target.closest('.navbar')) closeMenu();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeMenu();
    });
  }

  /* ---------- Sombra del header al hacer scroll ---------- */
  const header = $('.header');
  const onScroll = () => {
    if (header) header.classList.toggle('is-scrolled', window.scrollY > 20);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- Enlace activo según la sección visible ---------- */
  const navLinks = $$('.nav-link');
  const sections = navLinks
    .map((link) => document.querySelector(link.getAttribute('href')))
    .filter(Boolean);

  if ('IntersectionObserver' in window && sections.length) {
    const sectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const id = `#${entry.target.id}`;
          navLinks.forEach((link) => {
            link.classList.toggle('active', link.getAttribute('href') === id);
          });
        });
      },
      { rootMargin: '-40% 0px -55% 0px' }
    );
    sections.forEach((section) => sectionObserver.observe(section));
  }

  /* ---------- Contadores animados (estadísticas) ---------- */
  const animateCounter = (el) => {
    const target = parseInt(el.dataset.count, 10);
    const prefix = el.dataset.prefix || '';
    const suffix = el.dataset.suffix || '';
    if (Number.isNaN(target)) return;

    if (reduceMotion) {
      el.textContent = `${prefix}${target}${suffix}`;
      return;
    }

    const duration = 1400;
    const start = performance.now();

    const step = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = `${prefix}${Math.round(target * eased)}${suffix}`;
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const counters = $$('[data-count]');
  if (counters.length) {
    if ('IntersectionObserver' in window) {
      const counterObserver = new IntersectionObserver(
        (entries, observer) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            animateCounter(entry.target);
            observer.unobserve(entry.target);
          });
        },
        { threshold: 0.5 }
      );
      counters.forEach((counter) => counterObserver.observe(counter));
    } else {
      counters.forEach(animateCounter);
    }
  }

  /* ---------- Animaciones de scroll ---------- */
  // Retrasos: data-delay en el propio elemento, o escalonados con data-stagger en el contenedor
  $$('[data-stagger]').forEach((group) => {
    const step = Number(group.dataset.stagger) || 120;
    Array.from(group.children)
      .filter((child) => child.dataset.anim !== undefined)
      .forEach((child, i) => child.style.setProperty('--anim-delay', `${i * step}ms`));
  });
  $$('[data-delay]').forEach((el) => {
    el.style.setProperty('--anim-delay', `${Number(el.dataset.delay) || 0}ms`);
  });

  const scrollTargets = $$('[data-anim], [data-scroll]');
  if ('IntersectionObserver' in window && !reduceMotion) {
    const markVisible = (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add('is-visible');
      });
    };
    // Entrada: se anima en cuanto asoma. Sin margen inferior, para que lo que está
    // al final de la página (pie) también se active al llegar abajo del todo.
    const enterObserver = new IntersectionObserver(markVisible, { threshold: 0.12 });
    // Los bloques grandes (líneas del infográfico, carrusel) esperan a verse más
    const enterObserverBig = new IntersectionObserver(markVisible, { threshold: 0.3 });

    // Salida: al subir, lo que queda muy por debajo se reinicia para repetir
    // la animación al volver a bajar. El margen amplio evita parpadeos en el borde.
    const exitObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting && entry.boundingClientRect.top > 0) {
          entry.target.classList.remove('is-visible');
        }
      });
    }, { threshold: 0, rootMargin: '0px 0px 20% 0px' });

    scrollTargets.forEach((el) => {
      const big = el.dataset.scroll !== undefined;
      (big ? enterObserverBig : enterObserver).observe(el);
      exitObserver.observe(el);
    });
  } else {
    scrollTargets.forEach((el) => el.classList.add('is-visible'));
  }

  /* ---------- Parallax y barra de progreso de lectura ---------- */
  const progressBar = $('.scroll-progress');
  const parallaxEls = $$('[data-parallax]');
  const wideScreen = window.matchMedia('(min-width: 993px)');
  let fxQueued = false;

  const moveParallax = (el, viewH) => {
    if (!wideScreen.matches) {
      el.style.translate = '';
      el.dataset.py = '0';
      return;
    }
    const rect = el.getBoundingClientRect();
    const current = Number(el.dataset.py) || 0;
    // Centro real sin el desplazamiento ya aplicado, para que no se acumule
    const centerY = rect.top - current + rect.height / 2;
    const offset = (centerY - viewH / 2) * Number(el.dataset.parallax);
    el.dataset.py = String(offset);
    el.style.translate = `0 ${offset.toFixed(1)}px`;
  };

  const updateScrollFx = () => {
    fxQueued = false;
    const viewH = window.innerHeight;
    const maxScroll = document.documentElement.scrollHeight - viewH;
    if (progressBar) {
      const progress = maxScroll > 0 ? Math.min(window.scrollY / maxScroll, 1) : 0;
      progressBar.style.transform = `scaleX(${progress})`;
    }
    if (!reduceMotion) parallaxEls.forEach((el) => moveParallax(el, viewH));
  };

  const queueScrollFx = () => {
    if (fxQueued) return;
    fxQueued = true;
    requestAnimationFrame(updateScrollFx);
  };
  window.addEventListener('scroll', queueScrollFx, { passive: true });
  window.addEventListener('resize', queueScrollFx);
  updateScrollFx();

  /* ---------- Acordeón de preguntas (QA) ---------- */
  $$('.faq__item').forEach((item) => {
    const button = $('.faq__q', item);
    if (!button) return;
    button.addEventListener('click', () => {
      const open = item.classList.toggle('is-open');
      button.setAttribute('aria-expanded', String(open));
    });
  });

  /* ---------- Cinta animada continua ---------- */
  const tickerTrack = $('.ticker__track');
  const tickerGroup = $('.ticker__group', tickerTrack || document);
  if (tickerTrack && tickerGroup) {
    // Se duplica el grupo para que el bucle no muestre cortes
    const clone = tickerGroup.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    tickerTrack.appendChild(clone);
    tickerTrack.classList.add('is-ready');
  }

  /* ---------- Carrusel de Proceso ---------- */
  const carousel = $('.proc__carousel');

  if (carousel) {
    const slides = $$('.proc__slide', carousel);
    const dotsBox = $('.proc__dots', carousel);
    const total = slides.length;
    const half = Math.floor(total / 2);
    let active = Math.min(2, total - 1);

    // Un punto por etapa
    const dots = slides.map((slide, i) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'proc__dot';
      const title = $('h3', slide);
      dot.setAttribute('aria-label', title ? title.textContent.trim() : `Etapa ${i + 1}`);
      dot.addEventListener('click', () => goTo(i));
      if (dotsBox) dotsBox.appendChild(dot);
      return dot;
    });

    const playVideo = (video, playBtn) => {
      const promise = video.play();
      if (promise && promise.catch) {
        promise
          .then(() => playBtn && playBtn.classList.add('is-playing'))
          .catch(() => playBtn && playBtn.classList.remove('is-playing'));
      } else if (playBtn) {
        playBtn.classList.add('is-playing');
      }
    };

    const update = () => {
      slides.forEach((slide, i) => {
        // Desplazamiento circular: siempre entre -half y +half
        let offset = i - active;
        if (offset > half) offset -= total;
        if (offset < -half) offset += total;

        slide.dataset.pos = String(offset);
        slide.setAttribute('aria-hidden', offset === 0 ? 'false' : 'true');

        const video = $('video', slide);
        const playBtn = $('.proc__play', slide);
        if (!video) return;
        if (offset === 0) {
          playVideo(video, playBtn);
        } else {
          video.pause();
          if (playBtn) playBtn.classList.remove('is-playing');
        }
      });

      dots.forEach((dot, i) => {
        dot.classList.toggle('is-active', i === active);
        dot.setAttribute('aria-selected', String(i === active));
      });
    };

    function goTo(index) {
      active = ((index % total) + total) % total;
      update();
    }
    const move = (step) => goTo(active + step);

    $('.proc__nav--prev', carousel).addEventListener('click', () => move(-1));
    $('.proc__nav--next', carousel).addEventListener('click', () => move(1));

    // Clic en una tarjeta lateral para traerla al centro
    slides.forEach((slide, i) => {
      slide.addEventListener('click', (event) => {
        if (slide.dataset.pos === '0') return;
        event.preventDefault();
        goTo(i);
      });
    });

    // Botón reproducir / pausar de la tarjeta central
    slides.forEach((slide) => {
      const playBtn = $('.proc__play', slide);
      const video = $('video', slide);
      if (!playBtn || !video) return;
      playBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        if (video.paused) {
          playVideo(video, playBtn);
        } else {
          video.pause();
          playBtn.classList.remove('is-playing');
        }
      });
    });

    // Deslizar con el dedo o arrastrar con el ratón
    const track = $('.proc__track', carousel);
    let startX = null;
    track.addEventListener('pointerdown', (event) => { startX = event.clientX; });
    track.addEventListener('pointerup', (event) => {
      if (startX === null) return;
      const delta = event.clientX - startX;
      startX = null;
      if (Math.abs(delta) > 45) move(delta < 0 ? 1 : -1);
    });
    track.addEventListener('pointercancel', () => { startX = null; });

    // Teclado
    carousel.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft') move(-1);
      if (event.key === 'ArrowRight') move(1);
    });

    // Marcador cuando falta el archivo de video
    $$('.proc__media video', carousel).forEach((video) => {
      const markEmpty = () => video.closest('.proc__media').classList.add('is-empty');
      video.addEventListener('error', markEmpty);
      // Respaldo: sin fuente válida el navegador deja networkState en NETWORK_NO_SOURCE
      setTimeout(() => {
        if (video.networkState === 3 && video.readyState === 0) markEmpty();
      }, 1500);
    });

    update();
  }

  /* ---------- Líneas del infográfico (Sensores y tecnología del panel) ---------- */
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const techDiagram = $('.tech__diagram');
  const techSvg = $('.tech__lines');

  // Posición de un elemento dentro del diagrama SIN contar transformaciones,
  // así las animaciones de entrada (desplazamiento, zoom) no desvían las líneas.
  const offsetWithin = (el, ancestor) => {
    let x = 0;
    let y = 0;
    let node = el;
    while (node && node !== ancestor) {
      x += node.offsetLeft;
      y += node.offsetTop;
      node = node.offsetParent;
    }
    return { x, y };
  };

  const drawTechLines = () => {
    if (!techDiagram || !techSvg) return;
    while (techSvg.firstChild) techSvg.firstChild.remove();
    if (getComputedStyle(techSvg).display === 'none') return;

    const width = techDiagram.offsetWidth;
    const height = techDiagram.offsetHeight;
    if (!width || !height) return;
    techSvg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    techSvg.setAttribute('preserveAspectRatio', 'none');

    $$('.tech-card', techDiagram).forEach((card, index) => {
      const dot = $(`.tech__dot[data-anchor="${card.dataset.anchor}"]`, techDiagram);
      if (!dot) return;

      const c = offsetWithin(card, techDiagram);
      const d = offsetWithin(dot, techDiagram);
      const fromLeft = Boolean(card.closest('.tech__col--left'));

      // Punto de salida: centro del punto sobre la imagen
      const x1 = d.x + dot.offsetWidth / 2;
      const y1 = d.y + dot.offsetHeight / 2;
      // Punto de llegada: borde interior de la tarjeta, a media altura
      const x2 = fromLeft ? c.x + card.offsetWidth : c.x;
      const y2 = c.y + card.offsetHeight / 2;
      const bend = (x2 - x1) * 0.5;
      const path = `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`;

      ['tech__line-base', 'tech__line-pulse'].forEach((cls) => {
        const el = document.createElementNS(SVG_NS, 'path');
        el.setAttribute('d', path);
        el.setAttribute('pathLength', '1');
        el.setAttribute('class', cls);
        if (cls === 'tech__line-pulse') el.style.animationDelay = `${-index * 0.4}s`;
        techSvg.appendChild(el);
      });
    });
  };

  if (techDiagram) {
    let raf = 0;
    const scheduleDraw = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(drawTechLines);
    };
    scheduleDraw();
    window.addEventListener('load', scheduleDraw);
    window.addEventListener('resize', scheduleDraw);
    if ('ResizeObserver' in window) {
      new ResizeObserver(scheduleDraw).observe(techDiagram);
    }
    const techImg = $('.tech__image img');
    if (techImg) techImg.addEventListener('load', scheduleDraw);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(scheduleDraw);
  }

  /* ---------- Respaldo cuando faltan imágenes en /assets ---------- */
  $$('.frame img, .tech__image img, .team-card__photo img').forEach((img) => {
    const markEmpty = () => img.closest('[data-placeholder]').classList.add('is-empty');
    img.addEventListener('error', markEmpty);
    if (img.complete && img.naturalWidth === 0) markEmpty();
  });

  // Logo del menú y del footer: si falta el PNG se muestra el nombre en texto
  $$('.brand img, .footer__logo img').forEach((img) => {
    const useText = () => img.parentElement.classList.add('is-fallback');
    img.addEventListener('error', useText);
    if (img.complete && img.naturalWidth === 0) useText();
  });

  /* ---------- Año del footer ---------- */
  const year = $('#year');
  if (year) year.textContent = new Date().getFullYear();
})();
