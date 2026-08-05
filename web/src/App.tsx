import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdminRoute } from './components/AdminRoute';
import { LoginPage } from './pages/LoginPage';
import { PatientsPage } from './pages/PatientsPage';
import { PatientDashboardPage } from './pages/PatientDashboardPage';
import { PatientPhotosPage } from './pages/PatientPhotosPage';
import { PatientDocumentsPage } from './pages/PatientDocumentsPage';
import { MedicationsPage } from './pages/MedicationsPage';
import { AppointmentsPage } from './pages/AppointmentsPage';
import { TestRequestsPage } from './pages/TestRequestsPage';
import { TouchBaseQueuePage } from './pages/TouchBaseQueuePage';
import { SettingsPage } from './pages/SettingsPage';
import { ManageUsersPage } from './pages/ManageUsersPage';
import { NotificationsPage } from './pages/NotificationsPage';

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
            <Route path="/patients/:patientId/documents" element={<PatientDocumentsPage />} />
            <Route path="/medications" element={<MedicationsPage />} />
            <Route path="/appointments" element={<AppointmentsPage />} />
            <Route path="/test-requests" element={<TestRequestsPage />} />
            <Route path="/touch-base" element={<TouchBaseQueuePage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route
              path="/users"
              element={
                <AdminRoute>
                  <ManageUsersPage />
                </AdminRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <AdminRoute>
                  <SettingsPage />
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
