const STORAGE_KEY = 'ode-theme-preference';

export function initThemeToggle(button) {
  if (!button) return;
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const stored = localStorage.getItem(STORAGE_KEY);
  const initialTheme = stored || (prefersDark ? 'dark' : 'light');
  applyTheme(initialTheme, button);
  button.addEventListener('click', () => {
    const nextTheme = document.body.classList.contains('theme-dark') ? 'light' : 'dark';
    applyTheme(nextTheme, button);
    localStorage.setItem(STORAGE_KEY, nextTheme);
  });
}

function applyTheme(theme, button) {
  if (theme === 'dark') {
    document.body.classList.remove('theme-light');
    document.body.classList.add('theme-dark');
    button.querySelector('.icon').textContent = '🌙';
    button.querySelector('.label').textContent = 'تم شب';
  } else {
    document.body.classList.remove('theme-dark');
    document.body.classList.add('theme-light');
    button.querySelector('.icon').textContent = '🌞';
    button.querySelector('.label').textContent = 'تم روز';
  }
}
