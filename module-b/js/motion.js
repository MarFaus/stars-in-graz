/* Scroll motion. Optional: without this file the page is complete, only still. */
(function () {
  var root = document.documentElement;
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  var reveal = [
    '.section-title', '.schedule__hint', '.tickets__lead', '.tickets__main .button', '.venue__text p',
    '.tickets__facts > div', '.reviews__more .quote', '.quote--main', '.faq__item', '.footer__info',
    '.artist__text > *', '.footer__name'
  ].join(',');
  var photos = '.artist__photo, .venue__city, .reviews__photo, .venue__stage img';
  var hosts = '.artist, .venue__top, .reviews__feature, .venue__stage';

  /* A fully clipped photo has no visible area, so the observer watches its host instead. */
  var targets = new Map();
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        (targets.get(entry.target) || []).forEach(function (el) {
          el.classList.add('is-in');
        });
        io.unobserve(entry.target);
      }
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.05 });

  function watch(el, host) {
    var list = targets.get(host) || [];
    list.push(el);
    targets.set(host, list);
    io.observe(host);
  }

  [].slice.call(document.querySelectorAll(reveal)).forEach(function (el) {
    el.classList.add('reveal');
    var siblings = el.parentElement ? [].slice.call(el.parentElement.children) : [];
    el.style.transitionDelay = Math.min(siblings.indexOf(el), 4) * 70 + 'ms';
    watch(el, el);
  });
  [].slice.call(document.querySelectorAll(photos)).forEach(function (el) {
    el.classList.add('uncover');
    watch(el, el.closest(hosts));
  });
  root.classList.add('js');

  var stage = document.querySelector('.venue__stage');
  var ticking = false;

  function update() {
    var y = window.scrollY;
    var h = window.innerHeight;
    var max = root.scrollHeight - h;
    root.style.setProperty('--p', max > 0 ? Math.min(y / max, 1).toFixed(4) : '0');
    root.style.setProperty('--hero', Math.min(y / (h * 0.85), 1).toFixed(4));
    if (stage) {
      var r = stage.getBoundingClientRect();
      var t = (h - r.top) / (h + r.height);
      root.style.setProperty('--stage', Math.max(0, Math.min(t, 1)).toFixed(4));
    }
    ticking = false;
  }

  window.addEventListener('scroll', function () {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }, { passive: true });
  window.addEventListener('resize', update);
  update();
})();
