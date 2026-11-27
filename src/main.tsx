import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import {ConfigurationErrorScreen, StartupErrorBoundary, StartupErrorScreen} from './components/StartupErrorBoundary.tsx';
import {createStartupRequestId, frontendEnvironment} from './config/frontend.ts';
import {z} from 'zod';
import './index.css';

// Zod בודק אם מותר להריץ `new Function` (לקומפילציית JIT של סכמות). תחת CSP ללא 'unsafe-eval'
// הבדיקה נכשלת בשקט אבל מייצרת דיווח הפרה בכל טעינה. jitless מדלג על הבדיקה — אותה ולידציה בדיוק.
z.config({jitless: true});

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
