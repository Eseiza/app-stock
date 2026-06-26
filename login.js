// Si ya hay sesión activa, redirigir
const sesionActiva = getSession();
if (sesionActiva) {
  const dest = sesionActiva.rol === 'admin' ? 'admin.html'
             : sesionActiva.rol === 'carga' ? 'carga.html' : 'visor.html';
  window.location.href = dest;
}

const btn = document.getElementById('btn-login');

btn.addEventListener('click', () => {
  const usuario  = document.getElementById('usuario').value.trim().toLowerCase();
  const password = document.getElementById('password').value;
  const err      = document.getElementById('error-msg');
  err.classList.add('hidden');

  const user = USUARIOS.find(u => u.usuario === usuario && u.password === password);

  if (!user) {
    err.textContent = 'Usuario o contraseña incorrectos.';
    err.classList.remove('hidden');
    return;
  }

  setSession(user);
  window.location.href = user.rol === 'admin' ? 'admin.html'
                       : user.rol === 'carga'  ? 'carga.html' : 'visor.html';
});

document.getElementById('password').addEventListener('keydown', e => {
  if (e.key === 'Enter') btn.click();
});
