import { BrowserRouter, Route, Routes } from "react-router";
import { HomeScreen } from "@/pages/home-screen";
import { NotFound } from "@/pages/not-found";
import { RouteProvider } from "@/app/providers/router-provider";
import { ThemeProvider } from "@/app/providers/theme-provider";

export const App = () => (
  <ThemeProvider>
    <BrowserRouter>
      <RouteProvider>
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </RouteProvider>
    </BrowserRouter>
  </ThemeProvider>
);
