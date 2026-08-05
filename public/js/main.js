(function () {
  var dropdowns = document.querySelectorAll('.hover-dropdown');

  dropdowns.forEach(function (dropdown) {
    var trigger = dropdown.querySelector('.dropdown-trigger');
    if (!trigger) return;

    dropdown.addEventListener('mouseenter', function () {
      dropdown.classList.add('open');
    });
    dropdown.addEventListener('mouseleave', function () {
      dropdown.classList.remove('open');
      dropdown.querySelectorAll('.cat-item.open').forEach(function (item) {
        item.classList.remove('open');
      });
    });

    trigger.addEventListener('click', function (e) {
      e.stopPropagation();
      dropdown.classList.toggle('open');
    });
  });

  // Вкладені підменю підкатегорій (тільки в меню "Категорії")
  document.querySelectorAll('.cat-item').forEach(function (item) {
    var toggle = item.querySelector('.cat-toggle');
    if (!toggle) return;
    var dropdown = item.closest('.hover-dropdown');

    item.addEventListener('mouseenter', function () {
      item.classList.add('open');
    });
    item.addEventListener('mouseleave', function () {
      item.classList.remove('open');
    });

    toggle.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (dropdown) {
        dropdown.querySelectorAll('.cat-item.open').forEach(function (other) {
          if (other !== item) other.classList.remove('open');
        });
      }
      item.classList.toggle('open');
    });
  });

  document.addEventListener('click', function (e) {
    dropdowns.forEach(function (dropdown) {
      if (!dropdown.contains(e.target)) {
        dropdown.classList.remove('open');
        dropdown.querySelectorAll('.cat-item.open').forEach(function (item) {
          item.classList.remove('open');
        });
      }
    });
  });
})();

// Слайдер банера: автоперемикання + керування крапками
(function () {
  var hero = document.querySelector('.hero');
  if (!hero) return;
  var slides = Array.prototype.slice.call(hero.querySelectorAll('.hero-slide'));
  var dots = Array.prototype.slice.call(hero.querySelectorAll('.hero-dot'));
  if (slides.length < 2) return;

  var AUTOPLAY_MS = 5000;
  var current = 0;
  var timer = null;

  function showSlide(index) {
    slides[current].classList.remove('active');
    if (dots[current]) dots[current].classList.remove('active');
    current = (index + slides.length) % slides.length;
    slides[current].classList.add('active');
    if (dots[current]) dots[current].classList.add('active');
  }

  function nextSlide() {
    showSlide(current + 1);
  }

  function restartAutoplay() {
    if (timer) clearInterval(timer);
    timer = setInterval(nextSlide, AUTOPLAY_MS);
  }

  dots.forEach(function (dot, i) {
    dot.addEventListener('click', function () {
      showSlide(i);
      restartAutoplay();
    });
  });

  restartAutoplay();
})();

// Відступ під фіксовану шапку, щоб контент не ховався під нею
(function () {
  var header = document.querySelector('.site-header');
  if (!header) return;

  function applyBodyPadding() {
    document.body.style.paddingTop = header.offsetHeight + 'px';
  }

  applyBodyPadding();
  window.addEventListener('resize', applyBodyPadding);
})();

// Мобільне меню (гамбургер)
(function () {
  var toggle = document.querySelector('.menu-toggle');
  var menu = document.querySelector('.mobile-menu');
  var overlay = document.querySelector('.mobile-menu-overlay');
  var closeBtn = document.querySelector('.mobile-menu-close');
  if (!toggle || !menu) return;

  function openMenu() {
    menu.classList.add('open');
    if (overlay) overlay.classList.add('open');
    document.body.classList.add('menu-open');
  }

  function closeMenu() {
    menu.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
    document.body.classList.remove('menu-open');
  }

  toggle.addEventListener('click', openMenu);
  if (closeBtn) closeBtn.addEventListener('click', closeMenu);
  if (overlay) overlay.addEventListener('click', closeMenu);

  document.querySelectorAll('.mobile-cat-expand').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      var item = btn.closest('.mobile-cat-item');
      item.classList.toggle('expanded');
    });
  });
})();

// Кошик: спливаюча панель з товарами, лічильником та кнопками оформлення
var GoodFishCart = (function () {
  var overlay = document.querySelector('.cart-overlay');
  var modal = document.querySelector('.cart-modal');
  var closeBtn = document.querySelector('.cart-modal-close');
  var trigger = document.querySelector('.icon-cart');
  var badge = document.querySelector('.cart-badge');
  var emptyState = document.querySelector('.cart-empty');
  var itemsWrap = document.querySelector('.cart-items-wrap');
  var itemsList = document.querySelector('.cart-items-list');
  var totalValue = document.querySelector('.cart-total-value');
  var isRu = document.documentElement.lang === 'ru';

  if (!modal) {
    return { add: function () { return Promise.resolve(); }, refresh: function () {} };
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function photoMarkup(item) {
    if (item.image) {
      return '<img src="' + escapeHtml(item.image) + '" alt="" />';
    }
    return (
      '<svg class="icon-svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M3 12c3-4 8-6 13-4 2 .8 4 2.4 5 4-1 1.6-3 3.2-5 4-5 2-10 0-13-4z"/>' +
      '<circle cx="16" cy="10.8" r="0.7" fill="currentColor" stroke="none"/>' +
      '</svg>'
    );
  }

  function renderItem(item) {
    return (
      '<div class="cart-item" data-id="' + item.id + '">' +
        '<div class="cart-item-photo">' + photoMarkup(item) + '</div>' +
        '<div class="cart-item-info">' +
          '<p class="cart-item-name">' + escapeHtml(item.name) + '</p>' +
          '<div class="cart-item-row">' +
            '<div class="cart-item-qty">' +
              '<button type="button" class="cart-item-minus" aria-label="' + (isRu ? 'Меньше' : 'Менше') + '">−</button>' +
              '<span>' + item.quantity + '</span>' +
              '<button type="button" class="cart-item-plus" aria-label="' + (isRu ? 'Больше' : 'Більше') + '">+</button>' +
            '</div>' +
            '<span class="cart-item-price">' + item.lineTotal.toFixed(0) + ' ' + (isRu ? 'грн' : 'грн') + '</span>' +
            '<button type="button" class="cart-item-remove" aria-label="' + (isRu ? 'Удалить' : 'Видалити') + '">' +
              '<svg class="icon-svg" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="5" y1="5" x2="15" y2="15"></line><line x1="15" y1="5" x2="5" y2="15"></line></svg>' +
            '</button>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function render(data) {
    var count = data.count || 0;
    if (badge) {
      badge.textContent = count;
      badge.hidden = count === 0;
    }

    if (!data.items || data.items.length === 0) {
      if (emptyState) emptyState.classList.remove('hidden');
      if (itemsWrap) itemsWrap.classList.add('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');
    if (itemsWrap) itemsWrap.classList.remove('hidden');
    if (itemsList) itemsList.innerHTML = data.items.map(renderItem).join('');
    if (totalValue) totalValue.textContent = data.subtotal.toFixed(0) + ' ' + (isRu ? 'грн' : 'грн');
  }

  // Черга запитів: сервер читає й перезаписує кошик у сесії цілком, тож
  // паралельні POST /cart/* можуть загубити зміни одне одного — виконуємо їх послідовно.
  var queue = Promise.resolve();

  function post(url, params) {
    queue = queue.then(function () {
      return fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(params).toString(),
      }).then(function (r) { return r.json(); });
    });
    return queue;
  }

  function refresh() {
    return fetch('/cart/data', { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(render);
  }

  function add(productId, quantity) {
    return post('/cart/add', { productId: productId, quantity: quantity }).then(render);
  }

  function update(productId, quantity) {
    return post('/cart/update', { productId: productId, quantity: quantity }).then(render);
  }

  function remove(productId) {
    return post('/cart/remove', { productId: productId }).then(render);
  }

  function open() {
    refresh();
    modal.classList.add('open');
    if (overlay) overlay.classList.add('open');
    document.body.classList.add('cart-open');
  }

  function close() {
    modal.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
    document.body.classList.remove('cart-open');
  }

  if (trigger) {
    trigger.addEventListener('click', function (e) {
      e.preventDefault();
      open();
    });
  }
  if (closeBtn) closeBtn.addEventListener('click', close);
  if (overlay) overlay.addEventListener('click', close);
  document.querySelectorAll('.cart-continue').forEach(function (btn) {
    btn.addEventListener('click', close);
  });

  if (itemsList) {
    itemsList.addEventListener('click', function (e) {
      var row = e.target.closest('.cart-item');
      if (!row) return;
      var id = row.dataset.id;
      if (e.target.closest('.cart-item-remove')) {
        remove(id);
      } else if (e.target.closest('.cart-item-plus')) {
        var qtyEl = row.querySelector('.cart-item-qty span');
        update(id, parseInt(qtyEl.textContent, 10) + 1);
      } else if (e.target.closest('.cart-item-minus')) {
        var qtyEl2 = row.querySelector('.cart-item-qty span');
        var next = parseInt(qtyEl2.textContent, 10) - 1;
        if (next < 1) {
          remove(id);
        } else {
          update(id, next);
        }
      }
    });
  }

  refresh();

  return { add: add, refresh: refresh };
})();

// Бокова панель категорій на сторінці каталогу: розгортання підкатегорій
(function () {
  document.querySelectorAll('.sidebar-cat-item').forEach(function (item) {
    var btn = item.querySelector('.sidebar-cat-expand');
    var children = item.querySelector('.sidebar-cat-children');
    if (!btn || !children) return;

    item.addEventListener('mouseenter', function () {
      btn.classList.add('open');
      children.classList.add('open');
    });
    item.addEventListener('mouseleave', function () {
      btn.classList.remove('open');
      children.classList.remove('open');
    });

    btn.addEventListener('click', function (e) {
      e.preventDefault();
      btn.classList.toggle('open');
      children.classList.toggle('open');
    });
  });
})();

// Quick Add: кнопка на фото товару відкриває лічильник кількості
(function () {
  var openCards = [];

  document.querySelectorAll('.product-card').forEach(function (card) {
    var btn = card.querySelector('.quick-add-btn');
    var panel = card.querySelector('.quick-add-panel');
    if (!btn || !panel) return;

    var price = parseFloat(card.dataset.price) || 0;
    var valueEl = panel.querySelector('.qty-value');
    var inputEl = panel.querySelector('.qty-input');
    var totalEl = panel.querySelector('.qty-total');
    var minus = panel.querySelector('.qty-minus');
    var plus = panel.querySelector('.qty-plus');
    var cancel = panel.querySelector('.qty-cancel');
    var submit = panel.querySelector('.qty-submit');
    var productId = card.dataset.productId;

    function render(qty) {
      valueEl.textContent = qty;
      inputEl.value = qty;
      totalEl.textContent = (price * qty).toFixed(0);
    }

    function openPanel() {
      panel.classList.remove('hidden');
      btn.classList.add('hidden');
      openCards.push(card);
    }

    function closePanel() {
      panel.classList.add('hidden');
      btn.classList.remove('hidden');
      render(1);
      openCards = openCards.filter(function (c) { return c !== card; });
    }

    btn.addEventListener('click', openPanel);
    if (cancel) cancel.addEventListener('click', closePanel);

    minus.addEventListener('click', function () {
      var qty = Math.max(1, parseInt(inputEl.value, 10) - 1);
      render(qty);
    });
    plus.addEventListener('click', function () {
      var qty = parseInt(inputEl.value, 10) + 1;
      render(qty);
    });

    if (submit) {
      submit.addEventListener('click', function () {
        var qty = parseInt(inputEl.value, 10) || 1;
        submit.disabled = true;
        GoodFishCart.add(productId, qty).then(function () {
          submit.disabled = false;
          closePanel();
        });
      });
    }

    card._closeQuickAdd = closePanel;
  });

  document.addEventListener('click', function (e) {
    openCards.slice().forEach(function (card) {
      if (!card.contains(e.target) && card._closeQuickAdd) {
        card._closeQuickAdd();
      }
    });
  });
})();

// Сторінка товару: лічильник кількості + додати в кошик (панель завжди відкрита)
(function () {
  var info = document.querySelector('.product-detail-info');
  if (!info) return;

  var productId = info.dataset.productId;
  var price = parseFloat(info.dataset.price) || 0;
  var panel = info.querySelector('.pd-add-panel');
  if (!panel) return;

  var valueEl = panel.querySelector('.qty-value');
  var inputEl = panel.querySelector('.qty-input');
  var totalEl = panel.querySelector('.qty-total');
  var minus = panel.querySelector('.qty-minus');
  var plus = panel.querySelector('.qty-plus');
  var submit = panel.querySelector('.qty-submit');

  function render(qty) {
    valueEl.textContent = qty;
    inputEl.value = qty;
    totalEl.textContent = (price * qty).toFixed(0);
  }

  minus.addEventListener('click', function () {
    var qty = Math.max(1, parseInt(inputEl.value, 10) - 1);
    render(qty);
  });
  plus.addEventListener('click', function () {
    var qty = parseInt(inputEl.value, 10) + 1;
    render(qty);
  });

  submit.addEventListener('click', function () {
    var qty = parseInt(inputEl.value, 10) || 1;
    submit.disabled = true;
    GoodFishCart.add(productId, qty).then(function () {
      submit.disabled = false;
    });
  });
})();

// Галерея фото товару: перемикання через мініатюри та стрілки
(function () {
  var gallery = document.querySelector('.pd-gallery');
  if (!gallery) return;

  var mainImg = gallery.querySelector('.pd-gallery-main-img');
  var thumbs = Array.prototype.slice.call(gallery.querySelectorAll('.pd-gallery-thumb'));
  var prevBtn = gallery.querySelector('.pd-gallery-prev');
  var nextBtn = gallery.querySelector('.pd-gallery-next');
  if (!mainImg || thumbs.length === 0) return;

  var current = 0;

  function show(index) {
    current = (index + thumbs.length) % thumbs.length;
    mainImg.src = thumbs[current].querySelector('img').src;
    thumbs.forEach(function (t, i) {
      t.classList.toggle('active', i === current);
    });
  }

  thumbs.forEach(function (thumb, i) {
    thumb.addEventListener('click', function () {
      show(i);
    });
  });

  if (prevBtn) prevBtn.addEventListener('click', function () { show(current - 1); });
  if (nextBtn) nextBtn.addEventListener('click', function () { show(current + 1); });
})();

// Сортування каталогу категорії без перезавантаження сторінки
(function () {
  var select = document.querySelector('#sortSelect');
  var catalogMain = document.querySelector('.catalog-main');
  var grids = catalogMain
    ? Array.prototype.slice.call(catalogMain.querySelectorAll('.products-grid'))
    : [];
  if (!select || !grids.length) return;

  var CHUNK_SIZE = 5;

  var sortKeys = {
    popular: function (card) { return -parseFloat(card.dataset.orderCount || '0'); },
    'price-asc': function (card) { return parseFloat(card.dataset.price || '0'); },
    'price-desc': function (card) { return -parseFloat(card.dataset.price || '0'); },
    name: function (card) {
      var h3 = card.querySelector('h3');
      return h3 ? h3.textContent.trim().toLowerCase() : '';
    },
    newest: function (card) { return -parseFloat(card.dataset.productId || '0'); },
  };

  select.addEventListener('change', function () {
    var sort = select.value;
    var keyFn = sortKeys[sort] || sortKeys.popular;
    var cards = [];
    grids.forEach(function (g) {
      cards = cards.concat(Array.prototype.slice.call(g.querySelectorAll('.product-card')));
    });

    cards.sort(function (a, b) {
      var ka = keyFn(a);
      var kb = keyFn(b);
      if (ka < kb) return -1;
      if (ka > kb) return 1;
      return 0;
    });

    grids.forEach(function (g, gridIndex) {
      var group = cards.slice(gridIndex * CHUNK_SIZE, gridIndex * CHUNK_SIZE + CHUNK_SIZE);
      group.forEach(function (card) { g.appendChild(card); });
    });

    var url = new URL(window.location.href);
    url.searchParams.set('sort', sort);
    window.history.replaceState({}, '', url);
  });
})();


// Каруселька популярних категорій: стрілки гортають по 3 картки
(function () {
  document.querySelectorAll('.category-carousel').forEach(function (carousel) {
    var track = carousel.querySelector('.category-carousel-track');
    var prevBtn = carousel.querySelector('.category-carousel-prev');
    var nextBtn = carousel.querySelector('.category-carousel-next');
    if (!track || !prevBtn || !nextBtn) return;

    function pageWidth() {
      var card = track.querySelector('.category-tile');
      if (!card) return track.clientWidth;
      var gap = parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap || 0);
      return card.getBoundingClientRect().width + gap;
    }

    function updateButtons() {
      var maxScroll = track.scrollWidth - track.clientWidth;
      prevBtn.disabled = track.scrollLeft <= 2;
      nextBtn.disabled = track.scrollLeft >= maxScroll - 2;
    }

    prevBtn.addEventListener('click', function () {
      track.scrollBy({ left: -pageWidth() * 3, behavior: 'smooth' });
    });
    nextBtn.addEventListener('click', function () {
      track.scrollBy({ left: pageWidth() * 3, behavior: 'smooth' });
    });

    track.addEventListener('scroll', updateButtons, { passive: true });
    window.addEventListener('resize', updateButtons);
    updateButtons();
  });
})();
