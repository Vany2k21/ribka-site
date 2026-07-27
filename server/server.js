require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const path = require('path');

const db = require('./db');
const mainRoutes = require('./routes/main');
const adminRoutes = require('./routes/admin');
const accountRoutes = require('./routes/account');
const cartRoutes = require('./routes/cart');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 8 * 60 * 60 * 1000 },
  })
);

// --- i18n: визначаємо мову з cookie, за замовчуванням "ua" ---
app.use((req, res, next) => {
  const lang = req.cookies.lang === 'ru' ? 'ru' : 'ua';
  res.locals.lang = lang;
  res.locals.f = (obj, field) => (obj ? obj[`${field}_${lang}`] : '');
  res.locals.t = (ua, ru) => (lang === 'ru' ? ru : ua);
  res.locals.chunk = (arr, size) => {
    const groups = [];
    for (let i = 0; i < arr.length; i += size) groups.push(arr.slice(i, i + size));
    return groups;
  };
  next();
});

// --- Стан входу для шапки сайту ---
app.use((req, res, next) => {
  res.locals.isAdminSession = !!req.session.isAdmin;
  res.locals.currentUser = req.session.userId ? db.getUser(req.session.userId) : null;
  res.locals.callbackSent = req.query.callback === '1';
  next();
});

app.use('/admin', adminRoutes);
app.use('/account', accountRoutes);
app.use('/cart', cartRoutes);
app.use('/', mainRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Сервер запущено: http://localhost:${PORT}`);
});
