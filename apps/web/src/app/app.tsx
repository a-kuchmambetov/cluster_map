import { AuthProvider, AuthScreen, RequireAuth } from "@/features/auth";
import { BrowserRouter, Route, Routes } from "react-router";
import { HomeScreen } from "@/pages/home-screen";
import { NotFound } from "@/pages/not-found";
import { RouteProvider } from "@/app/providers/router-provider";
import { ThemeProvider } from "@/app/providers/theme-provider";

export const App = () => (
  <ThemeProvider>
    <BrowserRouter>
      <RouteProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<AuthScreen key="login" />} />
            <Route
              path="/register"
              element={<AuthScreen key="register" registration />}
            />
            <Route element={<RequireAuth />}>
              <Route path="/" element={<HomeScreen />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </RouteProvider>
    </BrowserRouter>
  </ThemeProvider>
);
