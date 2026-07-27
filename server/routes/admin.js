const express = require('express');
const router = express.Router();
const db = require('../db');
const upload = require('../upload');

function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.redirect('/admin/login');
}

// Наскрізна нумерація фото-блоків: 1 = банер, далі для кожної категорії
// (обкладинка + міні-іконка), далі товари.
function buildSlots() {
  const categories = db.getCategories();
  const products = db.getProducts();

  let slot = 1;
  const heroSlot = slot++;
  const categorySlots = {};
  const categoryIconSlots = {};
  categories.forEach((c) => {
    categorySlots[c.id] = slot++;
    categoryIconSlots[c.id] = slot++;
  });
  const productSlots = {};
  products.forEach((p) => (productSlots[p.id] = slot++));

  return { heroSlot, categorySlots, categoryIconSlots, productSlots };
}

// --- Auth ---
router.get('/login', (req, res) => {
  res.render('admin/login', { error: null });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
    req.session.isAdmin = true;
    return res.redirect('/admin');
  }
  res.render('admin/login', { error: 'Невірний логін або пароль' });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});

router.use(requireAuth);

// --- Хаб адмін-панелі ---
router.get('/', (req, res) => {
  res.render('admin/dashboard', {
    settings: db.getSettings(),
    ordersCount: db.getOrders().length,
    leadsCount: db.getLeads().length,
    categoriesCount: db.getCategories().length,
    productsCount: db.getProducts().length,
    promotionsCount: db.getPromotions().length,
  });
});

// --- Налаштування сайту ---
router.get('/settings', (req, res) => {
  const { heroSlot } = buildSlots();
  res.render('admin/settings', { settings: db.getSettings(), heroSlot });
});

router.post('/settings', upload.single('heroImage'), upload.processUploadedImages(upload.heroImageOptions), (req, res) => {
  const patch = { ...req.body };
  delete patch.phonesText;

  const phones = (req.body.phonesText || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [number, labelUa, labelRu] = line.split('|').map((s) => s.trim());
      return { number: number || '', label_ua: labelUa || '', label_ru: labelRu || labelUa || '' };
    })
    .filter((p) => p.number);
  if (phones.length > 0) patch.phones = phones;

  if (req.file) {
    patch.heroImage = '/uploads/' + req.file.filename;
  }
  db.updateSettings(patch);
  res.redirect('/admin/settings');
});

// --- Фото-блоки (легенда номерів) ---
router.get('/photo-slots', (req, res) => {
  const { heroSlot, categorySlots, categoryIconSlots, productSlots } = buildSlots();
  res.render('admin/photo-slots', {
    categories: db.getCategories(),
    products: db.getProducts(),
    heroSlot,
    categorySlots,
    categoryIconSlots,
    productSlots,
  });
});

// --- Заявки на зворотній зв'язок ---
router.get('/leads', (req, res) => {
  res.render('admin/leads', { leads: db.getLeads() });
});

router.post('/leads/:id/delete', (req, res) => {
  db.deleteLead(req.params.id);
  res.redirect('/admin/leads');
});

// --- Categories ---
router.get('/categories', (req, res) => {
  const { categorySlots, categoryIconSlots } = buildSlots();
  res.render('admin/categories', {
    categories: db.getCategoriesForSelect(),
    categorySlots,
    categoryIconSlots,
  });
});

router.get('/categories/new', (req, res) => {
  res.render('admin/category-form', { category: null, topLevelCategories: db.getTopLevelCategories() });
});

const categoryImageUpload = upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'iconImage', maxCount: 1 },
]);

router.post('/categories', categoryImageUpload, upload.processUploadedImages(), (req, res) => {
  const category = db.createCategory(req.body);
  const patch = {};
  if (req.files && req.files.image) patch.image = '/uploads/' + req.files.image[0].filename;
  if (req.files && req.files.iconImage) patch.iconImage = '/uploads/' + req.files.iconImage[0].filename;
  if (Object.keys(patch).length) db.updateCategory(category.id, patch);
  res.redirect('/admin/categories');
});

router.get('/categories/:id/edit', (req, res) => {
  const category = db.getCategory(req.params.id);
  if (!category) return res.redirect('/admin/categories');
  res.render('admin/category-form', { category, topLevelCategories: db.getTopLevelCategories() });
});

router.post('/categories/:id', categoryImageUpload, upload.processUploadedImages(), (req, res) => {
  const patch = { ...req.body };
  if (req.files && req.files.image) patch.image = '/uploads/' + req.files.image[0].filename;
  if (req.files && req.files.iconImage) patch.iconImage = '/uploads/' + req.files.iconImage[0].filename;
  db.updateCategory(req.params.id, patch);
  res.redirect('/admin/categories');
});

router.post('/categories/:id/delete', (req, res) => {
  db.deleteCategory(req.params.id);
  res.redirect('/admin/categories');
});

// --- Products ---
router.get('/products', (req, res) => {
  const { productSlots } = buildSlots();
  res.render('admin/products', {
    products: db.getProducts(),
    categories: db.getCategoriesForSelect(),
    productSlots,
  });
});

router.get('/products/new', (req, res) => {
  res.render('admin/product-form', { product: null, categories: db.getCategoriesForSelect() });
});

const productImageUpload = upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'galleryImages', maxCount: 8 },
]);

router.post('/products', productImageUpload, upload.processUploadedImages(), (req, res) => {
  const product = db.createProduct(req.body);
  const patch = {};
  if (req.files && req.files.image) patch.image = '/uploads/' + req.files.image[0].filename;
  if (Object.keys(patch).length) db.updateProduct(product.id, patch);
  if (req.files && req.files.galleryImages) {
    db.addProductGalleryImages(product.id, req.files.galleryImages.map((f) => '/uploads/' + f.filename));
  }
  res.redirect('/admin/products');
});

router.get('/products/:id/edit', (req, res) => {
  const product = db.getProduct(req.params.id);
  if (!product) return res.redirect('/admin/products');
  res.render('admin/product-form', { product, categories: db.getCategoriesForSelect() });
});

router.post('/products/:id', productImageUpload, upload.processUploadedImages(), (req, res) => {
  const patch = { ...req.body };
  delete patch.galleryImages;
  if (req.files && req.files.image) patch.image = '/uploads/' + req.files.image[0].filename;
  if (patch.oldPrice === '') patch.oldPrice = null;
  db.updateProduct(req.params.id, patch);
  if (req.files && req.files.galleryImages) {
    db.addProductGalleryImages(req.params.id, req.files.galleryImages.map((f) => '/uploads/' + f.filename));
  }
  res.redirect(`/admin/products/${req.params.id}/edit`);
});

router.post('/products/:id/gallery/:index/delete', (req, res) => {
  db.removeProductGalleryImage(req.params.id, req.params.index);
  res.redirect(`/admin/products/${req.params.id}/edit`);
});

router.post('/products/:id/delete', (req, res) => {
  db.deleteProduct(req.params.id);
  res.redirect('/admin/products');
});

// --- Замовлення ---
router.get('/orders', (req, res) => {
  const orders = db.getOrders().slice().reverse();
  res.render('admin/orders', { orders });
});

router.get('/orders/:id', (req, res) => {
  const order = db.getOrder(req.params.id);
  if (!order) return res.redirect('/admin/orders');
  res.render('admin/order-detail', { order });
});

router.post('/orders/:id/status', (req, res) => {
  db.updateOrderStatus(req.params.id, req.body.status);
  res.redirect('/admin/orders');
});

router.post('/orders/:id/item/:productId/availability', (req, res) => {
  db.setOrderItemAvailability(req.params.id, req.params.productId, req.body.available === '1');
  res.redirect(`/admin/orders/${req.params.id}`);
});

router.post('/orders/:id/item/:productId/delete', (req, res) => {
  db.removeOrderItem(req.params.id, req.params.productId);
  res.redirect(`/admin/orders/${req.params.id}`);
});

// --- Акції ---
router.get('/promotions', (req, res) => {
  res.render('admin/promotions', { promotions: db.getPromotions().slice().reverse() });
});

router.get('/promotions/new', (req, res) => {
  res.render('admin/promotion-form', { promotion: null });
});

router.post('/promotions', (req, res) => {
  db.createPromotion(req.body);
  res.redirect('/admin/promotions');
});

router.get('/promotions/:id/edit', (req, res) => {
  const promotion = db.getPromotion(req.params.id);
  if (!promotion) return res.redirect('/admin/promotions');
  res.render('admin/promotion-form', { promotion });
});

router.post('/promotions/:id', (req, res) => {
  db.updatePromotion(req.params.id, req.body);
  res.redirect('/admin/promotions');
});

router.post('/promotions/:id/delete', (req, res) => {
  db.deletePromotion(req.params.id);
  res.redirect('/admin/promotions');
});

module.exports = router;
