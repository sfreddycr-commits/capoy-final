document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.favorite').forEach((button) => {
    button.addEventListener('click', () => {
      const active = button.classList.toggle('active');
      button.textContent = active ? '♥' : '♡';
      button.setAttribute('aria-label', active ? 'Quitar de favoritos' : 'Agregar a favoritos');
    });
  });

  const newsletter = document.getElementById('newsletter');
  const status = document.getElementById('newsletter-status');
  if (newsletter && status) {
    newsletter.addEventListener('submit', (event) => {
      event.preventDefault();
      const input = newsletter.querySelector('input[type="email"]');
      if (!input || !input.value.trim()) return;
      status.textContent = '¡Gracias! Te mantendremos al tanto de nuevas aventuras.';
      newsletter.reset();
    });
  }
});
