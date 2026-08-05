-- BookSwap database setup
-- Import this file once in phpMyAdmin.
-- It resets the project database and adds sample users and books.

DROP DATABASE IF EXISTS book_exchange;
CREATE DATABASE book_exchange CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE book_exchange;

CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  student_id VARCHAR(30) NOT NULL UNIQUE,
  department VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE books (
  id INT PRIMARY KEY AUTO_INCREMENT,
  owner_id INT NOT NULL,
  title VARCHAR(150) NOT NULL,
  author VARCHAR(120) NOT NULL,
  category VARCHAR(80) NOT NULL,
  book_condition VARCHAR(30) NOT NULL,
  description TEXT,
  status ENUM('available', 'borrowed') DEFAULT 'available',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE borrow_requests (
  id INT PRIMARY KEY AUTO_INCREMENT,
  book_id INT NOT NULL,
  requester_id INT NOT NULL,
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
  FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE loans (
  id INT PRIMARY KEY AUTO_INCREMENT,
  book_id INT NOT NULL,
  owner_id INT NOT NULL,
  borrower_id INT NOT NULL,
  borrow_date DATE NOT NULL,
  due_date DATE NOT NULL,
  return_date DATE NULL,
  fine_amount DECIMAL(10,2) DEFAULT 0,
  status ENUM('borrowed', 'returned') DEFAULT 'borrowed',
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (borrower_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Password for both demo users: demo123
INSERT INTO users (id, name, student_id, department, phone, email, password) VALUES
(1, 'Nusrat Jahan', 'CSE-2026-001', 'Computer Science and Engineering', '01700000001', 'nusrat@bookswap.demo', '$2b$10$QtO4w7ZP6L2ibt8IwLDnCuv5ixiybOdVg9GQHSgiCVdKRkGEMgEB.'),
(2, 'Tanvir Ahmed', 'EEE-2026-002', 'Electrical and Electronic Engineering', '01700000002', 'tanvir@bookswap.demo', '$2b$10$QtO4w7ZP6L2ibt8IwLDnCuv5ixiybOdVg9GQHSgiCVdKRkGEMgEB.');

INSERT INTO books (owner_id, title, author, category, book_condition, description) VALUES
(1, 'Clean Code', 'Robert C. Martin', 'Programming', 'Good', 'A practical guide to writing readable and maintainable software.'),
(2, 'Database System Concepts', 'Abraham Silberschatz', 'Academic', 'Good', 'Database fundamentals, SQL, normalization and transaction concepts.'),
(1, 'Introduction to Algorithms', 'Thomas H. Cormen', 'Programming', 'Fair', 'A comprehensive reference for algorithms and data structures.'),
(2, 'The Alchemist', 'Paulo Coelho', 'Fiction', 'Good', 'A simple and inspiring novel about following personal dreams.'),
(1, 'Atomic Habits', 'James Clear', 'Self Development', 'New', 'Practical ideas for building good habits and breaking bad ones.'),
(2, 'The Psychology of Money', 'Morgan Housel', 'Business', 'Good', 'Short lessons about money, behavior and long-term decisions.'),
(1, 'A Brief History of Time', 'Stephen Hawking', 'Science', 'Fair', 'An accessible introduction to the universe, time and black holes.'),
(2, '1984', 'George Orwell', 'Fiction', 'Good', 'A classic dystopian novel about surveillance and authoritarian power.'),
(1, 'English for Today', 'NCTB', 'Academic', 'Good', 'Useful English reading and language practice for students.'),
(2, 'The Hobbit', 'J. R. R. Tolkien', 'Fiction', 'New', 'A fantasy adventure featuring Bilbo Baggins and a journey to the Lonely Mountain.');
