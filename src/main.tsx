import { render } from 'preact';
import './styles/fonts.css';
import './styles/app.css';
import { App } from './ui/App';

render(<App />, document.getElementById('app')!);

const boot = document.getElementById('boot');
if (boot) {
  requestAnimationFrame(() => boot.classList.add('is-gone'));
  setTimeout(() => boot.remove(), 500);
}

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => undefined);
  });
}
