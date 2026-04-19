import { createTheme, MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import '@mantine/dropzone/styles.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { initLocale } from './i18n';
import './styles/global.css';

const theme = createTheme({
  primaryColor: 'indigo',
  fontFamily:
    'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  fontFamilyMonospace:
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
});

// Initialize locale before rendering
initLocale();

const root = document.getElementById('app');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <MantineProvider theme={theme} defaultColorScheme="dark">
        <App />
      </MantineProvider>
    </StrictMode>,
  );
}
