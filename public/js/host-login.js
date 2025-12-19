document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const errorDiv = document.getElementById('errorMessage');

  try {
    const response = await fetch('/api/host/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (data.success) {
      window.location.href = `/host/${data.sessionId}`;
    } else {
      errorDiv.textContent = data.error || 'Invalid credentials';
      errorDiv.classList.remove('hidden');
    }
  } catch (error) {
    errorDiv.textContent = 'Error logging in: ' + error.message;
    errorDiv.classList.remove('hidden');
  }
});

document.getElementById('backBtn').addEventListener('click', () => {
  window.location.href = '/';
});
