import { MantineProvider, createTheme } from '@mantine/core';
import '@mantine/core/styles.css';
import '@mantine/dropzone/styles.css';
import { render } from 'preact';
import { App } from './App';
import { initLocale } from './i18n';
import './styles/global.css';

const theme = createTheme({
  primaryColor: 'indigo',
  fontFamily:
    'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontFamilyMonospace:
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
});

// Initialize locale before rendering
initLocale();

const root = document.getElementById('app');
if (root) {
  render(
    <MantineProvider theme={theme} forceColorScheme="dark">
      <App />
    </MantineProvider>,
    root,
  );
}
