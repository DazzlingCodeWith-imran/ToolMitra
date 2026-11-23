import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { Layout } from '@/src/components/layout/Layout';
import { AboutPage } from '@/src/pages/AboutPage';
import { ContactPage } from '@/src/pages/ContactPage';
import { DisclaimerPage } from '@/src/pages/DisclaimerPage';
import { HomePage } from '@/src/pages/HomePage';
import { NotFoundPage } from '@/src/pages/NotFoundPage';
import { PrivacyPolicyPage } from '@/src/pages/PrivacyPolicyPage';
import { TermsPage } from '@/src/pages/TermsPage';
import { ToolPage } from '@/src/pages/ToolPage';
import { ToolsDirectoryPage } from '@/src/pages/ToolsDirectoryPage';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo(0, 0);
    }
  }, [pathname]);
  return null;
}

export function AppRoutes() {
  return (
    <Layout>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/tools" element={<ToolsDirectoryPage />} />
        <Route path="/tools/:slug" element={<ToolPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
        <Route path="/terms-and-conditions" element={<TermsPage />} />
        <Route path="/disclaimer" element={<DisclaimerPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Layout>
  );
}
