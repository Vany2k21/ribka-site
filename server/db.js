const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');

function read() {
  const raw = fs.readFileSync(DB_PATH, 'utf-8');
  return JSON.parse(raw);
}

function write(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

// --- Settings ---
function getSettings() {
  return read().settings;
}

function updateSettings(patch) {
  const data = read();
  data.settings = { ...data.settings, ...patch };
  write(data);
  return data.settings;
}

// --- Categories ---
function getCategories() {
  return read().categories;
}

function getCategory(id) {
  return read().categories.find((c) => c.id === Number(id));
}

function getCategoriesWithProducts() {
  const data = read();
  return data.categories
    .map((c) => ({
      ...c,
      productCount: data.products.filter((p) => p.categoryId === c.id).length,
    }))
    .filter((c) => c.productCount > 0);
}

// Верхньорівневі категорії з підкатегоріями (для меню). Кількість товарів
// у батьківській категорії включає товари всіх її підкатегорій.
function getCategoryTree() {
  const data = read();
  const countFor = (catId) => data.products.filter((p) => p.categoryId === catId).length;

  return data.categories
    .filter((c) => !c.parentId)
    .map((c) => {
      const children = data.categories
        .filter((s) => s.parentId === c.id)
        .map((s) => ({ ...s, productCount: countFor(s.id) }))
        .filter((s) => s.productCount > 0);
      const productCount = countFor(c.id) + children.reduce((sum, s) => sum + s.productCount, 0);
      return { ...c, productCount, children };
    })
    .filter((c) => c.productCount > 0);
}

// Найпопулярніші верхньорівневі категорії за сумою замовлень товарів (включно з підкатегоріями).
function getPopularCategories(limit) {
  const data = read();
  const orderCountFor = (catId) =>
    data.products.filter((p) => p.categoryId === catId).reduce((sum, p) => sum + (p.orderCount || 0), 0);
  const productCountFor = (catId) => data.products.filter((p) => p.categoryId === catId).length;

  const withPopularity = data.categories
    .filter((c) => !c.parentId)
    .map((c) => {
      const childIds = data.categories.filter((s) => s.parentId === c.id).map((s) => s.id);
      const productCount = productCountFor(c.id) + childIds.reduce((sum, id) => sum + productCountFor(id), 0);
      const orderCount = orderCountFor(c.id) + childIds.reduce((sum, id) => sum + orderCountFor(id), 0);
      return { ...c, productCount, orderCount };
    })
    .filter((c) => c.productCount > 0)
    .sort((a, b) => b.orderCount - a.orderCount);

  return typeof limit === 'number' ? withPopularity.slice(0, limit) : withPopularity;
}

// Товари категорії за slug: якщо категорія має підкатегорії — товари з усіх них теж враховуються.
function getCategoryBySlugWithProducts(slug) {
  const data = read();
  const category = data.categories.find((c) => c.slug === slug);
  if (!category) return null;
  const childIds = data.categories.filter((c) => c.parentId === category.id).map((c) => c.id);
  const relevantIds = [category.id, ...childIds];
  const products = data.products.filter((p) => relevantIds.includes(p.categoryId));
  const parent = category.parentId ? data.categories.find((c) => c.id === category.parentId) : null;
  return { category, products, parent };
}

function getTopLevelCategories() {
  return read().categories.filter((c) => !c.parentId);
}

// Пласкій список для селектів в адмінці: батьківська категорія, одразу за нею її підкатегорії.
function getCategoriesForSelect() {
  const data = read();
  const result = [];
  data.categories
    .filter((c) => !c.parentId)
    .forEach((c) => {
      result.push({ ...c, depth: 0 });
      data.categories
        .filter((s) => s.parentId === c.id)
        .forEach((s) => result.push({ ...s, depth: 1 }));
    });
  return result;
}

function createCategory({ name_ua, name_ru, desc_ua, desc_ru, parentId }) {
  const data = read();
  const id = data.nextCategoryId++;
  const slug = slugify(name_ua) + '-' + id;
  const category = {
    id,
    slug,
    name_ua,
    name_ru,
    desc_ua: desc_ua || '',
    desc_ru: desc_ru || '',
    image: null,
    iconImage: null,
    parentId: parentId ? Number(parentId) : null,
  };
  data.categories.push(category);
  write(data);
  return category;
}

function updateCategory(id, patch) {
  const data = read();
  const idx = data.categories.findIndex((c) => c.id === Number(id));
  if (idx === -1) return null;
  const normalized = { ...patch };
  if ('parentId' in normalized) {
    normalized.parentId = normalized.parentId ? Number(normalized.parentId) : null;
  }
  data.categories[idx] = { ...data.categories[idx], ...normalized };
  write(data);
  return data.categories[idx];
}

function deleteCategory(id) {
  const data = read();
  const catId = Number(id);
  const childIds = data.categories.filter((c) => c.parentId === catId).map((c) => c.id);
  const idsToRemove = [catId, ...childIds];
  data.categories = data.categories.filter((c) => !idsToRemove.includes(c.id));
  data.products = data.products.filter((p) => !idsToRemove.includes(p.categoryId));
  write(data);
}

// --- Products ---
function getProducts() {
  return read().products;
}

function getProductsByCategory(categoryId) {
  return read().products.filter((p) => p.categoryId === Number(categoryId));
}

function getProduct(id) {
  return read().products.find((p) => p.id === Number(id));
}

function getProductBySlug(slug) {
  return read().products.find((p) => p.slug === slug);
}

// Лідери продажів: товари з найбільшою кількістю замовлень.
// Якщо реальних замовлень менше за ліміт — решту місць займають випадкові товари.
function getBestsellers(limit) {
  const products = read().products;
  const sorted = [...products].sort((a, b) => (b.orderCount || 0) - (a.orderCount || 0));
  const withOrders = sorted.filter((p) => (p.orderCount || 0) > 0);
  const withoutOrders = sorted.filter((p) => !(p.orderCount || 0));

  const result = withOrders.slice(0, limit);
  if (result.length < limit) {
    const needed = limit - result.length;
    const shuffled = withoutOrders
      .map((p) => ({ p, sortKey: Math.random() }))
      .sort((a, b) => a.sortKey - b.sortKey)
      .map((x) => x.p);
    result.push(...shuffled.slice(0, needed));
  }
  return result;
}

function createProduct(product) {
  const data = read();
  const id = data.nextProductId++;
  const slug = slugify(product.name_ua || 'tovar') + '-' + id;
  const newProduct = {
    id,
    slug,
    categoryId: Number(product.categoryId),
    name_ua: product.name_ua || '',
    name_ru: product.name_ru || '',
    desc_ua: product.desc_ua || '',
    desc_ru: product.desc_ru || '',
    price: Number(product.price) || 0,
    oldPrice: product.oldPrice ? Number(product.oldPrice) : null,
    unit_ua: product.unit_ua || 'грн/кг',
    unit_ru: product.unit_ru || 'грн/кг',
    unitType: product.unitType === 'pcs' ? 'pcs' : 'kg',
    image: null,
    images: [],
    orderCount: Number(product.orderCount) || 0,
  };
  data.products.push(newProduct);
  write(data);
  return newProduct;
}

function addProductGalleryImages(id, filePaths) {
  const data = read();
  const product = data.products.find((p) => p.id === Number(id));
  if (!product) return null;
  if (!product.images) product.images = [];
  product.images.push(...filePaths);
  write(data);
  return product;
}

function removeProductGalleryImage(id, index) {
  const data = read();
  const product = data.products.find((p) => p.id === Number(id));
  if (!product || !product.images) return null;
  product.images.splice(Number(index), 1);
  write(data);
  return product;
}

function incrementProductOrderCount(id, amount = 1) {
  const data = read();
  const idx = data.products.findIndex((p) => p.id === Number(id));
  if (idx === -1) return null;
  const qty = Math.max(1, Math.round(Number(amount)) || 1);
  data.products[idx].orderCount = (data.products[idx].orderCount || 0) + qty;
  write(data);
  return data.products[idx];
}

function updateProduct(id, patch) {
  const data = read();
  const idx = data.products.findIndex((p) => p.id === Number(id));
  if (idx === -1) return null;
  const normalized = { ...patch };
  if ('categoryId' in normalized) normalized.categoryId = Number(normalized.categoryId);
  if ('price' in normalized) normalized.price = Number(normalized.price) || 0;
  if ('oldPrice' in normalized) {
    normalized.oldPrice = normalized.oldPrice ? Number(normalized.oldPrice) : null;
  }
  if ('orderCount' in normalized) {
    normalized.orderCount = Number(normalized.orderCount) || 0;
  }
  if ('unitType' in normalized) {
    normalized.unitType = normalized.unitType === 'pcs' ? 'pcs' : 'kg';
  }
  data.products[idx] = { ...data.products[idx], ...normalized };
  write(data);
  return data.products[idx];
}

function deleteProduct(id) {
  const data = read();
  data.products = data.products.filter((p) => p.id !== Number(id));
  write(data);
}

// --- Users (customer accounts) ---
function getUserByEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  return read().users.find((u) => u.email === normalized);
}

function getUser(id) {
  return read().users.find((u) => u.id === Number(id));
}

function createUser({ name, email, passwordHash }) {
  const data = read();
  const id = data.nextUserId++;
  const user = {
    id,
    name,
    email: String(email).trim().toLowerCase(),
    phone: '',
    address: '',
    passwordHash,
    createdAt: new Date().toISOString(),
  };
  data.users.push(user);
  write(data);
  return user;
}

function updateUserProfile(id, { name, phone, address }) {
  const data = read();
  const user = data.users.find((u) => u.id === Number(id));
  if (!user) return null;
  if (name !== undefined) user.name = name;
  if (phone !== undefined) user.phone = phone;
  if (address !== undefined) user.address = address;
  write(data);
  return user;
}

function updateUserPassword(id, passwordHash) {
  const data = read();
  const user = data.users.find((u) => u.id === Number(id));
  if (!user) return null;
  user.passwordHash = passwordHash;
  write(data);
  return user;
}

// --- Заявки на зворотній зв'язок ---
function getLeads() {
  return read().leads;
}

function createLead({ name, phone }) {
  const data = read();
  const id = data.nextLeadId++;
  const lead = { id, name, phone, createdAt: new Date().toISOString() };
  data.leads.push(lead);
  write(data);
  return lead;
}

function deleteLead(id) {
  const data = read();
  data.leads = data.leads.filter((l) => l.id !== Number(id));
  write(data);
}

// --- Замовлення ---
function getOrders() {
  return read().orders;
}

function getOrder(id) {
  return read().orders.find((o) => o.id === Number(id));
}

function getOrdersByUser(userId) {
  return read().orders.filter((o) => o.userId === Number(userId));
}

function createOrder({ email, firstName, lastName, phone, deliveryMethod, paymentMethod, comment, items, userId }) {
  const data = read();
  const id = data.nextOrderId++;
  const normalizedItems = items.map((i) => ({
    productId: i.productId,
    name_ua: i.name_ua,
    name_ru: i.name_ru,
    price: i.price,
    quantity: i.quantity,
    unitType: i.unitType,
    image: i.image || null,
    available: true,
  }));
  const total = normalizedItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const order = {
    id,
    email: (email || '').trim(),
    firstName: (firstName || '').trim(),
    lastName: (lastName || '').trim(),
    phone: (phone || '').trim(),
    deliveryMethod,
    paymentMethod,
    comment: (comment || '').trim(),
    items: normalizedItems,
    total,
    status: 'processing',
    userId: userId || null,
    createdAt: new Date().toISOString(),
  };
  data.orders.push(order);
  write(data);
  return order;
}

function updateOrderStatus(id, status) {
  const data = read();
  const order = data.orders.find((o) => o.id === Number(id));
  if (!order) return null;
  if (['processing', 'packing', 'shipped', 'cancelled'].includes(status)) order.status = status;
  write(data);
  return order;
}

function setOrderItemAvailability(orderId, productId, available) {
  const data = read();
  const order = data.orders.find((o) => o.id === Number(orderId));
  if (!order) return null;
  const item = order.items.find((i) => String(i.productId) === String(productId));
  if (item) item.available = available;
  write(data);
  return order;
}

function removeOrderItem(orderId, productId) {
  const data = read();
  const order = data.orders.find((o) => o.id === Number(orderId));
  if (!order) return null;
  order.items = order.items.filter((i) => String(i.productId) !== String(productId));
  order.total = order.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  write(data);
  return order;
}

// --- Акції ---
function getPromotions() {
  return read().promotions;
}

function getPromotion(id) {
  return read().promotions.find((p) => p.id === Number(id));
}

function createPromotion({ title_ua, title_ru, text_ua, text_ru }) {
  const data = read();
  const id = data.nextPromotionId++;
  const promotion = {
    id,
    title_ua: title_ua || '',
    title_ru: title_ru || '',
    text_ua: text_ua || '',
    text_ru: text_ru || '',
    image: null,
    createdAt: new Date().toISOString(),
  };
  data.promotions.push(promotion);
  write(data);
  return promotion;
}

function updatePromotion(id, patch) {
  const data = read();
  const idx = data.promotions.findIndex((p) => p.id === Number(id));
  if (idx === -1) return null;
  data.promotions[idx] = { ...data.promotions[idx], ...patch };
  write(data);
  return data.promotions[idx];
}

function deletePromotion(id) {
  const data = read();
  data.promotions = data.promotions.filter((p) => p.id !== Number(id));
  write(data);
}

function slugify(str) {
  const map = {
    а: 'a', б: 'b', в: 'v', г: 'h', д: 'd', е: 'e', є: 'ie', ж: 'zh', з: 'z',
    и: 'y', і: 'i', ї: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
    п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch',
    ш: 'sh', щ: 'shch', ь: '', ю: 'iu', я: 'ia',
  };
  return str
    .toLowerCase()
    .split('')
    .map((ch) => map[ch] ?? ch)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

module.exports = {
  getSettings,
  updateSettings,
  getCategories,
  getCategory,
  getCategoriesWithProducts,
  getCategoryTree,
  getPopularCategories,
  getCategoryBySlugWithProducts,
  getTopLevelCategories,
  getCategoriesForSelect,
  createCategory,
  updateCategory,
  deleteCategory,
  getProducts,
  getProductsByCategory,
  getProduct,
  getProductBySlug,
  getBestsellers,
  createProduct,
  updateProduct,
  deleteProduct,
  addProductGalleryImages,
  removeProductGalleryImage,
  incrementProductOrderCount,
  getUserByEmail,
  getUser,
  createUser,
  updateUserProfile,
  updateUserPassword,
  getLeads,
  createLead,
  deleteLead,
  getOrders,
  getOrder,
  getOrdersByUser,
  createOrder,
  updateOrderStatus,
  setOrderItemAvailability,
  removeOrderItem,
  getPromotions,
  getPromotion,
  createPromotion,
  updatePromotion,
  deletePromotion,
};
