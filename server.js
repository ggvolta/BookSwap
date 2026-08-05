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
const ALLOWED_BOOK_CONDITIONS = ['New', 'Like New', 'Good', 'Fair'];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const publicDir = path.join(__dirname, 'public');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  name: 'bookswap.sid',
  secret: process.env.SESSION_SECRET || 'simple-book-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000
  }
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

function isValidBookCondition(value) {
  return ALLOWED_BOOK_CONDITIONS.includes(cleanText(value));
}

function parsePositiveId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
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

app.get('/api/health', asyncHandler(async (req, res) => {
  await pool.execute('SELECT 1');
  res.json({ status: 'ok', database: 'connected' });
}));

// SIGNUP
app.post('/api/signup', asyncHandler(async (req, res) => {
  const { name, studentId, department, phone, email, password } = req.body;

  if (!name || !studentId || !department || !phone || !email || !password) {
    return res.status(400).json({ message: 'Please fill in every field.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters.' });
  }
  if (!EMAIL_PATTERN.test(cleanText(email))) {
    return res.status(400).json({ message: 'Please enter a valid email address.' });
  }
  if (cleanText(name).length > 100 || cleanText(studentId).length > 30 || cleanText(department).length > 100) {
    return res.status(400).json({ message: 'One or more signup fields are too long.' });
  }
  if (!/^[0-9+\-\s]{10,20}$/.test(cleanText(phone))) {
    return res.status(400).json({ message: 'Please enter a valid phone number.' });
  }

  const normalizedEmail = cleanText(email).toLowerCase();
  const normalizedStudentId = cleanText(studentId).toUpperCase();
  const [existing] = await pool.execute(
    'SELECT email, student_id FROM users WHERE email = ? OR student_id = ?',
    [normalizedEmail, normalizedStudentId]
  );

  if (existing.some((user) => user.email === normalizedEmail)) {
    return res.status(409).json({ message: 'Email is already registered.' });
  }
  if (existing.some((user) => user.student_id === normalizedStudentId)) {
    return res.status(409).json({ message: 'Student ID is already registered.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await pool.execute(
    `INSERT INTO users (name, student_id, department, phone, email, password)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [cleanText(name), normalizedStudentId, cleanText(department), cleanText(phone), normalizedEmail, passwordHash]
  );

  res.status(201).json({ message: 'Account created successfully.' });
}));

// LOGIN
app.post('/api/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = cleanText(email).toLowerCase();
  const [users] = await pool.execute('SELECT * FROM users WHERE email = ?', [normalizedEmail]);

  if (!users.length || !(await bcrypt.compare(password || '', users[0].password))) {
    return res.status(401).json({ message: 'Wrong email or password.' });
  }

  req.session.user = {
    id: users[0].id,
    name: users[0].name,
    studentId: users[0].student_id,
    department: users[0].department,
    email: users[0].email
  };
  res.json({ message: 'Login successful.' });
}));

app.post('/api/logout', requireApiLogin, (req, res) => {
  req.session.destroy(() => res.json({ message: 'Logged out.' }));
});

app.get('/api/me', requireApiLogin, (req, res) => res.json(req.session.user));

// READ every category currently used by a book
app.get('/api/categories', requireApiLogin, asyncHandler(async (req, res) => {
  const [rows] = await pool.execute(
    "SELECT DISTINCT category FROM books WHERE category <> '' ORDER BY category ASC"
  );
  res.json(rows.map((row) => row.category));
}));

// READ available books and search them
app.get('/api/books', requireApiLogin, asyncHandler(async (req, res) => {
  const searchTerm = cleanText(req.query.search).slice(0, 100);
  const search = `%${searchTerm}%`;
  const [books] = await pool.execute(
    `SELECT books.*, users.name AS owner_name, users.department AS owner_department,
            (books.owner_id = ?) AS is_owner
     FROM books
     JOIN users ON users.id = books.owner_id
     WHERE books.status = 'available'
       AND (
         books.title LIKE ? OR books.author LIKE ? OR
         books.category LIKE ? OR books.description LIKE ?
       )
     ORDER BY books.id DESC`,
    [req.session.user.id, search, search, search, search]
  );
  res.json(books);
}));

// READ current user's books
app.get('/api/my-books', requireApiLogin, asyncHandler(async (req, res) => {
  const [books] = await pool.execute(
    'SELECT * FROM books WHERE owner_id = ? ORDER BY id DESC',
    [req.session.user.id]
  );
  res.json(books);
}));

// CREATE a book
app.post('/api/books', requireApiLogin, asyncHandler(async (req, res) => {
  const { title, author, category, book_condition, description } = req.body;
  if (!title || !author || !category || !book_condition) {
    return res.status(400).json({ message: 'Title, author, category and condition are required.' });
  }
  if (cleanText(title).length > 150 || cleanText(author).length > 120 || cleanText(category).length > 80 || cleanText(description).length > 1000) {
    return res.status(400).json({ message: 'One or more book fields are too long.' });
  }
  if (!isValidBookCondition(book_condition)) {
    return res.status(400).json({ message: 'Please select a valid book condition.' });
  }

  await pool.execute(
    `INSERT INTO books (owner_id, title, author, category, book_condition, description)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [req.session.user.id, cleanText(title), cleanText(author), cleanText(category), book_condition, cleanText(description)]
  );
  res.status(201).json({ message: 'Book added successfully.' });
}));

// UPDATE a book
app.put('/api/books/:id', requireApiLogin, asyncHandler(async (req, res) => {
  const bookId = parsePositiveId(req.params.id);
  const { title, author, category, book_condition, description } = req.body;
  if (!bookId) return res.status(400).json({ message: 'Invalid book ID.' });
  if (!title || !author || !category || !book_condition) {
    return res.status(400).json({ message: 'All book fields except description are required.' });
  }
  if (cleanText(title).length > 150 || cleanText(author).length > 120 || cleanText(category).length > 80 || cleanText(description).length > 1000) {
    return res.status(400).json({ message: 'One or more book fields are too long.' });
  }
  if (!isValidBookCondition(book_condition)) {
    return res.status(400).json({ message: 'Please select a valid book condition.' });
  }

  const [result] = await pool.execute(
    `UPDATE books
     SET title = ?, author = ?, category = ?, book_condition = ?, description = ?
     WHERE id = ? AND owner_id = ? AND status = 'available'`,
    [cleanText(title), cleanText(author), cleanText(category), book_condition, cleanText(description), bookId, req.session.user.id]
  );

  if (!result.affectedRows) return res.status(400).json({ message: 'Book cannot be edited.' });
  res.json({ message: 'Book updated successfully.' });
}));

// DELETE a book
app.delete('/api/books/:id', requireApiLogin, asyncHandler(async (req, res) => {
  const bookId = parsePositiveId(req.params.id);
  if (!bookId) return res.status(400).json({ message: 'Invalid book ID.' });

  const [result] = await pool.execute(
    "DELETE FROM books WHERE id = ? AND owner_id = ? AND status = 'available'",
    [bookId, req.session.user.id]
  );

  if (!result.affectedRows) return res.status(400).json({ message: 'Book cannot be deleted.' });
  res.json({ message: 'Book deleted successfully.' });
}));

// CREATE a borrow request
app.post('/api/requests', requireApiLogin, asyncHandler(async (req, res) => {
  const bookId = parsePositiveId(req.body.bookId);
  if (!bookId) {
    return res.status(400).json({ message: 'Invalid book.' });
  }

  const [books] = await pool.execute(
    "SELECT * FROM books WHERE id = ? AND status = 'available'",
    [bookId]
  );

  if (!books.length) return res.status(404).json({ message: 'Book is not available.' });
  if (books[0].owner_id === req.session.user.id) {
    return res.status(400).json({ message: 'You cannot request your own book.' });
  }

  const [existing] = await pool.execute(
    "SELECT id FROM borrow_requests WHERE book_id = ? AND requester_id = ? AND status = 'pending'",
    [bookId, req.session.user.id]
  );
  if (existing.length) return res.status(409).json({ message: 'Request already sent.' });

  await pool.execute(
    'INSERT INTO borrow_requests (book_id, requester_id) VALUES (?, ?)',
    [bookId, req.session.user.id]
  );
  res.status(201).json({ message: 'Borrow request sent.' });
}));

// READ incoming and outgoing requests
app.get('/api/requests', requireApiLogin, asyncHandler(async (req, res) => {
  const [incoming] = await pool.execute(
    `SELECT br.id, br.status, br.created_at, b.title,
            u.name AS requester_name, u.student_id AS requester_student_id,
            u.department AS requester_department, u.phone AS requester_phone
     FROM borrow_requests br
     JOIN books b ON b.id = br.book_id
     JOIN users u ON u.id = br.requester_id
     WHERE b.owner_id = ?
     ORDER BY br.id DESC`,
    [req.session.user.id]
  );

  const [outgoing] = await pool.execute(
    `SELECT br.id, br.status, br.created_at, b.title,
            u.name AS owner_name, u.department AS owner_department
     FROM borrow_requests br
     JOIN books b ON b.id = br.book_id
     JOIN users u ON u.id = b.owner_id
     WHERE br.requester_id = ?
     ORDER BY br.id DESC`,
    [req.session.user.id]
  );

  res.json({ incoming, outgoing });
}));

// UPDATE a request: approve, reject or cancel
app.put('/api/requests/:id', requireApiLogin, asyncHandler(async (req, res) => {
  const requestId = parsePositiveId(req.params.id);
  const action = req.body.action;
  if (!requestId) return res.status(400).json({ message: 'Invalid request ID.' });
  if (!['approve', 'reject', 'cancel'].includes(action)) {
    return res.status(400).json({ message: 'Invalid action.' });
  }

  // A requester can cancel only their own pending request.
  if (action === 'cancel') {
    const [result] = await pool.execute(
      `UPDATE borrow_requests
       SET status = 'cancelled'
       WHERE id = ? AND requester_id = ? AND status = 'pending'`,
      [requestId, req.session.user.id]
    );

    if (!result.affectedRows) {
      return res.status(400).json({ message: 'Only a pending request can be cancelled.' });
    }
    return res.json({ message: 'Request cancelled.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      `SELECT br.*, b.owner_id, b.status AS book_status
       FROM borrow_requests br
       JOIN books b ON b.id = br.book_id
       WHERE br.id = ? FOR UPDATE`,
      [requestId]
    );

    if (!rows.length || rows[0].owner_id !== req.session.user.id || rows[0].status !== 'pending') {
      await connection.rollback();
      return res.status(400).json({ message: 'Request cannot be changed.' });
    }

    if (action === 'reject') {
      await connection.execute("UPDATE borrow_requests SET status = 'rejected' WHERE id = ?", [requestId]);
      await connection.commit();
      return res.json({ message: 'Request rejected.' });
    }

    if (rows[0].book_status !== 'available') {
      await connection.rollback();
      return res.status(400).json({ message: 'Book is no longer available.' });
    }

    const borrowDate = new Date();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + LOAN_DAYS);

    await connection.execute("UPDATE borrow_requests SET status = 'approved' WHERE id = ?", [requestId]);
    await connection.execute(
      "UPDATE borrow_requests SET status = 'rejected' WHERE book_id = ? AND id <> ? AND status = 'pending'",
      [rows[0].book_id, requestId]
    );
    await connection.execute("UPDATE books SET status = 'borrowed' WHERE id = ?", [rows[0].book_id]);
    await connection.execute(
      `INSERT INTO loans (book_id, owner_id, borrower_id, borrow_date, due_date)
       VALUES (?, ?, ?, ?, ?)`,
      [rows[0].book_id, rows[0].owner_id, rows[0].requester_id, formatDate(borrowDate), formatDate(dueDate)]
    );

    await connection.commit();
    res.json({ message: 'Request approved and loan created.' });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

// READ borrowed and lent books
app.get('/api/loans', requireApiLogin, asyncHandler(async (req, res) => {
  const [borrowed] = await pool.execute(
    `SELECT l.*, b.title, u.name AS owner_name, u.phone AS owner_phone
     FROM loans l
     JOIN books b ON b.id = l.book_id
     JOIN users u ON u.id = l.owner_id
     WHERE l.borrower_id = ?
     ORDER BY l.id DESC`,
    [req.session.user.id]
  );

  const [lent] = await pool.execute(
    `SELECT l.*, b.title, u.name AS borrower_name, u.phone AS borrower_phone
     FROM loans l
     JOIN books b ON b.id = l.book_id
     JOIN users u ON u.id = l.borrower_id
     WHERE l.owner_id = ?
     ORDER BY l.id DESC`,
    [req.session.user.id]
  );

  const withCurrentFine = borrowed.map((loan) => {
    const dueDate = formatDate(new Date(loan.due_date));
    const lateDays = loan.status === 'borrowed' ? calculateLateDays(dueDate) : 0;
    return {
      ...loan,
      late_days: lateDays,
      current_fine: loan.status === 'borrowed' ? lateDays * FINE_PER_DAY : Number(loan.fine_amount)
    };
  });

  res.json({ borrowed: withCurrentFine, lent, finePerDay: FINE_PER_DAY });
}));

// UPDATE a loan when the borrower returns the book
app.put('/api/loans/:id/return', requireApiLogin, asyncHandler(async (req, res) => {
  const loanId = parsePositiveId(req.params.id);
  if (!loanId) return res.status(400).json({ message: 'Invalid loan ID.' });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [loans] = await connection.execute(
      "SELECT * FROM loans WHERE id = ? AND borrower_id = ? AND status = 'borrowed' FOR UPDATE",
      [loanId, req.session.user.id]
    );

    if (!loans.length) {
      await connection.rollback();
      return res.status(400).json({ message: 'Loan cannot be returned.' });
    }

    const today = new Date();
    const dueDate = formatDate(new Date(loans[0].due_date));
    const lateDays = calculateLateDays(dueDate, today);
    const fine = lateDays * FINE_PER_DAY;

    await connection.execute(
      "UPDATE loans SET return_date = ?, fine_amount = ?, status = 'returned' WHERE id = ?",
      [formatDate(today), fine, loanId]
    );
    await connection.execute("UPDATE books SET status = 'available' WHERE id = ?", [loans[0].book_id]);

    await connection.commit();
    res.json({ message: `Book returned. Final fine: Tk ${fine}` });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ message: 'API endpoint not found.' });
  }
  res.status(404).send('Page not found.');
});

app.use((error, req, res, next) => {
  console.error(`[${new Date().toISOString()}]`, error);
  if (req.path.startsWith('/api/')) {
    return res.status(500).json({ message: 'Something went wrong on the server.' });
  }
  res.status(500).send('Something went wrong on the server.');
});

app.listen(PORT, () => {
  console.log(`BookSwap is running at http://localhost:${PORT}`);
});
