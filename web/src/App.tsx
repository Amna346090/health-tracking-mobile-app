import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdminRoute } from './components/AdminRoute';
import { LoginPage } from './pages/LoginPage';
import { PatientsPage } from './pages/PatientsPage';
import { PatientDashboardPage } from './pages/PatientDashboardPage';
import { PatientPhotosPage } from './pages/PatientPhotosPage';
import { MedicationsPage } from './pages/MedicationsPage';
import { ManageUsersPage } from './pages/ManageUsersPage';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/patients" element={<PatientsPage />} />
            <Route path="/patients/:patientId" element={<PatientDashboardPage />} />
            <Route path="/patients/:patientId/photos" element={<PatientPhotosPage />} />
            <Route path="/medications" element={<MedicationsPage />} />
            <Route
              path="/users"
              element={
                <AdminRoute>
                  <ManageUsersPage />
                </AdminRoute>
              }
            />
          </Route>
          <Route path="*" element={<Navigate to="/patients" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
