import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Onboarding from './pages/Onboarding';
import { base44 } from '@/api/base44Client';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin, user } = useAuth();
  const location = useLocation();
  const [fullUser, setFullUser] = React.useState(null);
  const [loadingFullUser, setLoadingFullUser] = React.useState(true);

  React.useEffect(() => {
    if (!isLoadingAuth && user) {
      base44.auth.me().then(u => {
        setFullUser(u);
        setLoadingFullUser(false);
      }).catch(() => setLoadingFullUser(false));
    } else if (!isLoadingAuth) {
      setLoadingFullUser(false);
    }
  }, [isLoadingAuth, user]);

  // Persist is_new_user flag in sessionStorage
  React.useEffect(() => {
    const urlIsNewUser = new URLSearchParams(location.search).get('is_new_user') === 'true';
    if (urlIsNewUser) sessionStorage.setItem('is_new_user', 'true');
  }, [location.search]);

  // Show loading spinner while checking auth
  if (isLoadingPublicSettings || isLoadingAuth || loadingFullUser) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  const isNewUser = sessionStorage.getItem('is_new_user') === 'true';
  const needsOnboarding = isNewUser || (fullUser && !fullUser.onboarding_completed);

  // Render the main app
  return (
    <Routes>
      {/* Onboarding — no layout wrapper, standalone page */}
      <Route path="/Onboarding" element={<Onboarding />} />

      <Route path="/" element={
        needsOnboarding
          ? <Navigate to="/Onboarding" replace />
          : <LayoutWrapper currentPageName={mainPageKey}><MainPage /></LayoutWrapper>
      } />
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            needsOnboarding
              ? <Navigate to="/Onboarding" replace />
              : <LayoutWrapper currentPageName={path}><Page /></LayoutWrapper>
          }
        />
      ))}
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App