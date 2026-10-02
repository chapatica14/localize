document.addEventListener('DOMContentLoaded', () => {
  // Menu responsivo
  const btn = document.querySelector('.menu-btn');
  const menu = document.getElementById('menu');
  if (btn && menu) {
    btn.addEventListener('click', () => {
      btn.setAttribute('aria-expanded', menu.classList.toggle('aberto'));
    });
  }

  // Token sync para ambientes em iframe
  const urlParams = new URLSearchParams(window.location.search);
  const currentToken = urlParams.get('token');

  if (currentToken) {
    sessionStorage.setItem('localize_token', currentToken);
  }

  // Se o usuário clicou em sair, limpa o token armazenado
  if (window.location.pathname === '/login' || window.location.pathname === '/sair') {
    if (!currentToken) {
      sessionStorage.removeItem('localize_token');
    }
  }

  const storedToken = sessionStorage.getItem('localize_token');
  if (storedToken && !currentToken && window.location.pathname !== '/login' && window.location.pathname !== '/registo') {
    // Redireciona com o token caso os cookies tenham sido bloqueados
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('token', storedToken);
    window.location.replace(newUrl.toString());
  }
});
