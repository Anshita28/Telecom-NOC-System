import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import LandingPage from "@/pages/LandingPage";
import DashboardPage from "@/pages/DashboardPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/dashboard/*" element={<DashboardPage />} />
          <Route
            path="*"
            element={
              <div className="flex min-h-screen items-center justify-center bg-noc-bg">
                <div className="text-center">
                  <h1 className="text-6xl font-bold text-noc-accent">404</h1>
                  <p className="mt-4 text-noc-text-muted">Page not found</p>
                  <a
                    href="/"
                    className="mt-6 inline-block rounded-lg bg-noc-accent px-6 py-3 text-sm font-semibold text-noc-bg transition hover:bg-noc-accent-dim"
                  >
                    Back to Home
                  </a>
                </div>
              </div>
            }
          />
        </Routes>
      </BrowserRouter>
      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          style: {
            background: "#1e293b",
            border: "1px solid #334155",
            color: "#e2e8f0",
          },
        }}
      />
    </QueryClientProvider>
  );
}
