import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Radio, Lock, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { loginAuth, setAuthToken, getAuthToken } from "@/lib/api";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = new URLSearchParams(location.search).get("next") || "/dashboard";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // If user already has a valid token, skip straight to dashboard
  useEffect(() => {
    if (getAuthToken()) {
      navigate(redirectTo, { replace: true });
    }
  }, [navigate, redirectTo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error("Please enter both username and password.");
      return;
    }
    setLoading(true);
    try {
      const data = await loginAuth({
        username: username.trim(),
        password,
      });
      // NOTE: localStorage is used here purely for hackathon timeline simplicity.
      // For real production deployments: use httpOnly secure cookies instead
      // (localStorage is vulnerable to XSS if an attacker runs script).
      setAuthToken(data.access_token);
      toast.success("Signed in. Welcome back.");
      navigate(redirectTo, { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("401")) {
        toast.error("Incorrect username or password.");
      } else {
        toast.error(`Login failed: ${msg}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-noc-bg">
      {/* Grid / gradient backdrop matching LandingPage theme */}
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "linear-gradient(rgba(140, 255, 116, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(140, 255, 116, 0.05) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(140,255,116,0.08),transparent_60%)]" />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Brand */}
          <Link to="/" className="mb-10 flex items-center justify-center gap-3 text-noc-text hover:text-noc-accent">
            <Radio className="h-7 w-7 text-noc-accent" />
            <span className="text-lg font-bold tracking-tight">NOC Control Center</span>
          </Link>

          {/* Login card */}
          <div className="rounded-2xl border border-noc-border bg-noc-surface/70 p-8 shadow-2xl backdrop-blur-md">
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-bold text-noc-text">Sign in</h1>
              <p className="mt-2 text-sm text-noc-text-muted">
                Use your demo credentials to access the fault prediction dashboard.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-noc-text-muted">Username</label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-noc-text-muted" />
                  <input
                    type="text"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="demo-admin"
                    className="w-full rounded-lg border border-noc-border bg-noc-bg/60 py-2.5 pl-10 pr-3 text-sm text-noc-text placeholder:text-noc-text-muted/60 focus:border-noc-accent focus:outline-none focus:ring-1 focus:ring-noc-accent"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-noc-text-muted">Password</label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-noc-text-muted" />
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-lg border border-noc-border bg-noc-bg/60 py-2.5 pl-10 pr-3 text-sm text-noc-text placeholder:text-noc-text-muted/60 focus:border-noc-accent focus:outline-none focus:ring-1 focus:ring-noc-accent"
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full !bg-noc-accent !text-noc-bg hover:!bg-noc-accent-dim"
                disabled={loading}
              >
                {loading ? "Signing in..." : "Sign in"}
              </Button>
            </form>

            <div className="mt-6 rounded-lg border border-noc-border/60 bg-noc-bg/40 p-3 text-xs text-noc-text-muted">
              <span className="font-semibold text-noc-accent">Demo-only auth:</span> Credentials
              are read from the backend environment (DEMO_USERNAME / DEMO_PASSWORD). There's no
              registration — ask the presenter for access.
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-noc-text-muted">
            <Link to="/" className="hover:text-noc-accent">← Back to landing page</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
