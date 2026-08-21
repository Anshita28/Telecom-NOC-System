import { useRef, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useInView } from "framer-motion";
import {
  ArrowRight,
  Radio,
  Shield,
  Brain,
  BarChart3,
  AlertTriangle,
  MessageSquare,
  History,
  Zap,
  Cpu,
  Activity,
  ChevronRight,
  Heart,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// ---------------------------------------------------------------------------
// Animated section wrapper
// ---------------------------------------------------------------------------
function AnimatedSection({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Animated counter
// ---------------------------------------------------------------------------
function AnimatedCounter({ target, suffix = "", decimals = 0 }: {
  target: number;
  suffix?: string;
  decimals?: number;
}) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;
    let start = 0;
    const duration = 1500;
    const startTime = performance.now();

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(eased * target);
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, [isInView, target]);

  return (
    <span ref={ref} className="font-[family-name:var(--font-mono)]">
      {decimals > 0 ? count.toFixed(decimals) : Math.round(count)}{suffix}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------
const howItWorks = [
  {
    icon: Activity,
    title: "Ingest Telemetry",
    desc: "Real-time ingestion of network event logs, resource status signals, and severity classifications from telecom infrastructure.",
    color: "text-noc-accent",
    bg: "bg-noc-accent/10",
  },
  {
    icon: Cpu,
    title: "Six-Model Risk Fusion",
    desc: "Random Forest, XGBoost, and SVM vote on tabular tickets; LSTM and GRU read log bursts; a dense autoencoder flags early-warning anomalies.",
    color: "text-purple-400",
    bg: "bg-purple-400/10",
  },
  {
    icon: Shield,
    title: "XAI Signal Attribution",
    desc: "Feature importance weighting surfaces the top contributing telemetry signals behind each prediction — making model decisions auditable.",
    color: "text-risk-high",
    bg: "bg-risk-high/10",
  },
  {
    icon: Brain,
    title: "AI-Generated Diagnostics",
    desc: "Gemini-powered (with deterministic fallback) root-cause hypotheses, preventive maintenance protocols, and incident briefings.",
    color: "text-risk-low",
    bg: "bg-risk-low/10",
  },
];

const features = [
  { icon: BarChart3, title: "Fault Severity Classification", desc: "Ensemble of Random Forest, XGBoost, SVM, LSTM, and GRU across three Telstra severity tiers." },
  { icon: Zap, title: "Autoencoder Anomaly Detection", desc: "PyTorch dense autoencoder identifying network anomalies via reconstruction error analysis." },
  { icon: Shield, title: "Combined Risk Scoring", desc: "Weighted fusion of classifier confidence and anomaly score into a unified 0–1 risk metric." },
  { icon: Brain, title: "XAI Signal Attribution", desc: "Top feature contributions using weighted importance — every prediction is explainable." },
  { icon: AlertTriangle, title: "AI Root-Cause Hypotheses", desc: "Evidence-grounded root-cause analysis using Gemini 2.5 Flash or deterministic fallback." },
  { icon: Activity, title: "Preventive Maintenance", desc: "AI-generated diagnostic checks, maintenance protocols, and monitoring recommendations." },
  { icon: MessageSquare, title: "AI NOC Copilot Chat", desc: "Conversational copilot scoped to each ticket — ask questions about risk math, signals, and actions." },
  { icon: History, title: "Full Audit Trail", desc: "Every prediction and AI action logged to SQLite with timestamps, severity, and Gemini/local indicator." },
];

const stats = [
  { label: "XGBoost Accuracy", value: 72.71, suffix: "%", decimals: 2 },
  { label: "F1-Macro Score", value: 68.98, suffix: "%", decimals: 2 },
  { label: "Autoencoder ROC-AUC", value: 0.6377, suffix: "", decimals: 4 },
  { label: "Total Ticket Records", value: 7381, suffix: "", decimals: 0 },
];

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------
function HeroSection() {
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden">
      {/* Video Background */}
      {!prefersReducedMotion && (
        <video
          autoPlay
          loop
          muted
          playsInline
          poster="/hero-bg-poster.jpg"
          className="absolute inset-0 h-full w-full object-cover"
        >
          <source src="/hero-bg.mp4" type="video/mp4" />
        </video>
      )}

      {/* Gradient overlay */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(11,15,25,0.45), rgba(11,15,25,0.85) 70%, rgba(11,15,25,1) 100%)",
        }}
      />

      {/* Subtle grid pattern */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: "linear-gradient(rgba(56,189,248,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.5) 1px, transparent 1px)",
        backgroundSize: "60px 60px",
      }} />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.2 }}
        className="relative z-10 mx-auto max-w-4xl px-6 text-center"
      >
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mb-8 inline-flex items-center gap-2 rounded-full border border-noc-border/60 bg-noc-surface/40 px-4 py-1.5 text-xs font-medium text-noc-text-muted backdrop-blur-sm"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-risk-low opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-risk-low" />
          </span>
          Live Network Operations
        </motion.div>

        {/* Headline */}
        <h1 className="text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl md:text-7xl">
          <span className="bg-gradient-to-r from-noc-accent via-blue-400 to-cyan-300 bg-clip-text text-transparent">
            AI-Powered
          </span>{" "}
          Network
          <br />
          Fault Prediction
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-base text-noc-text-muted sm:text-lg">
          Ensemble of Random Forest, XGBoost, SVM, LSTM and GRU with a PyTorch autoencoder
          for early-warning anomalies — purpose-built for telecom NOC fault prediction and
          predictive maintenance.
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link to="/dashboard">
            <Button size="lg" className="gap-2 text-base">
              Open Dashboard
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <a href="#how-it-works">
            <Button variant="outline" size="lg" className="text-base">
              How It Works
            </Button>
          </a>
        </div>

        {/* Tech badges */}
        <div className="mt-14 flex flex-wrap items-center justify-center gap-3">
          {["Python 3.12", "XGBoost", "PyTorch LSTM/GRU", "scikit-learn", "FastAPI", "React"].map(
            (tech) => (
              <span
                key={tech}
                className="rounded-lg border border-noc-border/40 bg-noc-surface/30 px-3 py-1 text-xs text-noc-text-muted backdrop-blur-sm transition hover:border-noc-accent/40 hover:text-noc-accent"
              >
                {tech}
              </span>
            ),
          )}
        </div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="flex flex-col items-center gap-2"
        >
          <span className="text-[10px] uppercase tracking-widest text-noc-text-dim">Scroll</span>
          <ChevronRight className="h-4 w-4 rotate-90 text-noc-text-dim" />
        </motion.div>
      </motion.div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// How It Works
// ---------------------------------------------------------------------------
function HowItWorksSection() {
  return (
    <section id="how-it-works" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <AnimatedSection className="text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-noc-accent">How It Works</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            From Raw Telemetry to Actionable Intelligence
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-noc-text-muted">
            Four stages transform raw network signals into prioritized maintenance protocols
            — each step auditable and explainable.
          </p>
        </AnimatedSection>

        <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {howItWorks.map((step, i) => (
            <AnimatedSection key={step.title} delay={i * 0.12}>
              <Card className="group h-full transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/30">
                <CardContent className="p-6">
                  <div className={`mb-4 inline-flex rounded-xl p-3 ${step.bg}`}>
                    <step.icon className={`h-6 w-6 ${step.color}`} />
                  </div>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-noc-accent/20 text-xs font-bold text-noc-accent">
                      {i + 1}
                    </span>
                    <h3 className="text-base font-semibold">{step.title}</h3>
                  </div>
                  <p className="text-sm leading-relaxed text-noc-text-muted">{step.desc}</p>
                </CardContent>
              </Card>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------
function StatsSection() {
  return (
    <section className="relative py-20">
      {/* Gradient divider */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-noc-accent/30 to-transparent" />

      <div className="mx-auto max-w-5xl px-6">
        <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
          {stats.map((s, i) => (
            <AnimatedSection key={s.label} delay={i * 0.1} className="text-center">
              <p className="text-3xl font-bold text-noc-accent sm:text-4xl">
                <AnimatedCounter target={s.value} suffix={s.suffix} decimals={s.decimals} />
              </p>
              <p className="mt-2 text-sm text-noc-text-muted">{s.label}</p>
            </AnimatedSection>
          ))}
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-noc-accent/30 to-transparent" />
    </section>
  );
}

// ---------------------------------------------------------------------------
// Features
// ---------------------------------------------------------------------------
function FeaturesSection() {
  return (
    <section className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <AnimatedSection className="text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-noc-accent">Capabilities</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Enterprise-Grade NOC Intelligence
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-noc-text-muted">
            Every feature designed for network operations teams who need speed,
            explainability, and reliability.
          </p>
        </AnimatedSection>

        <div className="mt-16 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f, i) => (
            <AnimatedSection key={f.title} delay={i * 0.08}>
              <Card className="group h-full transition-all duration-300 hover:-translate-y-1 hover:border-noc-accent/30 hover:shadow-lg hover:shadow-noc-accent/5">
                <CardContent className="p-5">
                  <f.icon className="mb-3 h-5 w-5 text-noc-accent transition group-hover:scale-110" />
                  <h3 className="text-sm font-semibold">{f.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-noc-text-muted">{f.desc}</p>
                </CardContent>
              </Card>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------
function Footer() {
  return (
    <footer className="relative border-t border-noc-border bg-noc-surface/30 py-16">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col items-center gap-8 sm:flex-row sm:justify-between">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <Radio className="h-5 w-5 text-noc-accent" />
            <span className="text-sm font-bold">Telecom NOC</span>
          </div>

          {/* CTA */}
          <div className="text-center sm:text-right">
            <p className="text-sm text-noc-text-muted">Ready to see it in action?</p>
            <Link to="/dashboard" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-noc-accent hover:underline">
              Open the Dashboard <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-noc-border pt-8 sm:flex-row">
          <p className="text-xs text-noc-text-dim">
            © 2026 Telecom NOC Fault Prediction System. MIT License.
          </p>
          <div className="flex items-center gap-4 text-xs text-noc-text-dim">
            <span className="flex items-center gap-1">
              Built with <Heart className="h-3 w-3 text-risk-critical" /> using FastAPI + React
            </span>
            <a href="https://github.com" target="_blank" rel="noopener" className="hover:text-noc-accent transition">
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ---------------------------------------------------------------------------
// Landing Page
// ---------------------------------------------------------------------------
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-noc-bg text-noc-text">
      <HeroSection />
      <HowItWorksSection />
      <StatsSection />
      <FeaturesSection />
      <Footer />
    </div>
  );
}
