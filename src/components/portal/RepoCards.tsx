import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ExternalLink, GitBranch, Github } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  ACTIVE_WINDOW_DAYS, GITHUB_USER, GithubRepo, fetchRepos, filterActiveRepos, formatPushedAgo,
} from "@/lib/githubRepos";

/** One card per active GitHub repo; new repos show up automatically. */
const RepoCards = () => {
  const [repos, setRepos] = useState<GithubRepo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRepos()
      .then((all) => setRepos(filterActiveRepos(all)))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  return (
    <div className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
          <GitBranch size={14} className="text-primary" /> Repos & Tools{repos ? ` (${repos.length})` : ""}
        </h2>
        <span className="text-[10px] text-muted-foreground">Pushed in last {ACTIVE_WINDOW_DAYS} days</span>
      </div>

      {error && (
        <p className="text-xs text-muted-foreground">
          Could not load repos ({error}).{" "}
          <a href={`https://github.com/${GITHUB_USER}?tab=repositories`} className="text-primary hover:underline">Open GitHub</a>
        </p>
      )}
      {!repos && !error && <p className="text-xs text-muted-foreground">Loading repos...</p>}
      {repos && repos.length === 0 && <p className="text-xs text-muted-foreground">No active repos.</p>}

      {repos && repos.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {repos.map((repo, i) => (
            <motion.div
              key={repo.full_name}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.03 }}
              className="group relative flex flex-col rounded-xl border border-border p-5 transition-all duration-200 hover:border-primary/30 hover:shadow-md"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="h-10 w-10 rounded-lg bg-muted/50 flex items-center justify-center group-hover:bg-muted transition-colors">
                  <Github size={20} className="text-primary" />
                </div>
                <div className="flex items-center gap-1.5">
                  {repo.language && <Badge className="text-[9px] border-0 bg-muted text-muted-foreground">{repo.language}</Badge>}
                  {repo.homepage && <Badge className="text-[9px] border-0 bg-primary/10 text-primary">Live</Badge>}
                </div>
              </div>
              <h3 className="mb-1 text-sm font-semibold text-foreground">{repo.name}</h3>
              <p className="mb-4 flex-1 text-xs text-muted-foreground leading-relaxed">
                {repo.description || "No description."}
              </p>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground/60 font-mono">{formatPushedAgo(repo.pushed_at)}</span>
                <span className="flex items-center gap-3">
                  {repo.homepage && (
                    <a href={repo.homepage} className="inline-flex items-center gap-1 text-primary hover:underline">
                      Open <ExternalLink size={10} />
                    </a>
                  )}
                  <a href={repo.html_url} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
                    GitHub <ExternalLink size={10} />
                  </a>
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RepoCards;
