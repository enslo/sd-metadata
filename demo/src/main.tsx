import { render } from 'preact';
import { App } from './App';
import { initLocale } from './i18n';
import './styles/global.css';

// Initialize locale before rendering
initLocale();

const root = document.getElementById('app');
if (root) {
  render(<App />, root);
}
