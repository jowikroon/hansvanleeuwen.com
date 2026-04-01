import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  ExternalLink, LogOut, BarChart3, Workflow, Globe, Newspaper,
  Database, Shield, Bot, Sparkles, Activity, Server, DollarSign,
  PenLine, Clock, Home, Cpu, CheckCircle2, ChevronDown,
  Plus, Trash2, X, Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ToolCard {
  id: string;
  name: string;
  description: string;
  icon: string;
  url: string;
  badge?: string;
  internal?: boolean;
  custom?: boolean;
}

const ICON_MAP: Record<string, typeof BarChart3> = {
  DollarSign, Sparkles, PenLine, Workflow, Database, Globe, Newspaper, Shield, Bot,
  BarChart3, Server, Activity, Cpu, Home, Zap,
};

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "Working late";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

const DEFAULT_TOOLS: ToolCard[] = [
  { id: "mg-profit", name: "Profitability", description: "Per-SKU margins, FIFO COGS, 15+ fee categories.", icon: "DollarSign", url: "https://marketplacegrowth.nl/app", badge: "Live" },
  { id: "mg-content", name: "Content Builder", description: "AI 5-step wizard with inline editing and compliance.", icon: "Sparkles", url: "https://marketplacegrowth.nl/app", badge: "Live" },
  { id: "blog-cms", name: "Blog CMS", description: "3 voice templates, markdown editor, AI improve.", icon: "PenLine", url: "/portal/blog", internal: true },
  { id: "n8n", name: "n8n Workflows", description: "34+ workflows — news, sync, agents, reports.", icon: "Workflow", url: "https://n8n.srv1402218.hstgr.cloud", badge: "Self-hosted" },
  { id: "supabase", name: "Supabase", description: "70+ tables, Vault, edge functions, pg_cron.", icon: "Database", url: "https://supabase.com/dashboard/project/pesfakewujjwkyybwaom" },
  { id: "vercel", name: "Vercel", description: "Auto-deploy for both sites.", icon: "Globe", url: "https://vercel.com/hansvl3-4255s-projects" },
  { id: "news", name: "News Intelligence", description: "26 sources, AI categorization, Reddit discovery.", icon: "Newspaper", url: "https://marketplacegrowth.nl/app", badge: "30min" },
  { id: "admin", name: "User Directory", description: "User management, onboarding, roles.", icon: "Shield", url: "https://marketplacegrowth.nl/app/admin/users", badge: "Admin" },
  { id: "samantha", name: "Samantha AI", description: "Personal assistant + 4 specialist agents.", icon: "Bot", url: "https://t.me/Samanthahansbot", badge: "Voice" },
];

const Portal = () => {
  const { user, loading, signInWithGoogle, signOut } = useAuth();
  const [now, setNow] = useState(new Date());
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [tools, setTools] = useState<ToolCard[]>(DEFAULT_TOOLS);
  const [showAddTool, setShowAddTool] = useState(false);
  const [newTool, setNewTool] = useState({ name: "", description: "", url: "", icon: "Zap", badge: "" });

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  // Load custom tools from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("hvl_custom_tools");
    if (saved) {
      try {
        const custom = JSON.parse(saved) as ToolCard[];
        setTools([...DEFAULT_TOOLS, ...custom]);
      } catch {}
    }
  }, []);

  function saveCustomTools(allTools: ToolCard[]) {
    const custom = allTools.filter((t) => t.custom);
    localStorage.setItem("hvl_custom_tools", JSON.stringify(custom));
    setTools(allTools);
  }

  function addTool() {
    if (!newTool.name || !newTool.url) return;
    const tool: ToolCard = {
      id: `custom-${Date.now()}`,
      name: newTool.name,
      description: newTool.description,
      icon: newTool.icon,
      url: newTool.url,
      badge: newTool.badge || undefined,
      custom: true,
    };
    saveCustomTools([...tools, tool]);
    setNewTool({ name: "", description: "", url: "", icon: "Zap", badge: "" });
    setShowAddTool(false);
  }

  function removeTool(id: string) {
    saveCustomTools(tools.filter((t) => t.id !== id));
  }

  if (loading) {
    return (
      <section className="section-container flex min-h-[60vh] items-center justify-center pt-28">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">Loading...</p>
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
            Sign in to access your tools, dashboards, and AI agents.
          </p>
          <button
            onClick={signInWithGoogle}
            className="inline-flex items-center gap-3 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-all hover:opacity-80"
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
  const toggle = (id: string) => setExpandedSection(expandedSection === id ? null : id);

  const agents = [
    { name: "Samantha", model: "Sonnet 4.6", channel: "@Samanthahansbot", role: "Personal assistant", color: "text-pink-500" },
    { name: "Marktpuls", model: "Haiku 4.5", channel: "@marketplacegrowthbot", role: "E-commerce intel", color: "text-blue-500" },
    { name: "InfraWacht", model: "Haiku 4.5", channel: "@InfraWachtBot", role: "Infra monitoring", color: "text-amber-500" },
    { name: "Dagstart", model: "Haiku 4.5", channel: "@DagstartBot", role: "Morning briefing", color: "text-emerald-500" },
    { name: "VerkoopPiloot", model: "Sonnet 4.6", channel: "@VerkoopPilootBot", role: "Listing generation", color: "text-violet-500" },
  ];

  const services = [
    { name: "MarketplaceGrowth.nl", status: "live", detail: "Vercel · React + Supabase" },
    { name: "HansVanLeeuwen.com", status: "live", detail: "Vercel · React + Supabase" },
    { name: "n8n Automation", status: "live", detail: "34 workflows" },
    { name: "Supabase Cloud", status: "live", detail: "70+ tables" },
    { name: "OpenClaw Gateway", status: "live", detail: "5 agents" },
    { name: "News Pipeline", status: "active", detail: "30-min · 26 sources" },
    { name: "Profit Snapshots", status: "active", detail: "Daily 05:30" },
    { name: "Sales Sync", status: "active", detail: "Every 4h" },
    { name: "InfraWacht", status: "active", detail: "Every 6h" },
    { name: "Dagstart", status: "active", detail: "Daily 07:30" },
  ];

  const liveCount = services.filter((s) => s.status === "live").length;
  const activeCount = services.filter((s) => s.status === "active").length;

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
          <button onClick={signOut} className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
            <LogOut size={14} /> Sign out
          </button>
        </div>

        {/* Tools Grid */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Tools & Dashboards</h2>
            <button
              onClick={() => setShowAddTool(!showAddTool)}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Plus size={12} /> Add tool
            </button>
          </div>

          {/* Add tool form */}
          <AnimatePresence>
            {showAddTool && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden mb-4"
              >
                <div className="rounded-xl border border-border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Add Custom Tool</p>
                    <button onClick={() => setShowAddTool(false)} className="text-muted-foreground hover:text-foreground"><X size={14} /></button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input value={newTool.name} onChange={(e) => setNewTool({ ...newTool, name: e.target.value })} placeholder="Tool name" className="rounded-lg border border-border bg-card px-3 py-2 text-sm" />
                    <input value={newTool.url} onChange={(e) => setNewTool({ ...newTool, url: e.target.value })} placeholder="URL (https://... or /path)" className="rounded-lg border border-border bg-card px-3 py-2 text-sm" />
                    <input value={newTool.description} onChange={(e) => setNewTool({ ...newTool, description: e.target.value })} placeholder="Description" className="rounded-lg border border-border bg-card px-3 py-2 text-sm" />
                    <div className="flex gap-2">
                      <select value={newTool.icon} onChange={(e) => setNewTool({ ...newTool, icon: e.target.value })} className="rounded-lg border border-border bg-card px-3 py-2 text-sm flex-1">
                        {Object.keys(ICON_MAP).map((k) => <option key={k} value={k}>{k}</option>)}
                      </select>
                      <input value={newTool.badge} onChange={(e) => setNewTool({ ...newTool, badge: e.target.value })} placeholder="Badge" className="rounded-lg border border-border bg-card px-3 py-2 text-sm w-24" />
                    </div>
                  </div>
                  <button onClick={addTool} disabled={!newTool.name || !newTool.url} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
                    Add Tool
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tools.map((tool, i) => {
              const isInternal = tool.internal || tool.url.startsWith("/");
              const Icon = ICON_MAP[tool.icon] || Zap;

              const cardContent = (
                <motion.div
                  key={tool.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: i * 0.04 }}
                  className="group relative rounded-xl border border-border p-5 transition-all duration-200 hover:border-primary/30 hover:shadow-md"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="h-10 w-10 rounded-lg bg-muted/50 flex items-center justify-center group-hover:bg-muted transition-colors">
                      <Icon size={20} className="text-primary" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      {tool.badge && <Badge className="text-[9px] border-0 bg-muted text-muted-foreground">{tool.badge}</Badge>}
                      {tool.custom && (
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeTool(tool.id); }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10"
                        >
                          <Trash2 size={12} className="text-destructive" />
                        </button>
                      )}
                    </div>
                  </div>
                  <h3 className="mb-1 text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                    {tool.name}
                    {!isInternal && <ExternalLink size={10} className="ml-1.5 inline-block opacity-0 group-hover:opacity-60 transition-opacity" />}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{tool.description}</p>
                </motion.div>
              );

              // Internal links use React Router, external links navigate the full page
              if (isInternal) {
                return <Link key={tool.id} to={tool.url}>{cardContent}</Link>;
              }
              // External: window.location.href — opens as full page, NOT target="_blank"
              return (
                <a key={tool.id} href={tool.url} onClick={(e) => { e.preventDefault(); window.location.href = tool.url; }}>
                  {cardContent}
                </a>
              );
            })}
          </div>
        </div>

        {/* Agents */}
        <div className="mb-10">
          <button onClick={() => toggle("agents")} className="w-full flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
              <Bot size={14} className="text-primary" /> Samantha AI — 5 Agents
            </h2>
            <ChevronDown size={14} className={`text-muted-foreground transition-transform ${expandedSection === "agents" ? "rotate-180" : ""}`} />
          </button>
          <AnimatePresence>
            {(expandedSection === "agents" || expandedSection === null) && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                  {agents.map((a) => (
                    <a key={a.name} href={`https://t.me/${a.channel.slice(1)}`} className="group rounded-xl border border-border p-4 hover:border-primary/30 transition-all">
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

        {/* Services */}
        <div>
          <button onClick={() => toggle("services")} className="w-full flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
              <Activity size={14} className="text-primary" /> System Services ({services.length})
            </h2>
            <ChevronDown size={14} className={`text-muted-foreground transition-transform ${expandedSection === "services" ? "rotate-180" : ""}`} />
          </button>
          <AnimatePresence>
            {(expandedSection === "services" || expandedSection === null) && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="rounded-xl border border-border overflow-hidden">
                  {services.map((s) => (
                    <div key={s.name} className="flex items-center gap-3 px-4 py-2.5 border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${s.status === "live" ? "bg-green-500" : "bg-blue-500"}`} />
                      <span className="text-xs font-medium flex-1">{s.name}</span>
                      <span className="text-[10px] text-muted-foreground hidden sm:block">{s.detail}</span>
                      <Badge variant="outline" className={`text-[9px] ${s.status === "live" ? "text-green-500 border-green-500/20" : "text-blue-500 border-blue-500/20"}`}>
                        {s.status}
                      </Badge>
                    </div>
                  ))}
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
