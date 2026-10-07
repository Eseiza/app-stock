// Acceso temporal del prototipo. Antes de producción se reemplazará por Firebase Auth.
const USUARIOS = [
  { usuario: 'admin',   contrasena: 'Admin.2026',   rol: 'admin',   redirige: 'pages/admin.html' },
  { usuario: 'operario',contrasena: 'Operario.2026',rol: 'operario',redirige: 'pages/operador.html' },
  { usuario: 'visor',   contrasena: 'Visor.2026',   rol: 'visor',   redirige: 'pages/visor.html' },
  { usuario: 'ventas',  contrasena: 'Ventas.2026',  rol: 'ventas',  redirige: 'pages/ventas.html' }
];

const btn = document.getElementById('btn-login');
const selRol = document.getElementById('role');
const credenciales = document.getElementById('credenciales');

// Al elegir un rol se muestran usuario, contraseña y botón.
selRol.addEventListener('change', () => {
  document.getElementById('error-msg').classList.add('hidden');
  const yaVisible = !credenciales.classList.contains('hidden');
  credenciales.classList.remove('hidden');
  if (!yaVisible) document.getElementById('username').focus();
});

btn.addEventListener('click', () => {
  const usuario = document.getElementById('username').value.trim().toLowerCase();
  const contrasena = document.getElementById('password').value;
  const err = document.getElementById('error-msg');
  err.classList.add('hidden');

  const match = USUARIOS.find(u => u.rol === selRol.value && u.usuario === usuario && u.contrasena === contrasena);
  if (!match) {
    err.textContent = 'Usuario o contraseña incorrectos.';
    err.classList.remove('hidden');
    return;
  }
  sessionStorage.setItem('usuario', match.usuario);
  sessionStorage.setItem('rol', match.rol);
  window.location.href = match.redirige;
});

document.getElementById('password').addEventListener('keydown', e => {
  if (e.key === 'Enter') btn.click();
});
