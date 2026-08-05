require('dotenv').config();

const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const pool = require('./database');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const LOAN_DAYS = Number(process.env.LOAN_DAYS || 7);
const FINE_PER_DAY = Number(process.env.FINE_PER_DAY || 10);
const publicDir = path.join(__dirname, 'public');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'simple-book-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 24 * 60 * 60 * 1000 }
}));

function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

function requireApiLogin(req, res, next) {
  if (!req.session.user) return res.status(401).json({ message: 'Please log in first.' });
  next();
}

function sendPage(fileName) {
  return (req, res) => res.sendFile(path.join(publicDir, fileName));
}

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function cleanText(value) {
  return String(value || '').trim();
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function calculateLateDays(dueDate, returnDate = new Date()) {
  const due = new Date(`${dueDate}T00:00:00`);
  const returned = new Date(`${formatDate(returnDate)}T00:00:00`);
  return Math.max(0, Math.ceil((returned - due) / 86400000));
}

// Frontend files
app.get('/style.css', sendPage('style.css'));
app.get('/auth.js', sendPage('auth.js'));
app.get('/app.js', sendPage('app.js'));

// HTML pages
app.get('/', (req, res) => res.redirect(req.session.user ? '/app' : '/login'));
app.get('/login', sendPage('login.html'));
app.get('/signup', sendPage('signup.html'));
app.get('/app', requireLogin, sendPage('app.html'));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use((req, res) => res.status(404).send('Page not found.'));

app.use((error, req, res, next) => {
  console.error(error);
  if (req.path.startsWith('/api/')) {
    return res.status(500).json({ message: 'Something went wrong on the server.' });
  }
  res.status(500).send('Something went wrong on the server.');
});

app.listen(PORT, () => {
  console.log(`BookSwap is running at http://localhost:${PORT}`);
});
