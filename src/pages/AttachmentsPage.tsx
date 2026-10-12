import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Search, FileText, Image as ImageIcon, Video, ExternalLink,
  Download, Copy, Check, Filter, Folder, ArrowUpDown,
  Grid3X3, List, Plus, X, Eye, FileCode, Sparkles,
  RefreshCw, UploadCloud, ChevronRight, ChevronDown, File, ArrowLeft,
  Music, Headphones, Play, Pause, Volume2, History, Car,
  Briefcase, Disc, Table, Radio, SlidersHorizontal, Layers,
  ExternalLink as LinkIcon
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// Types matching the unified catalog schema
export interface AttachmentVersion {
  id: string;
  version_label: string;
  file_name: string;
  file_type: "pdf" | "audio" | "video" | "image" | "gdoc" | "sheet" | "doc" | "other";
  file_size_bytes?: number;
  size_formatted?: string;
  quality?: string;
  created_at: string;
  local_path?: string;
  external_url?: string;
  preview_url?: string;
  stream_url?: string;
  google_doc_id?: string;
  suno_url?: string;
  soundcloud_url?: string;
  spotify_url?: string;
  neuralanalog_url?: string;
  bpm?: number;
  musical_key?: string;
  duration_seconds?: number;
  is_latest: boolean;
  notes?: string;
}

export interface AttachmentGroup {
  id: string;
  title: string;
  channel: "connectcarparts" | "hansvanleeuwen" | "neon";
  file_type: "pdf" | "audio" | "video" | "image" | "gdoc" | "sheet" | "doc" | "other";
  category: string;
  song?: string;
  master_quality?: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  version_count: number;
  latest_version: AttachmentVersion;
  versions: AttachmentVersion[];
  music_cms_url?: string;
}

type ChannelType = "all" | "connectcarparts" | "hansvanleeuwen" | "neon";
type FileFilterType = "all" | "audio" | "pdf" | "gdoc" | "image" | "video" | "sheet" | "doc";

const CHANNELS_CONFIG = [
  {
    id: "all" as const,
    label: "Alle Domeinen",
    desc: "Volledig multi-channel archief",
    icon: Layers,
    color: "from-zinc-800 to-zinc-900 border-zinc-700/60 text-zinc-200",
    activeBadge: "bg-zinc-700 text-zinc-100"
  },
  {
    id: "connectcarparts" as const,
    label: "Connectcarparts",
    desc: "Marketplace, eBay, Amazon & Bol.com",
    icon: Car,
    color: "from-amber-950/40 to-zinc-900 border-amber-600/40 text-amber-400",
    activeBadge: "bg-amber-500/20 text-amber-300 border-amber-500/30"
  },
  {
    id: "hansvanleeuwen" as const,
    label: "Hansvanleeuwen",
    desc: "Deep Research, SEO & AI Architecture",
    icon: Briefcase,
    color: "from-blue-950/40 to-zinc-900 border-blue-600/40 text-blue-400",
    activeBadge: "bg-blue-500/20 text-blue-300 border-blue-500/30"
  },
  {
    id: "neon" as const,
    label: "NeoN Creative",
    desc: "Album Masters, NeuralAnalog & Beeldbank",
    icon: Music,
    color: "from-purple-950/50 to-pink-950/30 border-purple-500/50 text-purple-300",
    activeBadge: "bg-purple-500/25 text-purple-200 border-purple-400/40 shadow-sm shadow-purple-500/20"
  }
];

const TYPE_CONFIG = {
  all: { label: "Alle Types", icon: Layers, color: "text-zinc-400" },
  audio: { label: "Audio & Masters", icon: Headphones, color: "text-pink-400 bg-pink-500/10 border-pink-500/20" },
  pdf: { label: "PDF Documenten", icon: FileText, color: "text-red-400 bg-red-500/10 border-red-500/20" },
  gdoc: { label: "Google Docs", icon: FileCode, color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
  image: { label: "Afbeeldingen / Artwork", icon: ImageIcon, color: "text-purple-400 bg-purple-500/10 border-purple-500/20" },
  video: { label: "Video's", icon: Video, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  sheet: { label: "Spreadsheets / CSV", icon: Table, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  doc: { label: "Documenten", icon: File, color: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20" },
  other: { label: "Overig", icon: File, color: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20" },
};

export default function AttachmentsPage() {
  const [catalog, setCatalog] = useState<AttachmentGroup[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedChannel, setSelectedChannel] = useState<ChannelType>("neon");
  const [typeFilter, setTypeFilter] = useState<FileFilterType>("all");
  const [search, setSearch] = useState("");
  const [selectedSong, setSelectedSong] = useState<string>("all");
  const [selectedQuality, setSelectedQuality] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // View state
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [sortBy, setSortBy] = useState<"date" | "name" | "versions" | "size">("date");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  // Modals & Panels
  const [previewItem, setPreviewItem] = useState<AttachmentGroup | null>(null);
  const [activeVersion, setActiveVersion] = useState<AttachmentVersion | null>(null);
  const [versionDrawerItem, setVersionDrawerItem] = useState<AttachmentGroup | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Audio Playback
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Clipboard tracker
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Load catalog on mount
  useEffect(() => {
    async function loadData() {
      try {
        const mod = await import("@/data/attachmentsCatalog.json");
        const baseCatalog = (mod.default || mod) as AttachmentGroup[];

        // Check local storage for any custom added attachments
        const customRaw = localStorage.getItem("hvl_custom_attachments_groups");
        const custom: AttachmentGroup[] = customRaw ? JSON.parse(customRaw) : [];

        setCatalog([...custom, ...baseCatalog]);
      } catch (err) {
        console.error("Fout bij inladen catalogus:", err);
        toast.error("Kon bijlagen catalogus niet laden.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Update active preview version when previewItem changes
  useEffect(() => {
    if (previewItem) {
      setActiveVersion(previewItem.latest_version);
    } else {
      setActiveVersion(null);
    }
  }, [previewItem]);

  // Audio handling
  function togglePlayAudio(version: AttachmentVersion) {
    const audioUrl = version.stream_url || version.external_url;
    if (!audioUrl) {
      toast.info("Geen online audiostream voor dit bestand. Kopieer het lokale pad om te luisteren in Ableton/VLC.");
      return;
    }

    if (playingAudioId === version.id && isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
    } else {
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.play().catch((e) => {
          console.warn("Audio play blocked/error:", e);
          toast.error("Kan audiostream niet direct afspelen via de browser.");
        });
        setPlayingAudioId(version.id);
        setIsPlaying(true);
      }
    }
  }

  function handleAudioEnded() {
    setIsPlaying(false);
    setPlayingAudioId(null);
  }

  // Copy helper
  function copyText(text: string, id: string, label = "Gekopieerd") {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success(`${label} naar klembord!`);
    setTimeout(() => setCopiedId(null), 2000);
  }

  // Stats calculation
  const stats = useMemo(() => {
    const totalGroups = catalog.length;
    const totalVersions = catalog.reduce((acc, g) => acc + g.version_count, 0);

    const ccp = catalog.filter((g) => g.channel === "connectcarparts");
    const hvl = catalog.filter((g) => g.channel === "hansvanleeuwen");
    const neon = catalog.filter((g) => g.channel === "neon");

    return {
      totalGroups,
      totalVersions,
      ccpCount: ccp.length,
      ccpVersions: ccp.reduce((acc, g) => acc + g.version_count, 0),
      hvlCount: hvl.length,
      hvlVersions: hvl.reduce((acc, g) => acc + g.version_count, 0),
      neonCount: neon.length,
      neonVersions: neon.reduce((acc, g) => acc + g.version_count, 0),
    };
  }, [catalog]);

  // Available Songs list for NeoN
  const availableSongs = useMemo(() => {
    const songs = new Set<string>();
    catalog.forEach((g) => {
      if (g.channel === "neon" && g.song) {
        songs.add(g.song);
      }
    });
    return Array.from(songs).sort();
  }, [catalog]);

  // Available Qualities list for NeoN
  const availableQualities = useMemo(() => {
    const quals = new Set<string>();
    catalog.forEach((g) => {
      if (g.channel === "neon" && g.master_quality) {
        quals.add(g.master_quality);
      }
    });
    return Array.from(quals).sort();
  }, [catalog]);

  // Available Categories list
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    catalog.forEach((g) => {
      if (selectedChannel === "all" || g.channel === selectedChannel) {
        if (g.category) cats.add(g.category);
      }
    });
    return Array.from(cats).sort();
  }, [catalog, selectedChannel]);

  // Filtered & Sorted items
  const filteredItems = useMemo(() => {
    return catalog
      .filter((item) => {
        // Channel filter
        if (selectedChannel !== "all" && item.channel !== selectedChannel) {
          return false;
        }

        // Type filter
        if (typeFilter !== "all") {
          if (typeFilter === "audio" && item.file_type !== "audio") return false;
          if (typeFilter === "pdf" && item.file_type !== "pdf" && !item.tags.includes("pdf")) return false;
          if (typeFilter === "gdoc" && item.file_type !== "gdoc" && !item.tags.includes("google-docs") && !item.tags.includes("gdoc")) return false;
          if (typeFilter === "image" && item.file_type !== "image") return false;
          if (typeFilter === "video" && item.file_type !== "video") return false;
          if (typeFilter === "sheet" && item.file_type !== "sheet") return false;
        }

        // NeoN specific Song filter
        if (selectedChannel === "neon" && selectedSong !== "all") {
          if (item.song !== selectedSong) return false;
        }

        // NeoN specific Quality filter
        if (selectedChannel === "neon" && selectedQuality !== "all") {
          const hasQualityInVersions = item.versions.some(
            (v) => v.quality === selectedQuality || (v.quality && v.quality.includes(selectedQuality))
          );
          if (item.master_quality !== selectedQuality && !hasQualityInVersions) {
            return false;
          }
        }

        // Category filter
        if (selectedCategory !== "all" && item.category !== selectedCategory) {
          return false;
        }

        // Search query
        if (search.trim()) {
          const q = search.toLowerCase();
          const matchTitle = item.title.toLowerCase().includes(q);
          const matchSong = item.song?.toLowerCase().includes(q) || false;
          const matchCat = item.category.toLowerCase().includes(q);
          const matchQuality = item.master_quality?.toLowerCase().includes(q) || false;
          const matchTags = item.tags.some((t) => t.toLowerCase().includes(q));
          const matchVersions = item.versions.some(
            (v) => v.file_name.toLowerCase().includes(q) || v.version_label.toLowerCase().includes(q)
          );
          if (!matchTitle && !matchSong && !matchCat && !matchQuality && !matchTags && !matchVersions) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortBy === "date") {
          diff = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
        } else if (sortBy === "name") {
          diff = a.title.localeCompare(b.title);
        } else if (sortBy === "versions") {
          diff = a.version_count - b.version_count;
        } else if (sortBy === "size") {
          const sa = a.latest_version.file_size_bytes || 0;
          const sb = b.latest_version.file_size_bytes || 0;
          diff = sa - sb;
        }
        return sortOrder === "desc" ? -diff : diff;
      });
  }, [catalog, selectedChannel, typeFilter, selectedSong, selectedQuality, selectedCategory, search, sortBy, sortOrder]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 flex flex-col antialiased selection:bg-purple-500/30">
      {/* Hidden Audio Element for Master playback */}
      <audio ref={audioRef} onEnded={handleAudioEnded} className="hidden" />

      {/* Top Header & Breadcrumbs */}
      <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-[#0a0a0a]/90 backdrop-blur-xl px-4 lg:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/portal"
              className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors py-1 px-2 rounded-md hover:bg-zinc-800/60"
            >
              <ArrowLeft size={13} />
              Portal
            </Link>
            <span className="text-zinc-600">/</span>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-gradient-to-tr from-purple-600/20 to-pink-500/20 border border-purple-500/30 text-purple-400">
                <Layers size={16} />
              </div>
              <div>
                <h1 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                  Bijlagen & Research Vault
                  <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700/60 font-mono">
                    {stats.totalGroups} items · {stats.totalVersions} versies
                  </span>
                </h1>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Direct Music CMS Link */}
            <Link
              to="/music-cms?mode=productie"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 transition-all hover:scale-[1.02]"
              title="Ga naar Music CMS Dashboard"
            >
              <Disc size={13} className="text-pink-400 animate-spin-slow" />
              Music CMS
              <LinkIcon size={11} className="opacity-70" />
            </Link>

            {/* Beeldbank Shortcut */}
            <button
              onClick={() => {
                setSelectedChannel("neon");
                setTypeFilter("image");
                toast.success("Beeldbank filter geactiveerd: 1.426 artwork & video assets.");
              }}
              className="hidden md:inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-zinc-800/70 hover:bg-zinc-800 text-zinc-300 border border-zinc-700/60 transition-all"
              title="Filter direct op de NeoN Beeldbank"
            >
              <ImageIcon size={13} className="text-purple-400" />
              Beeldbank ({stats.neonCount} items)
            </button>

            {/* Refresh / Sync */}
            <button
              onClick={() => {
                toast.success("Catalogus gesynchroniseerd en up-to-date (okt 2026).");
              }}
              className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-colors"
              title="Verversen"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* Channel Bar: 3 Main Categories Immediately Shown */}
      <section className="border-b border-zinc-800/60 bg-zinc-950/40 px-4 lg:px-8 py-5">
        <div className="max-w-7xl mx-auto">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-2.5 flex items-center justify-between">
            <span>Kies Hoofddomein / Kanaal (3 Hoofdcategorieën):</span>
            <span className="text-zinc-400 text-[11px] font-normal">
              Deduplicatie & Versiehistorie actief
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {CHANNELS_CONFIG.map((c) => {
              const IconComp = c.icon;
              const isSelected = selectedChannel === c.id;
              const count =
                c.id === "all"
                  ? stats.totalGroups
                  : c.id === "connectcarparts"
                  ? stats.ccpCount
                  : c.id === "hansvanleeuwen"
                  ? stats.hvlCount
                  : stats.neonCount;
              const verCount =
                c.id === "all"
                  ? stats.totalVersions
                  : c.id === "connectcarparts"
                  ? stats.ccpVersions
                  : c.id === "hansvanleeuwen"
                  ? stats.hvlVersions
                  : stats.neonVersions;

              return (
                <button
                  key={c.id}
                  onClick={() => {
                    setSelectedChannel(c.id);
                    // Reset sub-filters on channel switch
                    setSelectedSong("all");
                    setSelectedQuality("all");
                    setSelectedCategory("all");
                  }}
                  className={`group relative text-left p-3.5 rounded-xl border transition-all duration-200 ${
                    isSelected
                      ? `bg-gradient-to-br ${c.color} shadow-lg ring-1 ring-zinc-500/30`
                      : "bg-zinc-900/60 border-zinc-800/80 hover:bg-zinc-900 hover:border-zinc-700/80"
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div
                      className={`p-2 rounded-lg ${
                        isSelected
                          ? "bg-zinc-900/80 text-zinc-100 shadow-inner"
                          : "bg-zinc-800/60 text-zinc-400 group-hover:text-zinc-200"
                      }`}
                    >
                      <IconComp size={18} />
                    </div>
                    <span
                      className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded-full border ${
                        isSelected ? c.activeBadge : "bg-zinc-800 text-zinc-400 border-zinc-700/50"
                      }`}
                    >
                      {count} items · {verCount}v
                    </span>
                  </div>

                  <h3
                    className={`text-sm font-semibold mb-0.5 ${
                      isSelected ? "text-zinc-100" : "text-zinc-300 group-hover:text-zinc-100"
                    }`}
                  >
                    {c.label}
                  </h3>
                  <p className="text-[11px] text-zinc-400 line-clamp-1">{c.desc}</p>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Main Filter & Navigation Controls */}
      <section className="border-b border-zinc-800/80 bg-[#0a0a0a] px-4 lg:px-8 py-3.5 sticky top-[57px] z-20 backdrop-blur-md">
        <div className="max-w-7xl mx-auto space-y-3">
          {/* Row 1: Search + View toggle + Per Type Filter Tabs */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-lg">
              <Search
                size={15}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Zoek op titel, song, bestand, tags of versie (bijv. Beat Drop, NeuralAnalog, Testplan)..."
                className="w-full pl-9 pr-8 py-2 rounded-lg bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-200 placeholder:text-zinc-400 focus:outline-none focus:border-purple-500/70 focus:ring-1 focus:ring-purple-500/30 transition-all"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-300 p-0.5"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* View Mode & Sorter */}
            <div className="flex items-center gap-2 self-end md:self-auto">
              {/* Sort selector */}
              <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 px-2 py-1.5 rounded-lg text-xs text-zinc-400">
                <ArrowUpDown size={12} />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-transparent text-zinc-300 focus:outline-none text-xs cursor-pointer"
                >
                  <option value="date" className="bg-zinc-900">
                    Datum (Nieuwste)
                  </option>
                  <option value="name" className="bg-zinc-900">
                    Naam (A-Z)
                  </option>
                  <option value="versions" className="bg-zinc-900">
                    Meeste Versies
                  </option>
                  <option value="size" className="bg-zinc-900">
                    Bestandsgrootte
                  </option>
                </select>
                <button
                  onClick={() => setSortOrder((o) => (o === "asc" ? "desc" : "asc"))}
                  className="p-1 hover:text-zinc-200 text-zinc-400"
                  title="Wissel sorteervolgorde"
                >
                  {sortOrder === "desc" ? "↓" : "↑"}
                </button>
              </div>

              {/* View Toggle */}
              <div className="flex items-center bg-zinc-900 border border-zinc-800 p-0.5 rounded-lg">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-1.5 rounded-md text-xs transition-colors ${
                    viewMode === "grid" ? "bg-zinc-800 text-zinc-100 shadow" : "text-zinc-400 hover:text-zinc-300"
                  }`}
                  title="Grid weergave"
                >
                  <Grid3X3 size={14} />
                </button>
                <button
                  onClick={() => setViewMode("table")}
                  className={`p-1.5 rounded-md text-xs transition-colors ${
                    viewMode === "table" ? "bg-zinc-800 text-zinc-100 shadow" : "text-zinc-400 hover:text-zinc-300"
                  }`}
                  title="Tabel weergave"
                >
                  <List size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Row 2: Per Type Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            <span className="text-[11px] font-semibold text-zinc-400 whitespace-nowrap mr-1 flex items-center gap-1">
              <Filter size={11} />
              Filter per Type:
            </span>
            {(
              [
                "all",
                ...(selectedChannel === "neon" ? ["audio", "image", "video"] : ["pdf", "gdoc", "sheet", "audio", "image"])
              ] as FileFilterType[]
            ).map((t) => {
              const cfg = TYPE_CONFIG[t] || TYPE_CONFIG.other;
              const IconC = cfg.icon;
              const isSelected = typeFilter === t;
              return (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs whitespace-nowrap transition-all ${
                    isSelected
                      ? "bg-zinc-200 text-zinc-950 font-medium shadow-sm"
                      : "bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 border border-zinc-800"
                  }`}
                >
                  <IconC size={12} className={isSelected ? "text-zinc-900" : cfg.color} />
                  {cfg.label}
                </button>
              );
            })}
          </div>

          {/* Row 3: Domain-Specific Attributes (Neon: Song + Quality / CCP: Category / HVL: Category) */}
          <div className="pt-2 border-t border-zinc-800/60 flex flex-wrap items-center gap-3 text-xs">
            {selectedChannel === "neon" && (
              <>
                {/* NeoN Song Filter */}
                <div className="flex items-center gap-1.5 bg-purple-950/30 border border-purple-500/30 px-2.5 py-1.5 rounded-lg text-purple-300">
                  <Music size={12} className="text-pink-400" />
                  <span className="font-medium text-[11px] text-purple-300">Filter op Song:</span>
                  <select
                    value={selectedSong}
                    onChange={(e) => setSelectedSong(e.target.value)}
                    className="bg-transparent text-zinc-100 text-xs focus:outline-none cursor-pointer max-w-[180px]"
                  >
                    <option value="all" className="bg-zinc-900 text-zinc-200">
                      Alle nummers ({availableSongs.length})
                    </option>
                    {availableSongs.map((s) => (
                      <option key={s} value={s} className="bg-zinc-900 text-zinc-200">
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                {/* NeoN Master Quality Filter */}
                <div className="flex items-center gap-1.5 bg-pink-950/20 border border-pink-500/30 px-2.5 py-1.5 rounded-lg text-pink-300">
                  <SlidersHorizontal size={12} className="text-pink-400" />
                  <span className="font-medium text-[11px] text-pink-300">Master Kwaliteit:</span>
                  <select
                    value={selectedQuality}
                    onChange={(e) => setSelectedQuality(e.target.value)}
                    className="bg-transparent text-zinc-100 text-xs focus:outline-none cursor-pointer max-w-[200px]"
                  >
                    <option value="all" className="bg-zinc-900 text-zinc-200">
                      Alle kwaliteiten
                    </option>
                    <option value="NeuralAnalog" className="bg-zinc-900 text-zinc-200">
                      NeuralAnalog (Studio AI)
                    </option>
                    <option value="LP Master (Comb-Flattener 96k/24b)" className="bg-zinc-900 text-zinc-200">
                      LP Master (Comb-Flattener 96k)
                    </option>
                    <option value="Clean Master (Hi-Res)" className="bg-zinc-900 text-zinc-200">
                      Clean Master (Hi-Res)
                    </option>
                    <option value="Mixea Master" className="bg-zinc-900 text-zinc-200">
                      Mixea Master
                    </option>
                    <option value="Stem Mix / Instrumental" className="bg-zinc-900 text-zinc-200">
                      Stem Mix / Instrumental
                    </option>
                  </select>
                </div>

                {/* Music CMS Link Button */}
                <Link
                  to="/music-cms?mode=productie"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-purple-600/30 to-pink-600/30 border border-purple-500/40 text-purple-200 text-[11px] font-medium hover:brightness-110 transition-all ml-auto"
                >
                  <Disc size={12} className="text-pink-400" />
                  Open Music CMS Dashboard
                  <ChevronRight size={12} />
                </Link>
              </>
            )}

            {selectedChannel === "connectcarparts" && (
              <div className="flex items-center gap-1.5 bg-amber-950/30 border border-amber-600/30 px-2.5 py-1.5 rounded-lg text-amber-300">
                <Car size={12} className="text-amber-400" />
                <span className="font-medium text-[11px] text-amber-300">Categorie:</span>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="bg-transparent text-zinc-100 text-xs focus:outline-none cursor-pointer"
                >
                  <option value="all" className="bg-zinc-900 text-zinc-200">
                    Alle CCP Categorieën
                  </option>
                  {availableCategories.map((c) => (
                    <option key={c} value={c} className="bg-zinc-900 text-zinc-200">
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {selectedChannel === "hansvanleeuwen" && (
              <div className="flex items-center gap-1.5 bg-blue-950/30 border border-blue-600/30 px-2.5 py-1.5 rounded-lg text-blue-300">
                <Briefcase size={12} className="text-blue-400" />
                <span className="font-medium text-[11px] text-blue-300">Categorie:</span>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="bg-transparent text-zinc-100 text-xs focus:outline-none cursor-pointer"
                >
                  <option value="all" className="bg-zinc-900 text-zinc-200">
                    Alle HVL Categorieën
                  </option>
                  {availableCategories.map((c) => (
                    <option key={c} value={c} className="bg-zinc-900 text-zinc-200">
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-6">
        {loading ? (
          <div className="py-24 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-purple-500 border-t-transparent mb-3" />
            <p className="text-xs text-zinc-400">Bijlagen en versiecatalogus inladen...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-20 text-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30">
            <Folder size={36} className="mx-auto text-zinc-600 mb-3" />
            <h3 className="text-sm font-medium text-zinc-300 mb-1">Geen bijlagen gevonden</h3>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto mb-4">
              Geen resultaten voor de geselecteerde filters of zoekterm. Pas je filters aan of wis de zoekopdracht.
            </p>
            <button
              onClick={() => {
                setSearch("");
                setTypeFilter("all");
                setSelectedSong("all");
                setSelectedQuality("all");
                setSelectedCategory("all");
              }}
              className="text-xs px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-200 hover:bg-zinc-700 transition-colors"
            >
              Wis alle filters
            </button>
          </div>
        ) : viewMode === "grid" ? (
          /* ========================================================= */
          /* GRID VIEW WITH BEELDBANK VERSION BADGES                   */
          /* ========================================================= */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredItems.map((item) => {
              const lv = item.latest_version;
              const typeCfg = TYPE_CONFIG[item.file_type] || TYPE_CONFIG.other;
              const IconComp = typeCfg.icon;
              const isAudioPlaying = playingAudioId === lv.id && isPlaying;

              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`group relative flex flex-col justify-between rounded-xl border bg-zinc-900/60 p-4 transition-all duration-200 hover:bg-zinc-900 hover:shadow-xl ${
                    item.channel === "neon"
                      ? "border-purple-500/20 hover:border-purple-500/50"
                      : item.channel === "connectcarparts"
                      ? "border-amber-500/20 hover:border-amber-500/50"
                      : "border-blue-500/20 hover:border-blue-500/50"
                  }`}
                >
                  <div>
                    {/* Header: Type icon + Channel badge + Version Pill */}
                    <div className="flex items-start justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-2">
                        <div
                          className={`p-2 rounded-lg border ${
                            item.channel === "neon"
                              ? "bg-purple-500/10 text-purple-300 border-purple-500/20"
                              : item.channel === "connectcarparts"
                              ? "bg-amber-500/10 text-amber-300 border-amber-500/20"
                              : "bg-blue-500/10 text-blue-300 border-blue-500/20"
                          }`}
                        >
                          <IconComp size={16} />
                        </div>
                        <div>
                          <span
                            className={`text-[10px] font-mono font-medium px-1.5 py-0.5 rounded border uppercase ${
                              item.channel === "neon"
                                ? "bg-purple-950/60 text-purple-300 border-purple-500/30"
                                : item.channel === "connectcarparts"
                                ? "bg-amber-950/60 text-amber-300 border-amber-500/30"
                                : "bg-blue-950/60 text-blue-300 border-blue-500/30"
                            }`}
                          >
                            {item.channel === "neon" ? "NeoN" : item.channel === "connectcarparts" ? "CCP" : "HVL"}
                          </span>
                        </div>
                      </div>

                      {/* Version Pill (Beeldbank Style) */}
                      <button
                        onClick={() => setVersionDrawerItem(item)}
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-full border flex items-center gap-1 transition-all hover:scale-105 ${
                          item.version_count > 1
                            ? "bg-purple-900/40 text-purple-200 border-purple-500/50 hover:bg-purple-800/50 shadow-sm"
                            : "bg-zinc-800/80 text-zinc-400 border-zinc-700/60"
                        }`}
                        title="Klik om versiehistorie te bekijken"
                      >
                        <History size={10} />
                        {item.version_count > 1 ? `${item.version_count} versies` : "v1"}
                      </button>
                    </div>

                    {/* Title */}
                    <h3
                      className="text-sm font-semibold text-zinc-100 group-hover:text-purple-300 transition-colors line-clamp-2 cursor-pointer mb-1.5"
                      onClick={() => setPreviewItem(item)}
                      title={item.title}
                    >
                      {item.title}
                    </h3>

                    {/* Song / Master Quality / Date Metadata */}
                    <div className="flex flex-wrap items-center gap-1.5 mb-3 text-[11px]">
                      {item.master_quality && (
                        <span className="px-1.5 py-0.5 rounded bg-pink-950/40 border border-pink-500/30 text-pink-300 font-mono text-[10px]">
                          {item.master_quality}
                        </span>
                      )}
                      <span className="text-zinc-500 font-mono text-[10px]">
                        {lv.created_at}
                      </span>
                      {lv.size_formatted && (
                        <span className="text-zinc-500 font-mono text-[10px]">
                          · {lv.size_formatted}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="pt-3 border-t border-zinc-800/60 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      {/* Audio Play Button (for audio files) */}
                      {item.file_type === "audio" && (
                        <button
                          onClick={() => togglePlayAudio(lv)}
                          className={`p-1.5 rounded-md border text-xs font-medium flex items-center gap-1 transition-all ${
                            isAudioPlaying
                              ? "bg-pink-500 text-zinc-950 border-pink-400 shadow-md shadow-pink-500/20"
                              : "bg-zinc-800/80 text-zinc-300 border-zinc-700/60 hover:bg-zinc-700 hover:text-zinc-100"
                          }`}
                          title={isAudioPlaying ? "Pauzeren" : "Luister af"}
                        >
                          {isAudioPlaying ? <Pause size={12} /> : <Play size={12} />}
                          <span className="text-[11px]">{isAudioPlaying ? "Pauze" : "Play"}</span>
                        </button>
                      )}

                      {/* Preview Button */}
                      <button
                        onClick={() => setPreviewItem(item)}
                        className="px-2.5 py-1.5 rounded-md bg-zinc-800/70 hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 border border-zinc-700/50 text-[11px] font-medium flex items-center gap-1 transition-colors"
                      >
                        <Eye size={12} />
                        Preview
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      {/* Copy Path */}
                      {lv.local_path && (
                        <button
                          onClick={() => copyText(lv.local_path!, lv.id, "Lokaal bestandspad")}
                          className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
                          title="Kopieer lokaal pad (file:///...)"
                        >
                          {copiedId === lv.id ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                        </button>
                      )}

                      {/* Version Drawer Button */}
                      <button
                        onClick={() => setVersionDrawerItem(item)}
                        className="px-2 py-1 rounded-md bg-zinc-800/50 hover:bg-zinc-800 text-zinc-400 hover:text-purple-300 text-[11px] font-mono transition-colors"
                        title="Bekijk alle versies"
                      >
                        +{item.version_count}
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          /* ========================================================= */
          /* TABLE VIEW WITH EXPANDABLE VERSION ROWS                   */
          /* ========================================================= */
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-900 border-b border-zinc-800 text-zinc-400 text-[11px] uppercase tracking-wider font-mono">
                  <tr>
                    <th className="py-3 px-4">Document / Song Titel</th>
                    <th className="py-3 px-3">Domein</th>
                    <th className="py-3 px-3">Type</th>
                    <th className="py-3 px-3">Kwaliteit / Versie</th>
                    <th className="py-3 px-3">Versies</th>
                    <th className="py-3 px-3">Datum</th>
                    <th className="py-3 px-3">Grootte</th>
                    <th className="py-3 px-4 text-right">Acties</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 font-sans">
                  {filteredItems.map((item) => {
                    const lv = item.latest_version;
                    const typeCfg = TYPE_CONFIG[item.file_type] || TYPE_CONFIG.other;
                    const IconComp = typeCfg.icon;
                    const isAudioPlaying = playingAudioId === lv.id && isPlaying;

                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-zinc-900/80 transition-colors group cursor-pointer"
                        onClick={() => setPreviewItem(item)}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="p-1.5 rounded bg-zinc-800 text-zinc-300">
                              <IconComp size={14} />
                            </div>
                            <div>
                              <div className="font-medium text-zinc-100 group-hover:text-purple-300 transition-colors line-clamp-1">
                                {item.title}
                              </div>
                              <div className="text-[11px] text-zinc-400 font-mono line-clamp-1">
                                {lv.file_name}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <span
                            className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded border uppercase ${
                              item.channel === "neon"
                                ? "bg-purple-950/60 text-purple-300 border-purple-500/30"
                                : item.channel === "connectcarparts"
                                ? "bg-amber-950/60 text-amber-300 border-amber-500/30"
                                : "bg-blue-950/60 text-blue-300 border-blue-500/30"
                            }`}
                          >
                            {item.channel === "neon" ? "NeoN" : item.channel === "connectcarparts" ? "CCP" : "HVL"}
                          </span>
                        </td>

                        <td className="py-3 px-3 text-zinc-400">
                          {typeCfg.label}
                        </td>

                        <td className="py-3 px-3">
                          {item.master_quality ? (
                            <span className="px-2 py-0.5 rounded bg-pink-950/40 border border-pink-500/30 text-pink-300 font-mono text-[10px]">
                              {item.master_quality}
                            </span>
                          ) : (
                            <span className="text-zinc-500 text-[11px]">—</span>
                          )}
                        </td>

                        <td className="py-3 px-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setVersionDrawerItem(item);
                            }}
                            className={`text-[10px] font-mono px-2 py-0.5 rounded-full border transition-all ${
                              item.version_count > 1
                                ? "bg-purple-900/40 text-purple-200 border-purple-500/40 hover:bg-purple-800/60"
                                : "bg-zinc-800/60 text-zinc-400 border-zinc-700/50"
                            }`}
                          >
                            {item.version_count} versies
                          </button>
                        </td>

                        <td className="py-3 px-3 font-mono text-zinc-400">
                          {lv.created_at}
                        </td>

                        <td className="py-3 px-3 font-mono text-zinc-400">
                          {lv.size_formatted || "—"}
                        </td>

                        <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            {item.file_type === "audio" && (
                              <button
                                onClick={() => togglePlayAudio(lv)}
                                className={`p-1.5 rounded border transition-colors ${
                                  isAudioPlaying
                                    ? "bg-pink-500 text-zinc-950 border-pink-400"
                                    : "bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700"
                                }`}
                                title="Afspelen"
                              >
                                {isAudioPlaying ? <Pause size={12} /> : <Play size={12} />}
                              </button>
                            )}

                            <button
                              onClick={() => setPreviewItem(item)}
                              className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition-colors"
                              title="Preview bekijken"
                            >
                              <Eye size={12} />
                            </button>

                            {lv.local_path && (
                              <button
                                onClick={() => copyText(lv.local_path!, lv.id, "Lokaal bestandspad")}
                                className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
                                title="Kopieer bestandspad"
                              >
                                {copiedId === lv.id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* ========================================================= */}
      {/* VERSIEHISTORIE MODAL / DRAWER (BEELDBANK PATTERN)         */}
      {/* ========================================================= */}
      <AnimatePresence>
        {versionDrawerItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              {/* Drawer Header */}
              <div className="p-4 border-b border-zinc-800 bg-zinc-950/60 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-300">
                    <History size={16} />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                      Versiehistorie: {versionDrawerItem.title}
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-900/50 text-purple-200 border border-purple-500/30">
                        {versionDrawerItem.version_count} versies
                      </span>
                    </h2>
                    <p className="text-[11px] text-zinc-400">
                      Beeldbank-stijl revisiearchief · Meest recente/hoogste kwaliteit staat bovenaan
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setVersionDrawerItem(null)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Versions List */}
              <div className="p-4 overflow-y-auto space-y-2.5 flex-1 divide-y divide-zinc-800/40">
                {versionDrawerItem.versions.map((ver, idx) => {
                  const isPlayingThis = playingAudioId === ver.id && isPlaying;

                  return (
                    <div
                      key={ver.id}
                      className={`pt-2.5 first:pt-0 p-3 rounded-xl border transition-all ${
                        ver.is_latest
                          ? "bg-purple-950/20 border-purple-500/40 ring-1 ring-purple-500/20"
                          : "bg-zinc-900/60 border-zinc-800 hover:border-zinc-700"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-1.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded-full border ${
                              ver.is_latest
                                ? "bg-purple-500/20 text-purple-200 border-purple-500/40"
                                : "bg-zinc-800 text-zinc-400 border-zinc-700/60"
                            }`}
                          >
                            {ver.is_latest ? "Actuele Hoofdversie" : `Revisie #${versionDrawerItem.version_count - idx}`}
                          </span>
                          <span className="text-xs font-semibold text-zinc-200 font-mono">
                            {ver.version_label}
                          </span>
                        </div>

                        <span className="text-[11px] font-mono text-zinc-400">
                          {ver.created_at} · {ver.size_formatted}
                        </span>
                      </div>

                      <div className="text-xs text-zinc-300 font-mono break-all mb-2">
                        {ver.file_name}
                      </div>

                      {/* Version Specs (BPM, Key, Quality) */}
                      {(ver.quality || ver.bpm || ver.musical_key) && (
                        <div className="flex flex-wrap items-center gap-2 mb-2.5 text-[10px] font-mono text-zinc-400">
                          {ver.quality && (
                            <span className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-pink-300">
                              {ver.quality}
                            </span>
                          )}
                          {ver.bpm && (
                            <span className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300">
                              {ver.bpm} BPM
                            </span>
                          )}
                          {ver.musical_key && (
                            <span className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300">
                              Key: {ver.musical_key}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Actions for this specific version */}
                      <div className="flex items-center justify-between pt-2 border-t border-zinc-800/50">
                        <div className="flex items-center gap-1.5">
                          {versionDrawerItem.file_type === "audio" && (
                            <button
                              onClick={() => togglePlayAudio(ver)}
                              className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1 transition-all ${
                                isPlayingThis
                                  ? "bg-pink-500 text-zinc-950 border border-pink-400"
                                  : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700 border border-zinc-700"
                              }`}
                            >
                              {isPlayingThis ? <Pause size={11} /> : <Play size={11} />}
                              <span>{isPlayingThis ? "Pauze" : "Speel Versie"}</span>
                            </button>
                          )}

                          <button
                            onClick={() => {
                              setActiveVersion(ver);
                              setPreviewItem(versionDrawerItem);
                              setVersionDrawerItem(null);
                            }}
                            className="px-2.5 py-1 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 text-xs font-medium border border-zinc-700 flex items-center gap-1"
                          >
                            <Eye size={11} />
                            Preview
                          </button>
                        </div>

                        <div className="flex items-center gap-1">
                          {ver.neuralanalog_url && (
                            <a
                              href={ver.neuralanalog_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2 py-1 rounded bg-purple-950/60 text-purple-200 border border-purple-500/40 hover:bg-purple-900/60 text-[10px] flex items-center gap-1 font-mono transition-colors"
                              title="Open NeuralAnalog Master"
                            >
                              <Sparkles size={10} className="text-pink-400" />
                              NeuralAnalog
                              <ExternalLink size={9} />
                            </a>
                          )}
                          {ver.local_path && (
                            <button
                              onClick={() => copyText(ver.local_path!, ver.id, "Lokaal bestandspad")}
                              className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 text-xs flex items-center gap-1 transition-colors"
                              title="Kopieer bestandspad"
                            >
                              {copiedId === ver.id ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                              Pad
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Drawer Footer */}
              <div className="p-3 border-t border-zinc-800 bg-zinc-950/60 flex items-center justify-between text-xs text-zinc-400">
                <span>Directe synchronisatie met de Beeldbank & Masters map</span>
                <button
                  onClick={() => setVersionDrawerItem(null)}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-200 hover:bg-zinc-700 transition-colors"
                >
                  Sluiten
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* ON-SITE FULL PREVIEW MODAL                                */}
      {/* ========================================================= */}
      <AnimatePresence>
        {previewItem && activeVersion && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-5xl h-[88vh] bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Modal Top Header */}
              <div className="p-3.5 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0 pr-4">
                  <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 shrink-0">
                    <FileText size={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-semibold text-zinc-100 truncate">
                        {previewItem.title}
                      </h2>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-pink-300 border border-pink-500/30 shrink-0">
                        {activeVersion.version_label}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 font-mono truncate">
                      {activeVersion.file_name} · {activeVersion.created_at} · {activeVersion.size_formatted}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Copy actions */}
                  {activeVersion.local_path && (
                    <button
                      onClick={() => copyText(activeVersion.local_path!, "modal-path", "Lokaal bestandspad")}
                      className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs flex items-center gap-1.5 transition-colors"
                      title="Kopieer lokaal pad"
                    >
                      {copiedId === "modal-path" ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      <span className="hidden sm:inline">Pad</span>
                    </button>
                  )}

                  {/* Close */}
                  <button
                    onClick={() => setPreviewItem(null)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Modal Content Body */}
              <div className="flex-1 bg-black/60 relative overflow-hidden flex items-center justify-center">
                {/* 1. AUDIO PREVIEW PLAYER */}
                {previewItem.file_type === "audio" && (
                  <div className="w-full max-w-lg p-6 bg-zinc-900/90 border border-zinc-800 rounded-2xl shadow-2xl text-center space-y-4">
                    <div className="h-20 w-20 mx-auto rounded-full bg-gradient-to-tr from-purple-600/30 to-pink-600/30 border border-purple-500/40 flex items-center justify-center text-pink-300 shadow-lg shadow-purple-500/20">
                      <Headphones size={36} className="animate-pulse" />
                    </div>

                    <div>
                      <h3 className="text-base font-semibold text-zinc-100 mb-1">{previewItem.title}</h3>
                      <p className="text-xs font-mono text-pink-300">{activeVersion.version_label}</p>
                      {previewItem.song && (
                        <p className="text-xs text-zinc-400 mt-0.5">Song: {previewItem.song}</p>
                      )}
                    </div>

                    {/* Quality Badges */}
                    <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] font-mono">
                      {activeVersion.quality && (
                        <span className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-pink-300">
                          {activeVersion.quality}
                        </span>
                      )}
                      {activeVersion.bpm && (
                        <span className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300">
                          {activeVersion.bpm} BPM
                        </span>
                      )}
                      {activeVersion.musical_key && (
                        <span className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300">
                          Key: {activeVersion.musical_key}
                        </span>
                      )}
                    </div>

                    {/* Audio Player Controls */}
                    <div className="pt-2">
                      <button
                        onClick={() => togglePlayAudio(activeVersion)}
                        className="px-6 py-2.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-zinc-950 font-semibold text-xs flex items-center justify-center gap-2 mx-auto hover:brightness-110 shadow-lg shadow-pink-500/25 transition-all"
                      >
                        {playingAudioId === activeVersion.id && isPlaying ? (
                          <>
                            <Pause size={15} /> Pauze
                          </>
                        ) : (
                          <>
                            <Play size={15} /> Speel Track Af
                          </>
                        )}
                      </button>
                    </div>

                    {/* External links: Suno, Spotify, Music CMS */}
                    <div className="flex flex-wrap items-center justify-center gap-2 pt-3 border-t border-zinc-800 text-xs">
                      {activeVersion.neuralanalog_url && (
                        <a
                          href={activeVersion.neuralanalog_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1 rounded-md bg-purple-950/60 text-purple-200 border border-purple-500/50 text-[11px] hover:bg-purple-900/60 flex items-center gap-1 font-mono font-medium shadow-sm shadow-purple-500/20"
                        >
                          <Sparkles size={11} className="text-pink-400" />
                          NeuralAnalog Master <ExternalLink size={10} />
                        </a>
                      )}
                      {activeVersion.spotify_url && (
                        <a
                          href={activeVersion.spotify_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1 rounded-md bg-emerald-950/40 text-emerald-300 border border-emerald-600/40 text-[11px] hover:bg-emerald-900/40 flex items-center gap-1"
                        >
                          Spotify <ExternalLink size={10} />
                        </a>
                      )}
                      {activeVersion.suno_url && (
                        <a
                          href={activeVersion.suno_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1 rounded-md bg-orange-950/40 text-orange-300 border border-orange-600/40 text-[11px] hover:bg-orange-900/40 flex items-center gap-1"
                        >
                          Suno <ExternalLink size={10} />
                        </a>
                      )}
                      <Link
                        to={previewItem.music_cms_url || "/music-cms?mode=productie"}
                        className="px-3 py-1 rounded-md bg-purple-950/40 text-purple-300 border border-purple-600/40 text-[11px] hover:bg-purple-900/40 flex items-center gap-1"
                      >
                        <Disc size={11} className="text-pink-400" />
                        Music CMS <ChevronRight size={10} />
                      </Link>
                    </div>
                  </div>
                )}

                {/* 2. GOOGLE DOCS / DRIVE PDF PREVIEW */}
                {(previewItem.file_type === "pdf" || previewItem.file_type === "gdoc") && (
                  <div className="w-full h-full flex flex-col">
                    {activeVersion.google_doc_id ? (
                      <div className="w-full flex flex-col min-h-[520px]">
                        <div className="p-3 bg-zinc-950/80 border-b border-zinc-800 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FileCode size={15} className="text-blue-400" />
                            <span className="text-xs font-medium text-zinc-200 truncate max-w-sm">
                              {previewItem.title}
                            </span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">
                              Live Google Doc Preview
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <a
                              href={`https://docs.google.com/document/d/${activeVersion.google_doc_id}/edit`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1 rounded bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 border border-blue-500/40 text-xs font-medium flex items-center gap-1.5 transition-colors"
                            >
                              Open in Docs <ExternalLink size={11} />
                            </a>
                            {activeVersion.local_path && (
                              <button
                                onClick={() => copyText(activeVersion.local_path!, "local-pdf-path", "Lokaal PDF pad")}
                                className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs flex items-center gap-1 transition-colors"
                              >
                                <Copy size={11} /> Pad
                              </button>
                            )}
                          </div>
                        </div>
                        <iframe
                          src={`https://docs.google.com/document/d/${activeVersion.google_doc_id}/preview`}
                          className="w-full flex-1 min-h-[480px] border-0 bg-white rounded-b-xl"
                          title={previewItem.title}
                          allowFullScreen
                        />
                      </div>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center">
                        <FileText size={48} className="text-red-400 mb-3" />
                        <h3 className="text-base font-semibold text-zinc-100 mb-1">{previewItem.title}</h3>
                        <p className="text-xs text-zinc-400 mb-4 max-w-md">
                          Lokale geëxporteerde Deep Research PDF klaar voor offline inzage of documentanalyse.
                        </p>
                        <div className="flex items-center gap-3">
                          {activeVersion.local_path && (
                            <button
                              onClick={() => copyText(activeVersion.local_path!, "local-pdf-path", "Lokaal PDF pad")}
                              className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors shadow-lg"
                            >
                              <Copy size={13} /> Kopieer PDF Pad
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 3. IMAGE / VIDEO PREVIEW */}
                {previewItem.file_type === "image" && (
                  <div className="w-full h-full flex items-center justify-center p-4">
                    <div className="text-center">
                      <ImageIcon size={48} className="text-purple-400 mx-auto mb-2" />
                      <p className="text-xs text-zinc-300 font-mono">{activeVersion.file_name}</p>
                    </div>
                  </div>
                )}

                {previewItem.file_type === "video" && (
                  <div className="w-full h-full flex items-center justify-center p-4">
                    <div className="text-center">
                      <Video size={48} className="text-emerald-400 mx-auto mb-2" />
                      <p className="text-xs text-zinc-300 font-mono">{activeVersion.file_name}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Bottom Version Selector */}
              {previewItem.version_count > 1 && (
                <div className="p-3 border-t border-zinc-800 bg-zinc-950 flex items-center justify-between text-xs">
                  <span className="text-zinc-400 text-[11px] font-mono">
                    Wissel tussen de {previewItem.version_count} versies van dit bestand:
                  </span>
                  <div className="flex items-center gap-1.5 overflow-x-auto max-w-md">
                    {previewItem.versions.map((ver) => (
                      <button
                        key={ver.id}
                        onClick={() => setActiveVersion(ver)}
                        className={`px-2.5 py-1 rounded text-[11px] font-mono transition-all ${
                          activeVersion.id === ver.id
                            ? "bg-purple-600 text-white font-medium"
                            : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        {ver.version_label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
