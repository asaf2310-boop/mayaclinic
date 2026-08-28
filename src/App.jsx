import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Home from './pages/Home';
import Book from './pages/Book';
import Admin from './pages/Admin';
import AdminPatient from './pages/AdminPatient';
import PaymentSuccess from './pages/PaymentSuccess';
import PaymentFailure from './pages/PaymentFailure';
import GiftVoucher from './pages/GiftVoucher';
import GiftVoucherCard from './pages/GiftVoucherCard';
import DemoDocumentTitle from './components/DemoDocumentTitle';
import ClinicBootstrap from './components/ClinicBootstrap';
import AdminPwaManifest from './components/AdminPwaManifest';
import ProtectedRoute from './components/ProtectedRoute';
import AdminLoginRequired from './components/AdminLoginRequired';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
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
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/book" element={<Book />} />
      <Route path="/gift" element={<GiftVoucher />} />
      <Route path="/gift/card" element={<GiftVoucherCard />} />
      <Route path="/payment/success" element={<PaymentSuccess />} />
      <Route path="/payment/failure" element={<PaymentFailure />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<AdminLoginRequired />} />}>
        <Route path="/admin" element={<Admin />} />
        <Route path="/admin/patient/:patientKey" element={<AdminPatient />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <DemoDocumentTitle />
        <ClinicBootstrap />
        <Router>
          <AdminPwaManifest />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
