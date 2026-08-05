async function send(url, data) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  const result = await response.json();
  if (!response.ok) throw new Error(result.message);
  return result;
}

const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = document.getElementById('message');
    message.className = 'message';
    message.textContent = '';

    try {
      await send('/api/login', {
        email: document.getElementById('email').value,
        password: document.getElementById('password').value
      });
      location.href = '/app';
    } catch (error) {
      message.textContent = error.message;
    }
  });
}

const signupForm = document.getElementById('signupForm');
if (signupForm) {
  signupForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = document.getElementById('message');
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    message.className = 'message';
    message.textContent = '';

    if (password !== confirmPassword) {
      message.textContent = 'Passwords do not match.';
      return;
    }

    try {
      await send('/api/signup', {
        name: document.getElementById('name').value,
        studentId: document.getElementById('studentId').value,
        department: document.getElementById('department').value,
        phone: document.getElementById('phone').value,
        email: document.getElementById('email').value,
        password
      });

      message.className = 'message success';
      message.textContent = 'Account created. Redirecting to login...';
      setTimeout(() => location.href = '/login', 1000);
    } catch (error) {
      message.textContent = error.message;
    }
  });
}
