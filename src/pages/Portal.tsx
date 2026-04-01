import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  ExternalLink, LogOut, BarChart3, Workflow, Globe, Newspaper,
  Database, Shield, Bot, Sparkles, Activity, Server, DollarSign,
  PenLine, Clock, Home, Cpu, CheckCircle2, AlertTriangle,
  RefreshCw, Zap, ChevronDown, ChevronUp, Radio, Wifi, WifiOff,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

// ── Types ──
interface ToolCard {
  id: string;
  name: string;
  description: string;
  icon: typeof BarChart3;
  url: string;
  color: string;
  badge?: string;
  badgeColor?: string;
  internal?: boolean;
}

interface ServiceRow {
  name: string;
  status: "live" | "active" | "degraded" | "down";
  detail: string;
  category: "core" | "cron" | "agent";
}

// ── Greeting ──
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "Working late";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function timeAgo(date: Date): string {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const Portal = () => {
  const { user, loading, signInWithGoogle, signOut } = useAuth();
  const [now, setNow] = useState(new Date());
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  if (loading) {
    return (
      <section className="section-container flex min-h-[60vh] items-center justify-center pt-28">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">Loading portal...</p>
        </div>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="section-container flex min-h-[70vh] flex-col items-center justify-center pt-28">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="text-center"
        >
          <div className="mx-auto mb-6 h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Zap className="h-8 w-8 text-primary" />
          </div>
          <h1 className="mb-3 font-display text-4xl font-medium text-foreground">Portal</h1>
          <p className="mb-8 max-w-md text-muted-foreground leading-relaxed">
            Your operational command center. Sign in to access tools, dashboards, AI agents, and infrastructure monitoring.
          </p>
          <button
            onClick={signInWithGoogle}
            className="inline-flex items-center gap-3 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-all hover:opacity-80 hover:shadow-lg"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" className="shrink-0">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Sign in with Google
          </button>
        </motion.div>
      </section>
    );
  }

  const displayName = user.user_metadata?.full_name || user.email?.split("@")[0] || "Hans";

  // ── Tools ──
  const tools: ToolCard[] = [
    { id: "mg-profit", name: "Profitability", description: "Per-SKU margins, FIFO COGS, 15+ fee categories, TACoS tracking.", icon: DollarSign, url: "https://marketplacegrowth.nl/app", color: "text-green-500", badge: "Live", badgeColor: "bg-green-500/10 text-green-500" },
    { id: "mg-content", name: "Content Builder", description: "AI-powered 5-step wizard with inline editing and compliance engine.", icon: Sparkles, url: "https://marketplacegrowth.nl/app", color: "text-violet-500", badge: "Live", badgeColor: "bg-violet-500/10 text-violet-500" },
    { id: "blog-cms", name: "Blog CMS", description: "3 voice templates, markdown editor, revision history, AI improve.", icon: PenLine, url: "/portal/blog", color: "text-primary", internal: true },
    { id: "n8n", name: "n8n Workflows", description: "34+ workflows — news, sync, agents, reports, smart home.", icon: Workflow, url: "https://n8n.srv1402218.hstgr.cloud", color: "text-orange-500", badge: "Self-hosted" },
    { id: "supabase", name: "Supabase", description: "70+ tables, Vault, 13 edge functions, pg_cron jobs.", icon: Database, url: "https://supabase.com/dashboard/project/pesfakewujjwkyybwaom", color: "text-emerald-500" },
    { id: "vercel", name: "Vercel", description: "Auto-deploy for marketplacegrowth.nl + hansvanleeuwen.com.", icon: Globe, url: "https://vercel.com/hansvl3-4255s-projects", color: "text-foreground" },
    { id: "news", name: "News Intelligence", description: "26 sources, 6 regions, AI categorization, Reddit self-learning.", icon: Newspaper, url: "https://marketplacegrowth.nl/app", color: "text-blue-500", badge: "30min" },
    { id: "admin", name: "User Directory", description: "User management, onboarding toggles, role assignment.", icon: Shield, url: "https://marketplacegrowth.nl/app/admin/users", color: "text-yellow-500", badge: "Admin" },
    { id: "samantha", name: "Samantha AI", description: "Personal assistant + 4 specialist agents via Telegram.", icon: Bot, url: "https://t.me/Samanthahansbot", color: "text-pink-500", badge: "Voice" },
  ];

  // ── Infrastructure ──
  const infra = [
    { name: "VPS 2", subtitle: "OpenClaw + Ollama", icon: Server, specs: "KVM 4 · 16GB · 4 vCPU · 200GB NVMe", ip: "187.124.2.66", tailscale: "100.81.168.2", status: "live" as const },
    { name: "VPS 1", subtitle: "n8n + Supabase + Qdrant", icon: Cpu, specs: "srv1402218.hstgr.cloud", ip: "187.124.1.75", tailscale: "—", status: "live" as const },
    { name: "Pi 5", subtitle: "Home Assistant", icon: Home, specs: "93 entities · MCP connected", ip: "—", tailscale: "100.86.198.76", status: "live" as const },
  ];

  // ── Agents ──
  const agents = [
    { name: "Samantha", model: "Sonnet 4.6", channel: "@Samanthahansbot", role: "Personal assistant, delegation hub", color: "text-pink-500" },
    { name: "Marktpuls", model: "Haiku 4.5", channel: "@marketplacegrowthbot", role: "E-commerce intelligence", color: "text-blue-500" },
    { name: "InfraWacht", model: "Haiku 4.5", channel: "@InfraWachtBot", role: "Infra monitoring + CRITICAL alerts", color: "text-amber-500" },
    { name: "Dagstart", model: "Haiku 4.5", channel: "@DagstartBot", role: "Morning briefing", color: "text-emerald-500" },
    { name: "VerkoopPiloot", model: "Sonnet 4.6", channel: "@VerkoopPilootBot", role: "Listing generation (HITL)", color: "text-violet-500" },
  ];

  // ── Services ──
  const services: ServiceRow[] = [
    { name: "MarketplaceGrowth.nl", status: "live", detail: "Vercel · React + Supabase", category: "core" },
    { name: "HansVanLeeuwen.com", status: "live", detail: "Vercel · React + Supabase", category: "core" },
    { name: "n8n Automation", status: "live", detail: "34 workflows · Self-hosted", category: "core" },
    { name: "Supabase Cloud", status: "live", detail: "eu-central-1 · 70+ tables", category: "core" },
    { name: "OpenClaw Gateway", status: "live", detail: "5 agents · Telegram + WhatsApp", category: "core" },
    { name: "News Pipeline", status: "active", detail: "30-min cron · 26 RSS sources", category: "cron" },
    { name: "Reddit Discovery", status: "active", detail: "6-hour cron · 6 subreddits", category: "cron" },
    { name: "Profit Snapshots", status: "active", detail: "Daily 05:30 · pg_cron", category: "cron" },
    { name: "Sales Sync", status: "active", detail: "Every 4h · SP-API + Bol.com", category: "cron" },
    { name: "Settlements", status: "active", detail: "1st + 15th monthly", category: "cron" },
    { name: "InfraWacht Health", status: "active", detail: "Every 6h · VPS monitoring", category: "agent" },
    { name: "Dagstart Brief", status: "active", detail: "Daily 07:30 · Morning summary", category: "agent" },
    { name: "Marktpuls Brief", status: "active", detail: "Mon-Fri 09:00 · News digest", category: "agent" },
  ];

  const liveCount = services.filter((s) => s.status === "live").length;
  const activeCount = services.filter((s) => s.status === "active").length;

  const toggle = (id: string) => setExpandedSection(expandedSection === id ? null : id);

  return (
    <section className="section-container pt-28 pb-20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Header */}
        <div className="mb-10 flex items-start justify-between">
          <div>
            <p className="mb-2 text-sm font-medium uppercase tracking-[0.2em] text-primary">Portal</p>
            <h1 className="mb-2 font-display text-4xl font-medium tracking-tight text-foreground">
              {getGreeting()}, {displayName}
            </h1>
            <p className="text-muted-foreground flex items-center gap-3">
              <span>{now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</span>
              <span className="text-border">|</span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                {liveCount} live · {activeCount} active
              </span>
            </p>
          </div>
          <button
            onClick={signOut}
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
          {[
            { label: "Services", value: `${liveCount + activeCount}`, sub: `${liveCount} live`, color: "text-green-500", icon: Activity },
            { label: "Agents", value: "5", sub: "2 Sonnet · 3 Haiku", color: "text-pink-500", icon: Bot },
            { label: "Workflows", value: "34+", sub: "n8n self-hosted", color: "text-orange-500", icon: Workflow },
            { label: "Supabase", value: "70+", sub: "tables with RLS", color: "text-emerald-500", icon: Database },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-border p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-medium text-muted-foreground">{s.label}</span>
                <s.icon size={14} className={s.color} />
              </div>
              <p className="text-2xl font-display font-medium">{s.value}</p>
              <p className="text-[11px] text-muted-foreground">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Tools Grid */}
        <div className="mb-10">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Tools & Dashboards</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tools.map((tool, i) => {
              const isInternal = tool.internal;
              const Wrapper = isInternal ? Link : "a";
              const props = isInternal ? { to: tool.url } : { href: tool.url, target: "_blank", rel: "noopener noreferrer" };
              return (
                <motion.div
                  key={tool.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: i * 0.04 }}
                >
                  <Wrapper
                    {...(props as any)}
                    className="group block rounded-xl border border-border p-5 transition-all duration-200 hover:border-primary/30 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="h-10 w-10 rounded-lg bg-muted/50 flex items-center justify-center group-hover:bg-muted transition-colors">
                        <tool.icon size={20} className={tool.color} />
                      </div>
                      {tool.badge && (
                        <Badge className={`text-[9px] border-0 ${tool.badgeColor ?? "bg-muted text-muted-foreground"}`}>{tool.badge}</Badge>
                      )}
                    </div>
                    <h3 className="mb-1 text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                      {tool.name}
                      {!isInternal && <ExternalLink size={10} className="ml-1.5 inline-block opacity-0 group-hover:opacity-60 transition-opacity" />}
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{tool.description}</p>
                  </Wrapper>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Infrastructure */}
        <div className="mb-10">
          <button onClick={() => toggle("infra")} className="w-full flex items-center justify-between mb-4 group">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
              <Server size={14} className="text-primary" /> Infrastructure
            </h2>
            <ChevronDown size={14} className={`text-muted-foreground transition-transform ${expandedSection === "infra" ? "rotate-180" : ""}`} />
          </button>
          <AnimatePresence>
            {(expandedSection === "infra" || expandedSection === null) && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="grid gap-3 sm:grid-cols-3">
                  {infra.map((node) => (
                    <div key={node.name} className="rounded-xl border border-border p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center">
                          <node.icon size={16} className="text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{node.name}</p>
                          <p className="text-[10px] text-muted-foreground">{node.subtitle}</p>
                        </div>
                        <span className="flex items-center gap-1 text-[10px] text-green-500">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Live
                        </span>
                      </div>
                      <div className="space-y-1 text-[11px] text-muted-foreground">
                        <p>{node.specs}</p>
                        {node.ip !== "—" && <p className="font-mono">IP: {node.ip}</p>}
                        {node.tailscale !== "—" && <p className="font-mono">Tailscale: {node.tailscale}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* AI Agents */}
        <div className="mb-10">
          <button onClick={() => toggle("agents")} className="w-full flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
              <Bot size={14} className="text-primary" /> Samantha AI — 5 Agents
            </h2>
            <ChevronDown size={14} className={`text-muted-foreground transition-transform ${expandedSection === "agents" ? "rotate-180" : ""}`} />
          </button>
          <AnimatePresence>
            {(expandedSection === "agents" || expandedSection === null) && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                  {agents.map((a) => (
                    <a
                      key={a.name}
                      href={`https://t.me/${a.channel.slice(1)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group rounded-xl border border-border p-4 hover:border-primary/30 transition-all"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Bot size={14} className={a.color} />
                        <span className="text-sm font-semibold group-hover:text-primary transition-colors">{a.name}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mb-1">{a.role}</p>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-muted-foreground/60 font-mono">{a.model}</span>
                        <span className="text-primary/60 font-mono">{a.channel}</span>
                      </div>
                    </a>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* System Services */}
        <div>
          <button onClick={() => toggle("services")} className="w-full flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
              <Activity size={14} className="text-primary" /> System Services ({services.length})
            </h2>
            <ChevronDown size={14} className={`text-muted-foreground transition-transform ${expandedSection === "services" ? "rotate-180" : ""}`} />
          </button>
          <AnimatePresence>
            {(expandedSection === "services" || expandedSection === null) && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="rounded-xl border border-border overflow-hidden">
                  {(["core", "cron", "agent"] as const).map((cat, ci) => {
                    const catServices = services.filter((s) => s.category === cat);
                    const catLabel = cat === "core" ? "Core Services" : cat === "cron" ? "Scheduled Jobs" : "Agent Workflows";
                    return (
                      <div key={cat}>
                        {ci > 0 && <div className="border-t border-border" />}
                        <div className="px-4 py-2 bg-muted/30">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{catLabel}</span>
                        </div>
                        {catServices.map((s) => (
                          <div key={s.name} className="flex items-center gap-3 px-4 py-2.5 border-t border-border/50 hover:bg-muted/20 transition-colors">
                            <span className={`h-2 w-2 rounded-full shrink-0 ${s.status === "live" ? "bg-green-500" : "bg-blue-500"}`} />
                            <span className="text-xs font-medium flex-1">{s.name}</span>
                            <span className="text-[10px] text-muted-foreground hidden sm:block">{s.detail}</span>
                            <Badge variant="outline" className={`text-[9px] ${s.status === "live" ? "text-green-500 border-green-500/20" : "text-blue-500 border-blue-500/20"}`}>
                              {s.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </section>
  );
};

export default Portal;
