import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Search,
  Settings,
  Radio,
  ChevronRight,
  X,
  Cpu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: React.ReactNode;
  settingsSlot?: React.ReactNode;
}

const navItems = [
  { path: "/dashboard", label: "Analytics Overview", icon: LayoutDashboard },
  { path: "/dashboard/analysis", label: "Ticket Analysis", icon: Search },
  { path: "/dashboard/models", label: "Model Zoo", icon: Cpu },
];

export default function DashboardLayout({ children, settingsSlot }: DashboardLayoutProps) {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-noc-bg">
      {/* Sidebar */}
      <motion.aside
        initial={{ width: 260 }}
        animate={{ width: sidebarOpen ? 260 : 64 }}
        transition={{ duration: 0.2 }}
        className="relative flex flex-col border-r border-noc-border bg-noc-surface/50 backdrop-blur-md"
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-noc-border px-4">
          <Radio className="h-6 w-6 shrink-0 text-noc-accent" />
          {sidebarOpen && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-sm font-bold tracking-tight text-noc-text"
            >
              NOC Control Center
            </motion.span>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto h-8 w-8"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <ChevronRight
              className={cn("h-4 w-4 transition-transform", !sidebarOpen && "rotate-180")}
            />
          </Button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 space-y-1 p-2">
          {navItems.map((item) => {
            const isActive =
              item.path === "/dashboard"
                ? location.pathname === "/dashboard"
                : location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                  isActive
                    ? "bg-noc-accent/10 text-noc-accent"
                    : "text-noc-text-muted hover:bg-noc-surface-hover hover:text-noc-text",
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Settings button */}
        <div className="border-t border-noc-border p-2">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-noc-text-muted"
            onClick={() => setSettingsOpen(!settingsOpen)}
          >
            <Settings className="h-4 w-4 shrink-0" />
            {sidebarOpen && <span>Settings</span>}
          </Button>
        </div>
      </motion.aside>

      {/* Settings drawer overlay */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSettingsOpen(false)} />
          <motion.div
            initial={{ x: 300 }}
            animate={{ x: 0 }}
            exit={{ x: 300 }}
            className="relative z-10 w-80 border-l border-noc-border bg-noc-surface p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Settings</h3>
              <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-6">{settingsSlot}</div>
          </motion.div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="p-6 lg:p-8"
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
