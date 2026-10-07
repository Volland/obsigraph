// Theme toggle shared by every page; remembers the choice when storage is available.
(() => {
  const root = document.documentElement;
  try {
    const saved = localStorage.getItem('obsigraph-theme');
    if (saved) root.dataset.theme = saved;
  } catch {
    /* storage unavailable */
  }
  // ?theme=light|dark overrides, e.g. for screenshots.
  const forced = new URLSearchParams(location.search).get('theme');
  if (forced === 'light' || forced === 'dark') root.dataset.theme = forced;
  const button = document.querySelector('.theme-toggle');
  if (!button) return;
  const isDark = () => root.dataset.theme === 'dark' || (!root.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
  const label = () => (button.textContent = isDark() ? '☀' : '☾');
  label();
  button.addEventListener('click', () => {
    root.dataset.theme = isDark() ? 'light' : 'dark';
    try {
      localStorage.setItem('obsigraph-theme', root.dataset.theme);
    } catch {
      /* storage unavailable */
    }
    label();
    window.dispatchEvent(new Event('obsigraph-theme'));
  });
})();

// Respect reduced motion: show the poster frame and let people press play instead of looping.
(function () {
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.querySelectorAll('.demo-video video').forEach(function (v) {
    v.removeAttribute('autoplay');
    v.pause();
    v.controls = true;
  });
})();
