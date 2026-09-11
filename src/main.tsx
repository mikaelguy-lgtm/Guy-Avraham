import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import {ConfigurationErrorScreen, StartupErrorBoundary, StartupErrorScreen} from './components/StartupErrorBoundary.tsx';
import {createStartupRequestId, frontendEnvironment} from './config/frontend.ts';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('SC-ROOT-001');
const root = createRoot(rootElement);

if (!frontendEnvironment.ok) {
  root.render(<ConfigurationErrorScreen issue={frontendEnvironment.issue} />);
} else {
  void import('./App.tsx').then(({default: App}) => {
    root.render(
      <StrictMode>
        <StartupErrorBoundary>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </StartupErrorBoundary>
      </StrictMode>,
    );
  }).catch(() => {
    root.render(<StartupErrorScreen code="SC-STARTUP-001" requestId={createStartupRequestId()} />);
  });
}
