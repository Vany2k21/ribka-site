const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('../db');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function renderAccount(req, res, extra = {}) {
  let mode = 'guest';
  let user = null;
  let orders = [];
  if (req.session.isAdmin) {
    mode = 'admin';
  } else if (req.session.userId) {
    user = db.getUser(req.session.userId);
    if (user) {
      mode = 'user';
      orders = db.getOrdersByUser(user.id).slice().reverse();
    }
  }
  res.render('account', {
    mode,
    user,
    orders,
    promotions: db.getPromotions(),
    settings: db.getSettings(),
    categories: db.getCategoryTree(),
    loginError: null,
    registerError: null,
    profileError: null,
    profileSuccess: false,
    passwordError: null,
    passwordSuccess: false,
    activeTab: extra.registerError ? 'register' : 'login',
    dashTab: 'orders',
    ...extra,
  });
}

router.get('/', (req, res) => {
  renderAccount(req, res);
});

router.post('/login', (req, res) => {
  const { login, password } = req.body;

  if (login === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
    req.session.isAdmin = true;
    return res.redirect('/admin');
  }

  const user = db.getUserByEmail(login);
  if (user && bcrypt.compareSync(password || '', user.passwordHash)) {
    req.session.userId = user.id;
    return res.redirect('/account');
  }

  renderAccount(req, res, { loginError: 'Невірний логін/email або пароль' });
});

router.post('/register', (req, res) => {
  const { name, email, password, password2 } = req.body;

  if (!name || !name.trim()) {
    return renderAccount(req, res, { registerError: "Вкажіть ім'я" });
  }
  if (!email || !EMAIL_RE.test(email.trim())) {
    return renderAccount(req, res, { registerError: 'Вкажіть коректний email' });
  }
  if (!password || password.length < 6) {
    return renderAccount(req, res, { registerError: 'Пароль має містити щонайменше 6 символів' });
  }
  if (password !== password2) {
    return renderAccount(req, res, { registerError: 'Паролі не співпадають' });
  }
  if (db.getUserByEmail(email)) {
    return renderAccount(req, res, { registerError: 'Користувач з таким email вже зареєстрований' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const user = db.createUser({ name: name.trim(), email, passwordHash });
  req.session.userId = user.id;
  res.redirect('/account');
});

router.post('/profile', (req, res) => {
  if (!req.session.userId) return res.redirect('/account');
  const { name, phone, address } = req.body;

  if (!name || !name.trim()) {
    return renderAccount(req, res, { dashTab: 'profile', profileError: "Вкажіть ім'я" });
  }

  db.updateUserProfile(req.session.userId, {
    name: name.trim(),
    phone: (phone || '').trim(),
    address: (address || '').trim(),
  });
  renderAccount(req, res, { dashTab: 'profile', profileSuccess: true });
});

router.post('/password', (req, res) => {
  if (!req.session.userId) return res.redirect('/account');
  const user = db.getUser(req.session.userId);
  const { currentPassword, newPassword, newPassword2 } = req.body;

  if (!user || !bcrypt.compareSync(currentPassword || '', user.passwordHash)) {
    return renderAccount(req, res, { dashTab: 'password', passwordError: 'Поточний пароль невірний' });
  }
  if (!newPassword || newPassword.length < 6) {
    return renderAccount(req, res, {
      dashTab: 'password',
      passwordError: 'Новий пароль має містити щонайменше 6 символів',
    });
  }
  if (newPassword !== newPassword2) {
    return renderAccount(req, res, { dashTab: 'password', passwordError: 'Паролі не співпадають' });
  }

  db.updateUserPassword(user.id, bcrypt.hashSync(newPassword, 10));
  renderAccount(req, res, { dashTab: 'password', passwordSuccess: true });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

module.exports = router;
