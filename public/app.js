async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  if (response.status === 401) {
    location.href = '/login';
    return null;
  }

  const result = await response.json();
  if (!response.ok) throw new Error(result.message);
  return result;
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function showMessage(text, success = false) {
  const message = document.getElementById('message');
  message.textContent = text;
  message.classList.toggle('success', success);
  message.classList.toggle('show', Boolean(text));

  if (text) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => message.classList.remove('show'), 3500);
  }
}

function bookEmoji(category = '') {
  const icons = {
    Programming: '💻',
    Academic: '🎓',
    Science: '🔭',
    Fiction: '✨',
    Business: '💼',
    'Self Development': '🌱',
    'Islamic Book': '🕌',
    History: '🏛️',
    Mathematics: '➗',
    Engineering: '⚙️',
    Literature: '🪶',
    Biography: '👤',
    Technology: '🤖',
    Economics: '📈',
    'Language Learning': '🗣️',
    Health: '🩺',
    Philosophy: '💭',
    "Children's Books": '🧸',
    'Bangladesh Studies': '🇧🇩',
    Law: '⚖️',
    Poetry: '📝'
  };
  return icons[category] || '📘';
}

function statusBadge(status) {
  return `<span class="status ${escapeHtml(status)}">${escapeHtml(status)}</span>`;
}

function emptyState(title, text) {
  return `
    <div class="empty-state">
      <span>📚</span>
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(text)}</p>
    </div>`;
}

async function loadCategories() {
  try {
    const categories = await api('/api/categories');
    if (!categories) return;

    const quickSearches = document.getElementById('quickSearches');
    quickSearches.innerHTML = `
      <span>Quick search:</span>
      <button class="quick-search" data-search="">All books</button>
      ${categories.map((category) => `
        <button class="quick-search" data-search="${escapeHtml(category)}">${escapeHtml(category)}</button>
      `).join('')}
    `;

    document.getElementById('categoryOptions').innerHTML = categories
      .map((category) => `<option value="${escapeHtml(category)}"></option>`)
      .join('');
  } catch (error) {
    showMessage(error.message);
  }
}

function showSection(sectionId) {
  localStorage.setItem('lastSection', sectionId);
  showMessage('');

  document.querySelectorAll('.page-section').forEach((section) => {
    section.classList.toggle('hidden', section.id !== sectionId);
  });

  document.querySelectorAll('.nav-button').forEach((button) => {
    button.classList.toggle('active', button.dataset.section === sectionId);
  });

  if (sectionId === 'browseSection') loadBooks();
  if (sectionId === 'booksSection') loadMyBooks();
  if (sectionId === 'requestsSection') loadRequests();
  if (sectionId === 'loansSection') loadLoans();
}

async function setupPage() {
  const user = await api('/api/me');
  if (!user) return;

  document.getElementById('userName').textContent = user.name;
  document.getElementById('userInfo').textContent = `${user.studentId} • ${user.department}`;

  document.querySelectorAll('.nav-button').forEach((button) => {
    button.addEventListener('click', () => showSection(button.dataset.section));
  });

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await api('/api/logout', { method: 'POST' });
    location.href = '/login';
  });

  document.getElementById('searchBtn').addEventListener('click', loadBooks);
  document.getElementById('search').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') loadBooks();
  });

  document.getElementById('quickSearches').addEventListener('click', (event) => {
    const button = event.target.closest('.quick-search');
    if (!button) return;
    document.getElementById('search').value = button.dataset.search;
    loadBooks();
  });

  document.getElementById('bookForm').addEventListener('submit', saveBook);
  document.getElementById('cancelEdit').addEventListener('click', resetBookForm);

  document.getElementById('search').value = localStorage.getItem('bookSearch') || '';
  await loadCategories();
  showSection(localStorage.getItem('lastSection') || 'browseSection');
}

async function loadBooks() {
  const search = document.getElementById('search').value.trim();
  localStorage.setItem('bookSearch', search);

  try {
    const books = await api(`/api/books?search=${encodeURIComponent(search)}`);
    const list = document.getElementById('bookList');
    document.getElementById('bookCount').textContent = books.length;

    if (!books.length) {
      list.innerHTML = emptyState('No books found', 'Try another title, author or category.');
      return;
    }

    list.innerHTML = books.map((book) => `
      <article class="book-card">
        <div class="book-cover">
          <span>${bookEmoji(book.category)}</span>
          <small>${escapeHtml(book.category)}</small>
        </div>
        <div class="book-content">
          <div class="book-topline">
            <span class="condition">${escapeHtml(book.book_condition)}</span>
            ${statusBadge(book.status)}
          </div>
          <h3>${escapeHtml(book.title)}</h3>
          <p class="author">by ${escapeHtml(book.author)}</p>
          <p class="description">${escapeHtml(book.description || 'No description provided.')}</p>
          <div class="owner-row">
            <div class="avatar">${escapeHtml(book.owner_name.charAt(0))}</div>
            <div>
              <strong>${escapeHtml(book.owner_name)}</strong>
              <small>${escapeHtml(book.owner_department)}</small>
            </div>
          </div>
          ${Number(book.is_owner) === 1
            ? '<button class="full-button owner-book-button" disabled>Your published book</button>'
            : `<button class="full-button" onclick="requestBook(${book.id})">Request this book</button>`}
        </div>
      </article>
    `).join('');
  } catch (error) {
    showMessage(error.message);
  }
}

async function requestBook(bookId) {
  try {
    const result = await api('/api/requests', {
      method: 'POST',
      body: JSON.stringify({ bookId })
    });
    showMessage(result.message, true);
  } catch (error) {
    showMessage(error.message);
  }
}
window.requestBook = requestBook;

let myBooks = [];

async function loadMyBooks() {
  try {
    myBooks = await api('/api/my-books');
    const list = document.getElementById('myBookList');

    if (!myBooks.length) {
      list.innerHTML = emptyState('No books added yet', 'Use the form above to add your first book.');
      return;
    }

    list.innerHTML = myBooks.map((book) => `
      <article class="book-card compact-card">
        <div class="book-cover small-cover">
          <span>${bookEmoji(book.category)}</span>
          <small>${escapeHtml(book.category)}</small>
        </div>
        <div class="book-content">
          <div class="book-topline">
            <span class="condition">${escapeHtml(book.book_condition)}</span>
            ${statusBadge(book.status)}
          </div>
          <h3>${escapeHtml(book.title)}</h3>
          <p class="author">by ${escapeHtml(book.author)}</p>
          <div class="button-row">
            <button class="small" onclick="editBook(${book.id})" ${book.status !== 'available' ? 'disabled' : ''}>Edit</button>
            <button class="danger small" onclick="deleteBook(${book.id})" ${book.status !== 'available' ? 'disabled' : ''}>Delete</button>
          </div>
        </div>
      </article>
    `).join('');
  } catch (error) {
    showMessage(error.message);
  }
}

async function saveBook(event) {
  event.preventDefault();
  const id = document.getElementById('bookId').value;
  const data = {
    title: document.getElementById('title').value,
    author: document.getElementById('author').value,
    category: document.getElementById('category').value,
    book_condition: document.getElementById('condition').value,
    description: document.getElementById('description').value
  };

  try {
    const result = await api(id ? `/api/books/${id}` : '/api/books', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(data)
    });
    const wasNewBook = !id;
    resetBookForm();
    await loadMyBooks();
    await loadCategories();

    if (wasNewBook) {
      document.getElementById('search').value = '';
      localStorage.setItem('bookSearch', '');
      showSection('browseSection');
      showMessage('Book published successfully. It is now visible in Browse.', true);
    } else {
      await loadBooks();
      showMessage(result.message, true);
    }
  } catch (error) {
    showMessage(error.message);
  }
}

function editBook(id) {
  const book = myBooks.find((item) => item.id === id);
  if (!book) return;

  document.getElementById('bookId').value = book.id;
  document.getElementById('title').value = book.title;
  document.getElementById('author').value = book.author;
  document.getElementById('category').value = book.category;
  document.getElementById('condition').value = book.book_condition;
  document.getElementById('description').value = book.description || '';
  document.getElementById('formTitle').textContent = 'Edit Book';
  document.getElementById('cancelEdit').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.editBook = editBook;

function resetBookForm() {
  document.getElementById('bookForm').reset();
  document.getElementById('bookId').value = '';
  document.getElementById('formTitle').textContent = 'Add a New Book';
  document.getElementById('cancelEdit').classList.add('hidden');
}

async function deleteBook(id) {
  if (!confirm('Delete this book?')) return;

  try {
    const result = await api(`/api/books/${id}`, { method: 'DELETE' });
    showMessage(result.message, true);
    await loadMyBooks();
    await loadCategories();
  } catch (error) {
    showMessage(error.message);
  }
}
window.deleteBook = deleteBook;

async function loadRequests() {
  try {
    const data = await api('/api/requests');
    const incoming = document.getElementById('incomingList');
    const outgoing = document.getElementById('outgoingList');

    incoming.innerHTML = data.incoming.length ? data.incoming.map((item) => `
      <article class="request-card">
        <div class="request-heading">
          <strong>${escapeHtml(item.title)}</strong>
          ${statusBadge(item.status)}
        </div>
        <p><b>Student:</b> ${escapeHtml(item.requester_name)}</p>
        <p><b>ID:</b> ${escapeHtml(item.requester_student_id)}</p>
        <p><b>Department:</b> ${escapeHtml(item.requester_department)}</p>
        <p><b>Phone:</b> ${escapeHtml(item.requester_phone)}</p>
        ${item.status === 'pending' ? `
          <div class="button-row">
            <button class="small" onclick="changeRequest(${item.id}, 'approve')">Approve</button>
            <button class="danger small" onclick="changeRequest(${item.id}, 'reject')">Reject</button>
          </div>
        ` : ''}
      </article>
    `).join('') : emptyState('No incoming requests', 'Requests for your books will appear here.');

    outgoing.innerHTML = data.outgoing.length ? data.outgoing.map((item) => `
      <article class="request-card">
        <div class="request-heading">
          <strong>${escapeHtml(item.title)}</strong>
          ${statusBadge(item.status)}
        </div>
        <p><b>Owner:</b> ${escapeHtml(item.owner_name)}</p>
        <p><b>Department:</b> ${escapeHtml(item.owner_department)}</p>
        ${item.status === 'pending' ? `
          <button class="danger small" onclick="changeRequest(${item.id}, 'cancel')">Cancel request</button>
        ` : ''}
      </article>
    `).join('') : emptyState('No outgoing requests', 'Request a book from the Browse page.');
  } catch (error) {
    showMessage(error.message);
  }
}

async function changeRequest(id, action) {
  try {
    const result = await api(`/api/requests/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ action })
    });
    showMessage(result.message, true);
    await loadRequests();
  } catch (error) {
    showMessage(error.message);
  }
}
window.changeRequest = changeRequest;

function dateText(value) {
  return value ? new Date(value).toLocaleDateString('en-GB') : '-';
}

async function loadLoans() {
  try {
    const data = await api('/api/loans');
    const borrowed = document.getElementById('borrowedList');
    const lent = document.getElementById('lentList');

    borrowed.innerHTML = data.borrowed.length ? data.borrowed.map((loan) => `
      <article class="request-card loan-card">
        <div class="request-heading">
          <strong>${escapeHtml(loan.title)}</strong>
          ${statusBadge(loan.status)}
        </div>
        <p><b>Owner:</b> ${escapeHtml(loan.owner_name)} (${escapeHtml(loan.owner_phone)})</p>
        <p><b>Borrowed:</b> ${dateText(loan.borrow_date)}</p>
        <p><b>Due date:</b> ${dateText(loan.due_date)}</p>
        <div class="fine-box ${Number(loan.current_fine) > 0 ? 'has-fine' : ''}">
          <span>${Number(loan.late_days) > 0 ? `${loan.late_days} day(s) late` : 'No late fine'}</span>
          <strong>Tk ${Number(loan.current_fine).toFixed(2)}</strong>
        </div>
        ${loan.status === 'borrowed' ? `<button class="full-button" onclick="returnBook(${loan.id})">Return book</button>` : `<p><b>Returned:</b> ${dateText(loan.return_date)}</p>`}
      </article>
    `).join('') : emptyState('No borrowed books', 'Approved loans will appear here.');

    lent.innerHTML = data.lent.length ? data.lent.map((loan) => `
      <article class="request-card loan-card">
        <div class="request-heading">
          <strong>${escapeHtml(loan.title)}</strong>
          ${statusBadge(loan.status)}
        </div>
        <p><b>Borrower:</b> ${escapeHtml(loan.borrower_name)} (${escapeHtml(loan.borrower_phone)})</p>
        <p><b>Due date:</b> ${dateText(loan.due_date)}</p>
        <p><b>Return date:</b> ${dateText(loan.return_date)}</p>
        <p><b>Final fine:</b> Tk ${Number(loan.fine_amount).toFixed(2)}</p>
      </article>
    `).join('') : emptyState('No lent books', 'Approved requests for your books will appear here.');
  } catch (error) {
    showMessage(error.message);
  }
}

async function returnBook(id) {
  if (!confirm('Mark this book as returned?')) return;

  try {
    const result = await api(`/api/loans/${id}/return`, { method: 'PUT' });
    showMessage(result.message, true);
    await loadLoans();
  } catch (error) {
    showMessage(error.message);
  }
}
window.returnBook = returnBook;

setupPage().catch((error) => showMessage(error.message));
