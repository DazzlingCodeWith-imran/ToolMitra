import { BrowserRouter } from 'react-router-dom';
import { AnalyticsLoader } from './components/common/AnalyticsLoader';
import { ThemeProvider } from './context/ThemeContext';
import { AppRoutes } from './routes/AppRoutes';

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AnalyticsLoader />
        <AppRoutes />
      </BrowserRouter>
    </ThemeProvider>
  );
}
