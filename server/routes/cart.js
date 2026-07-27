const express = require('express');
const router = express.Router();
const db = require('../db');

// Кошик з повними об'єктами товару (для серверного рендеру сторінки оформлення).
function getCartWithProducts(req) {
  const raw = req.session.cart || {};
  return Object.keys(raw)
    .map((id) => {
      const product = db.getProduct(id);
      const quantity = raw[id];
      if (!product || quantity < 1) return null;
      return { product, quantity, lineTotal: Math.round(product.price * quantity * 100) / 100 };
    })
    .filter(Boolean);
}

function cartState(req) {
  const lang = req.cookies.lang === 'ru' ? 'ru' : 'ua';
  const items = getCartWithProducts(req).map(({ product, quantity, lineTotal }) => ({
    id: product.id,
    name: lang === 'ru' ? product.name_ru : product.name_ua,
    price: product.price,
    unit: lang === 'ru' ? product.unit_ru : product.unit_ua,
    unitType: product.unitType,
    image: product.image,
    quantity,
    lineTotal,
  }));

  const subtotal = items.reduce((sum, i) => sum + i.lineTotal, 0);
  const count = items.reduce((sum, i) => sum + i.quantity, 0);
  return { items, subtotal, count };
}

router.get('/data', (req, res) => {
  res.json(cartState(req));
});

router.post('/add', (req, res) => {
  const productId = Number(req.body.productId);
  const quantity = Math.max(1, parseInt(req.body.quantity, 10) || 1);
  const product = db.getProduct(productId);
  if (!product) return res.status(404).json(cartState(req));

  req.session.cart = req.session.cart || {};
  req.session.cart[productId] = (req.session.cart[productId] || 0) + quantity;
  res.json(cartState(req));
});

router.post('/update', (req, res) => {
  const productId = Number(req.body.productId);
  const quantity = Math.max(1, parseInt(req.body.quantity, 10) || 1);
  if (req.session.cart && req.session.cart[productId]) {
    req.session.cart[productId] = quantity;
  }
  res.json(cartState(req));
});

router.post('/remove', (req, res) => {
  const productId = Number(req.body.productId);
  if (req.session.cart) delete req.session.cart[productId];
  res.json(cartState(req));
});

module.exports = router;
module.exports.getCartWithProducts = getCartWithProducts;
