import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import {
  ExternalLink, LogOut, BarChart3, Workflow, Globe, Newspaper,
  Database, Shield, Bot, Sparkles, Activity, Server,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ToolCard {
  id: string;
  name: string;
  description: string;
  icon: typeof BarChart3;
  url: string;
  color: string;
  badge?: string;
}

const Portal = () => {
  const { user, loading, signInWithGoogle, signOut } = useAuth();

  if (loading) {
    return (
      <section className="section-container flex min-h-[60vh] items-center justify-center pt-28">
        <p className="text-muted-foreground">Loading...</p>
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
          <h1 className="mb-4 font-display text-4xl font-medium text-foreground">Portal</h1>
          <p className="mb-8 max-w-md text-muted-foreground">
            Sign in to access your tools, dashboards, and automation workflows.
          </p>
          <button
            onClick={signInWithGoogle}
            className="inline-flex items-center gap-3 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-opacity hover:opacity-80"
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

  const tools: ToolCard[] = [
    {
      id: "mg-dashboard",
      name: "MarketplaceGrowth Dashboard",
      description: "Profitability tracking, content builder, and marketplace intelligence.",
      icon: BarChart3,
      url: "https://marketplacegrowth.nl/app",
      color: "text-green-500",
      badge: "Live",
    },
    {
      id: "n8n",
      name: "n8n Workflows",
      description: "30+ automation workflows — news ingestion, sync, AI pipelines.",
      icon: Workflow,
      url: "https://n8n.srv1402218.hstgr.cloud",
      color: "text-orange-500",
      badge: "Self-hosted",
    },
    {
      id: "supabase",
      name: "Supabase Dashboard",
      description: "PostgreSQL, Edge Functions, Vault, RLS policies, pg_cron jobs.",
      icon: Database,
      url: "https://supabase.com/dashboard/project/pesfakewujjwkyybwaom",
      color: "text-emerald-500",
    },
    {
      id: "vercel",
      name: "Vercel Deployments",
      description: "CI/CD pipeline for marketplacegrowth.nl and hansvanleeuwen.com.",
      icon: Globe,
      url: "https://vercel.com/hansvl3-4255s-projects",
      color: "text-foreground",
    },
    {
      id: "mg-news",
      name: "News Feed",
      description: "26 sources, 6 regions, AI-categorized marketplace intelligence.",
      icon: Newspaper,
      url: "https://marketplacegrowth.nl/app",
      color: "text-blue-500",
    },
    {
      id: "mg-admin",
      name: "User Directory",
      description: "Manage users, onboarding toggles, and workspace roles.",
      icon: Shield,
      url: "https://marketplacegrowth.nl/app/admin/users",
      color: "text-yellow-500",
      badge: "Admin",
    },
  ];

  const systemStatus = [
    { name: "MarketplaceGrowth", status: "live", url: "marketplacegrowth.nl" },
    { name: "n8n Automation", status: "live", url: "n8n.srv1402218.hstgr.cloud" },
    { name: "Supabase (eu-central-1)", status: "live", url: "pesfakewujjwkyybwaom" },
    { name: "OpenClaw Gateway", status: "live", url: "VPS2 (Tailscale)" },
    { name: "News Pipeline (30min)", status: "active", url: "26 RSS sources" },
    { name: "Profit Snapshots (daily)", status: "active", url: "pg_cron 05:30" },
  ];

  return (
    <section className="section-container pt-28 pb-20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Header */}
        <div className="mb-12 flex items-start justify-between">
          <div>
            <p className="mb-2 text-sm font-medium uppercase tracking-[0.2em] text-primary">Portal</p>
            <h1 className="mb-2 font-display text-4xl font-medium tracking-tight text-foreground">
              Command Center
            </h1>
            <p className="text-muted-foreground">Tools, dashboards, and system status.</p>
          </div>
          <button
            onClick={signOut}
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>

        {/* Tools Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-12">
          {tools.map((tool, i) => (
            <motion.a
              key={tool.id}
              href={tool.url}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="group rounded-lg border border-border p-6 text-left transition-all duration-300 hover:border-primary/30 hover:shadow-md"
            >
              <div className="flex items-start justify-between mb-4">
                <tool.icon size={24} className={tool.color} />
                {tool.badge && (
                  <Badge variant="secondary" className="text-[10px]">{tool.badge}</Badge>
                )}
              </div>
              <h3 className="mb-1 font-display text-lg font-medium text-foreground">
                {tool.name}
                <ExternalLink size={12} className="ml-2 inline-block opacity-0 transition-opacity group-hover:opacity-100" />
              </h3>
              <p className="text-sm text-muted-foreground">{tool.description}</p>
            </motion.a>
          ))}
        </div>

        {/* System Status */}
        <div>
          <h2 className="mb-4 font-display text-xl font-medium text-foreground flex items-center gap-2">
            <Activity size={18} className="text-primary" />
            System Status
          </h2>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Service</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Endpoint</th>
                </tr>
              </thead>
              <tbody>
                {systemStatus.map((s) => (
                  <tr key={s.name} className="border-b last:border-0">
                    <td className="px-4 py-2.5 font-medium text-xs">{s.name}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center gap-1.5 text-xs ${s.status === "live" ? "text-green-500" : "text-blue-500"}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${s.status === "live" ? "bg-green-500" : "bg-blue-500"}`} />
                        {s.status === "live" ? "Live" : "Active"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono">{s.url}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>
    </section>
  );
};

export default Portal;
