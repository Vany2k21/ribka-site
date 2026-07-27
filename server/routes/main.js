const express = require('express');
const router = express.Router();
const db = require('../db');
const { getCartWithProducts } = require('./cart');
const { sendOrderNotification } = require('../telegram');

// Наскрізна нумерація фото-блоків: 1 = банер, далі для кожної категорії
// (обкладинка + міні-іконка), далі товари.
function buildSlots() {
  const allCategories = db.getCategories();
  const products = db.getProducts();

  let slot = 1;
  const heroSlot = slot++;
  const categorySlots = {};
  const categoryIconSlots = {};
  allCategories.forEach((c) => {
    categorySlots[c.id] = slot++;
    categoryIconSlots[c.id] = slot++;
  });
  const productSlots = {};
  products.forEach((p) => (productSlots[p.id] = slot++));

  return { heroSlot, categorySlots, categoryIconSlots, productSlots };
}

const SORT_OPTIONS = ['popular', 'price-asc', 'price-desc', 'name', 'newest'];

function sortProducts(products, sort) {
  const arr = [...products];
  switch (sort) {
    case 'price-asc':
      return arr.sort((a, b) => a.price - b.price);
    case 'price-desc':
      return arr.sort((a, b) => b.price - a.price);
    case 'name':
      return arr.sort((a, b) => a.name_ua.localeCompare(b.name_ua, 'uk'));
    case 'newest':
      return arr.sort((a, b) => b.id - a.id);
    case 'popular':
    default:
      return arr.sort((a, b) => (b.orderCount || 0) - (a.orderCount || 0));
  }
}

router.get('/', (req, res) => {
  const settings = db.getSettings();
  const categoryTree = db.getCategoryTree();
  const popular = db.getPopularCategories(6);
  const bestsellers = db.getBestsellers(10);
  const { heroSlot, categorySlots, categoryIconSlots, productSlots } = buildSlots();

  const popularCategories = popular.map((c) => ({
    ...c,
    slot: categorySlots[c.id],
    iconSlot: categoryIconSlots[c.id],
  }));

  const bestsellerProducts = bestsellers.map((p) => ({ ...p, slot: productSlots[p.id] }));

  res.render('home', {
    settings,
    categories: categoryTree,
    heroSlot,
    heroSlides: db.getHeroSlides(),
    popularCategories,
    bestsellerProducts,
  });
});

router.get('/categories', (req, res) => {
  const settings = db.getSettings();
  const categoryTree = db.getCategoryTree();
  const { categorySlots, categoryIconSlots } = buildSlots();

  const categories = categoryTree.map((c) => ({
    ...c,
    slot: categorySlots[c.id],
    iconSlot: categoryIconSlots[c.id],
    children: c.children.map((sc) => ({
      ...sc,
      slot: categorySlots[sc.id],
      iconSlot: categoryIconSlots[sc.id],
    })),
  }));

  res.render('categories', { settings, categories });
});

router.get('/category/:slug', (req, res) => {
  const result = db.getCategoryBySlugWithProducts(req.params.slug);
  if (!result || result.products.length === 0) return res.redirect('/');

  const settings = db.getSettings();
  const categoryTree = db.getCategoryTree();
  const { heroSlot, categorySlots, productSlots } = buildSlots();

  const sort = SORT_OPTIONS.includes(req.query.sort) ? req.query.sort : 'popular';
  const sortedProducts = sortProducts(result.products, sort);

  const productsByCategory = [
    {
      category: result.category,
      slot: categorySlots[result.category.id],
      products: sortedProducts.map((p) => ({ ...p, slot: productSlots[p.id] })),
    },
  ];

  res.render('index', {
    settings,
    categories: categoryTree,
    heroSlot,
    productsByCategory,
    activeCategory: result.category,
    activeParent: result.parent,
    currentSort: sort,
  });
});

router.get('/product/:slug', (req, res) => {
  const product = db.getProductBySlug(req.params.slug);
  if (!product) return res.redirect('/');

  const category = db.getCategory(product.categoryId);
  const { productSlots } = buildSlots();

  const relatedProducts = db
    .getProductsByCategory(product.categoryId)
    .filter((p) => p.id !== product.id)
    .slice(0, 4)
    .map((p) => ({ ...p, slot: productSlots[p.id] }));

  const galleryImages = [product.image, ...(product.images || [])].filter(Boolean);

  res.render('product', {
    settings: db.getSettings(),
    categories: db.getCategoryTree(),
    product: { ...product, slot: productSlots[product.id] },
    galleryImages,
    category,
    relatedProducts,
  });
});

router.get('/checkout', (req, res) => {
  const cart = getCartWithProducts(req);
  if (cart.length === 0) return res.redirect('/');

  const settings = db.getSettings();
  const subtotal = cart.reduce((sum, i) => sum + i.lineTotal, 0);
  const currentUser = req.session.userId ? db.getUser(req.session.userId) : null;

  res.render('checkout', {
    settings,
    categories: db.getCategoryTree(),
    cart,
    subtotal,
    currentUser,
    formError: null,
  });
});

router.post('/checkout', (req, res) => {
  const cart = getCartWithProducts(req);
  if (cart.length === 0) return res.redirect('/');

  const { email, firstName, lastName, phone, deliveryMethod, paymentMethod, comment } = req.body;
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!email || !EMAIL_RE.test(email.trim()) || !firstName || !firstName.trim() || !phone || !phone.trim()) {
    const settings = db.getSettings();
    const subtotal = cart.reduce((sum, i) => sum + i.lineTotal, 0);
    const currentUser = req.session.userId ? db.getUser(req.session.userId) : null;
    return res.render('checkout', {
      settings,
      categories: db.getCategoryTree(),
      cart,
      subtotal,
      currentUser,
      formError: "Заповніть обов'язкові поля: email, ім'я, телефон.",
    });
  }

  const order = db.createOrder({
    email,
    firstName,
    lastName,
    phone,
    deliveryMethod: ['kyiv', 'pickup', 'nova-poshta'].includes(deliveryMethod) ? deliveryMethod : 'pickup',
    paymentMethod: ['bank', 'cash'].includes(paymentMethod) ? paymentMethod : 'cash',
    comment,
    userId: req.session.userId || null,
    items: cart.map(({ product, quantity }) => ({
      productId: product.id,
      name_ua: product.name_ua,
      name_ru: product.name_ru,
      price: product.price,
      quantity,
      unitType: product.unitType,
      image: product.image,
    })),
  });

  cart.forEach(({ product, quantity }) => db.incrementProductOrderCount(product.id, quantity));
  req.session.cart = {};
  sendOrderNotification(order).catch(() => {});

  res.redirect(`/checkout/success?order=${order.id}`);
});

router.get('/checkout/success', (req, res) => {
  const order = db.getOrder(req.query.order);
  if (!order) return res.redirect('/');
  res.render('checkout-success', {
    settings: db.getSettings(),
    categories: db.getCategoryTree(),
    order,
  });
});

router.post('/callback-request', (req, res) => {
  const { name, phone } = req.body;
  const back = req.get('Referer') || '/';
  if (!name || !name.trim() || !phone || !phone.trim()) {
    return res.redirect(back);
  }
  db.createLead({ name: name.trim(), phone: phone.trim() });
  const separator = back.includes('?') ? '&' : '?';
  res.redirect(`${back}${separator}callback=1`);
});

router.get('/lang/:lang', (req, res) => {
  const lang = req.params.lang === 'ru' ? 'ru' : 'ua';
  res.cookie('lang', lang, { maxAge: 365 * 24 * 60 * 60 * 1000 });
  const back = req.get('Referer') || '/';
  res.redirect(back);
});

module.exports = router;
