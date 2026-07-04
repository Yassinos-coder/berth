import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from '@/layout/AppShell';
import { RequireAuth } from '@/layout/RequireAuth';
import { LoginPage } from '@/pages/LoginPage';
import { OnboardingPage } from '@/pages/OnboardingPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { ServicesPage } from '@/pages/ServicesPage';
import { NewServicePage } from '@/pages/NewServicePage';
import { ServiceDetailPage } from '@/pages/ServiceDetailPage';
import { ServersPage } from '@/pages/ServersPage';
import { ServerDetailPage } from '@/pages/ServerDetailPage';
import { DeploymentsPage } from '@/pages/DeploymentsPage';
import { TemplatesPage } from '@/pages/TemplatesPage';
import { TeamPage } from '@/pages/TeamPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/setup" element={<OnboardingPage />} />
      <Route path="/onboarding" element={<Navigate to="/setup" replace />} />

      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="services" element={<ServicesPage />} />
        <Route path="services/new" element={<NewServicePage />} />
        <Route path="services/:id" element={<ServiceDetailPage />} />
        <Route path="servers" element={<ServersPage />} />
        <Route path="servers/:id" element={<ServerDetailPage />} />
        <Route path="deployments" element={<DeploymentsPage />} />
        <Route path="templates" element={<TemplatesPage />} />
        <Route path="team" element={<TeamPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      <Route path="/404" element={<NotFoundPage />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  );
}
