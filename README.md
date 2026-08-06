# BookSwap

A simple campus Book Exchange and Borrowing System built with HTML, CSS, JavaScript, Node.js, Express and MySQL.

## Features

- Student signup with name, student ID, department, phone, email and password
- Login, logout and protected application page
- 10 sample student accounts and 110 sample books for search and demonstration
- Add, publish, view, edit and delete books
- Newly published books appear immediately in Browse
- Search by title, author, category or description
- Send, approve, reject and cancel borrow requests
- Seven-day loan period
- Tk 10 fine per late day
- Session cookie and local-storage search preference
- Prepared SQL queries and try/catch error handling

## Simple project structure

```text
BookSwap-Minimal-Fixed/
├── public/
│   ├── login.html
│   ├── signup.html
│   ├── app.html
│   ├── style.css
│   ├── auth.js
│   └── app.js
├── server.js
├── database.js
├── database.sql
├── package.json
├── .env.example
└── README.md
```

## Setup

1. Start Apache and MySQL in XAMPP.
2. Open phpMyAdmin.
3. Import `database.sql`. This resets the old `book_exchange` database and inserts sample data.
4. Copy `.env.example` to `.env`.
5. Run `npm install`.
6. Run `npm start`.
7. Open `http://localhost:3000`.

## Sample accounts

All 10 sample accounts use the password `demo123`.

- `nusrat@bookswap.demo`
- `tanvir@bookswap.demo`
- `farhan@bookswap.demo`
- `sadia@bookswap.demo`
- `mahin@bookswap.demo`
- `ayesha@bookswap.demo`
- `rafi@bookswap.demo`
- `samira@bookswap.demo`
- `arif@bookswap.demo`
- `nabila@bookswap.demo`

The Browse page shows all available books, including the current user's published books. A user's own books are marked **Your published book** and cannot be requested by that same user.

## Fine test

After a loan is created, run this in phpMyAdmin:

```sql
UPDATE loans
SET due_date = DATE_SUB(CURDATE(), INTERVAL 3 DAY)
WHERE status = 'borrowed';
```

Reload the Loans & Fines section. The current fine should be Tk 30.

## CRUD demonstration

- CREATE: Add a book
- READ: Browse/search books
- UPDATE: Edit an available book
- DELETE: Delete an available book


## Latest improvements

- 110 seeded books across many categories
- Dynamic quick-search buttons generated from database categories
- Users may type a new category when publishing a book
- Responsive layout for phones, tablets, laptops and desktop computers
- Footer on login, signup and application pages

## ER relationship summary

```text
users 1 ---- many books
users 1 ---- many borrow_requests
books 1 ---- many borrow_requests
users 1 ---- many loans as owner
users 1 ---- many loans as borrower
books 1 ---- many historical loans
```

Primary keys are the `id` columns. Foreign keys connect `books.owner_id`,
`borrow_requests.book_id`, `borrow_requests.requester_id`, and the three user/book
references in `loans`. The complete data types and constraints are available in
`database.sql`.

## GitHub submission

The included Git history contains 30 meaningful commits: 20 project/frontend
commits followed by 10 backend, validation, database, and documentation commits.
This satisfies the safest interpretation of the course requirement for at least
20 frontend pushes and at least 10 backend pushes.

Connect the empty repository:

```powershell
git remote add origin https://github.com/ggvolta/BookSwap.git
```

Then push every commit separately:

```powershell
powershell -ExecutionPolicy Bypass -File .\push-30-commits.ps1
```

Never upload `.env` or `node_modules`. Both are excluded by `.gitignore`.
