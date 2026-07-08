// ── USUARIOS ──────────────────────────────────────────────────
const USUARIOS = [
  { usuario: "admin", contrasena: "Admin.2026", rol: "admin", redirige: "./admin.html"    },
  { usuario: "carga", contrasena: "Carga.2026", rol: "carga", redirige: "./carga.html"    },
  { usuario: "visor", contrasena: "Visor.2026", rol: "visor", redirige: "./visor.html"    },
];

const btn = document.getElementById('btn-login');

btn.addEventListener('click', () => {
  const usuario   = document.getElementById('username').value.trim().toLowerCase();
  const contrasena = document.getElementById('password').value;
  const err        = document.getElementById('error-msg');
  err.classList.add('hidden');

  const match = USUARIOS.find(u => u.usuario === usuario && u.contrasena === contrasena);

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
