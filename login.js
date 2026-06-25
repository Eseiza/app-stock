auth.onAuthStateChanged(async (user) => {
  if (!user) return;
  const doc = await dbStock.collection('usuarios').doc(user.uid).get();
  if (doc.exists) {
    window.location.href = doc.data().rol === 'admin' ? 'admin.html' : 'operador.html';
  }
});

const btn = document.getElementById('btn-login');

btn.addEventListener('click', async () => {
  const email    = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const err      = document.getElementById('error-msg');

  err.classList.add('hidden');
  btn.textContent = 'Ingresando...';
  btn.disabled = true;

  try {
    await auth.signInWithEmailAndPassword(email, password);
  } catch (e) {
    err.textContent = 'Email o contraseña incorrectos.';
    err.classList.remove('hidden');
    btn.textContent = 'Ingresar';
    btn.disabled = false;
  }
});

document.getElementById('password').addEventListener('keydown', e => {
  if (e.key === 'Enter') btn.click();
});
