import { UserApprovalsScreen } from "@/features/admin";
import {
  AuthProvider,
  AuthScreen,
  RequireAuth,
  SecurityScreen,
} from "@/features/auth";
import { BrowserRouter, Route, Routes } from "react-router";
import { HomeScreen } from "@/pages/home-screen";
import { NotFound } from "@/pages/not-found";
import { RouteProvider } from "@/app/providers/router-provider";
import { ThemeProvider } from "@/app/providers/theme-provider";
import { LegalLinks } from "@/components/legal-links";
import { LegalScreen } from "@/pages/legal-screen";

export const App = () => (
  <ThemeProvider>
    <BrowserRouter>
      <RouteProvider>
        <AuthProvider>
          <Routes>
            <Route
              path="/privacy"
              element={<LegalScreen document="privacy" />}
            />
            <Route path="/terms" element={<LegalScreen document="terms" />} />
            <Route path="/login" element={<AuthScreen key="login" />} />
            <Route
              path="/register"
              element={<AuthScreen key="register" registration />}
            />
            <Route element={<RequireAuth />}>
              <Route path="/settings/security" element={<SecurityScreen />} />
              <Route path="/" element={<HomeScreen />} />
              <Route path="/admin/users" element={<UserApprovalsScreen />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
          <footer className="border-t border-secondary bg-primary px-6 py-6">
            <LegalLinks />
          </footer>
        </AuthProvider>
      </RouteProvider>
    </BrowserRouter>
  </ThemeProvider>
);
