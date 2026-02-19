"use client";

import {
  FormEvent,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import matter from "gray-matter";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { SidebarRail } from "@/components/sidebar-rail";
import { saveFeedSnapshot } from "@/lib/feed-storage";

const MAX_SITEMAP_DEPTH = 4;

// --- TYPES & INTERFACES ---

type DisplayState = "json-xml" | "ai-mirror" | "ready";
type ViewStage = "form" | "progress" | "summary";

type FrontMatterData = {
  title?: string;
  lastmod?: string;
  updated?: string;
};

type ApiPage = {
  url: string;
  ai_url?: string;
  type?: string;
  priority?: number;
  depth?: number;
};

type MarkdownEntry = {
  url: string;
  markdown: string;
};

type SitemapApiResponse = {
  site?: string;
  generated_at?: string;
  pages?: ApiPage[];
  xml?: string;
  markdown?: string;
  markdownEntries?: MarkdownEntry[];
  error?: string;
};

// This type matches the structure expected by AiMirrorPage
type EnrichedPage = ApiPage & {
  frontMatter?: FrontMatterData;
  markdown?: string;
  lastModified?: string | null;
};

type MarkdownSource = "crawler scaffold" | "live extract";

type MarkdownCacheEntry = {
  content: string;
  source: MarkdownSource;
};

type StatusCardAction = {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  disabled?: boolean;
};

type StatusCardProps = {
  icon: ReactNode;
  title: string;
  description: string;
  statusLabel: string;
  statusTone: "success" | "active" | "muted";
  loading?: boolean;
  primaryAction?: StatusCardAction;
  secondaryAction?: StatusCardAction;
};

// Type for crawl history from MongoDB
type CrawlHistoryItem = {
  sessionId: string;
  siteDomain: string;
  rootUrl: string;
  pageCount: number;
  generatedAt: string;
  completedAt: string;
  status: string;
};

// --- ICONS ---

const DocumentIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <line x1="10" y1="9" x2="8" y2="9" />
  </svg>
);

const SparklesIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
  </svg>
);

const DownloadIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const EyeIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const CheckIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const LoaderIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`${className} animate-spin`}
  >
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

const ArrowRight = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <line x1="5" y1="12" x2="19" y2="12"></line>
    <polyline points="12 5 19 12 12 19"></polyline>
  </svg>
);

// --- SUB COMPONENTS ---

const SkeletonText = ({ className }: { className: string }) => (
  <div
    className={`animate-shimmer bg-slate-200 rounded ${className}`}
    style={{
      backgroundImage:
        "linear-gradient(to right, #e2e8f0 0%, #f1f5f9 20%, #e2e8f0 40%, #e2e8f0 100%)",
      backgroundSize: "1000px 100%",
    }}
  ></div>
);

function StatusCard({
  icon,
  title,
  description,
  statusLabel,
  statusTone,
  loading,
  primaryAction,
  secondaryAction,
}: StatusCardProps) {
  const toneConfig = {
    success: {
      containerBorder: "border-emerald-100",
      iconBg: "bg-emerald-100 text-emerald-600",
      badgeBg: "bg-emerald-50 text-emerald-700 border-emerald-200",
      icon: <CheckIcon className="w-3.5 h-3.5" />,
    },
    active: {
      containerBorder: "border-blue-100",
      iconBg: "bg-blue-100 text-blue-600",
      badgeBg: "bg-blue-50 text-blue-700 border-blue-200",
      icon: <LoaderIcon className="w-3.5 h-3.5" />,
    },
    muted: {
      containerBorder: "border-slate-100",
      iconBg: "bg-slate-100 text-slate-400",
      badgeBg: "bg-slate-50 text-slate-500 border-slate-200",
      icon: null,
    },
  };

  const styles = toneConfig[statusTone] || toneConfig.muted;

  return (
    <article
      className={`relative group rounded-2xl bg-white border ${styles.containerBorder} p-6 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 overflow-hidden`}
    >
      {loading && (
        <div className="absolute top-0 left-0 h-1 bg-slate-100 w-full overflow-hidden">
          <div className="h-full bg-blue-500 animate-progress shadow-[0_0_10px_rgba(59,130,246,0.5)] w-full origin-left"></div>
        </div>
      )}

      <div className="flex flex-col h-full justify-between">
        <div className="flex items-start justify-between mb-4">
          <div
            className={`p-3 rounded-xl ${styles.iconBg} transition-colors duration-300`}
          >
            {icon}
          </div>
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${styles.badgeBg} h-fit`}
          >
            {styles.icon}
            {statusLabel}
          </span>
        </div>

        <div className="mb-6 flex-grow">
          <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
          {loading ? (
            <div className="space-y-2">
              <SkeletonText className="h-4 w-3/4" />
              <SkeletonText className="h-4 w-1/2" />
            </div>
          ) : (
            <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
          )}
        </div>

        <div className="flex items-center gap-3 mt-auto pt-4 border-t border-slate-50">
          {primaryAction && (
            <button
              type="button"
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled || loading}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md"
            >
              {primaryAction.icon}
              {primaryAction.label}
            </button>
          )}
          {secondaryAction && (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              disabled={secondaryAction.disabled || loading}
              className="inline-flex items-center justify-center p-2.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={secondaryAction.label}
            >
              {secondaryAction.icon}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

// --- MAIN COMPONENT ---

export default function Home() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated";
  const isLoadingSession = status === "loading";
  const [rootUrl, setRootUrl] = useState("");
  const [depth, setDepth] = useState(2);
  const [viewStage, setViewStage] = useState<ViewStage>("form");
  const [displayState, setDisplayState] = useState<DisplayState>("json-xml");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [resultJson, setResultJson] = useState("");
  const [resultXml, setResultXml] = useState("");
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [sitemapPages, setSitemapPages] = useState<EnrichedPage[]>([]);
  const [selectedPage, setSelectedPage] = useState<EnrichedPage | null>(null);
  const [selectedMarkdown, setSelectedMarkdown] = useState("");
  const [selectedMarkdownSource, setSelectedMarkdownSource] = useState("");
  const [selectedMarkdownError, setSelectedMarkdownError] = useState<
    string | null
  >(null);
  const [isMarkdownLoading, setIsMarkdownLoading] = useState(false);
  const [markdownByUrl, setMarkdownByUrl] = useState<
    Record<string, MarkdownCacheEntry>
  >({});
  const [markdownErrors, setMarkdownErrors] = useState<Record<string, string>>(
    {}
  );
  const [markdownLoadingMap, setMarkdownLoadingMap] = useState<
    Record<string, boolean>
  >({});
  const [feedPreviewMode, setFeedPreviewMode] = useState<"xml" | "json">(
    "xml"
  );
  const [feedCopyMessage, setFeedCopyMessage] = useState<string | null>(null);
  const copyMessageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  // Derived State
  const jsonActive = displayState === "json-xml" && isLoading;
  const aiActive = displayState === "ai-mirror" && isLoading;
  const jsonComplete = Boolean(resultXml);
  const aiComplete = displayState === "ready";
  const showForm = viewStage === "form";
  const showProgress = viewStage === "progress";
  const showSummary = viewStage === "summary";
  const viewFilesAvailable = Boolean(resultXml || resultJson);

  // Effects
  useEffect(() => {
    setMarkdownByUrl((prev) => {
      const next = { ...prev };
      let mutated = false;
      const activeUrls = new Set<string>();
      for (const page of sitemapPages) {
        activeUrls.add(page.url);
        if (page.markdown && !next[page.url]) {
          next[page.url] = {
            content: page.markdown,
            source: "crawler scaffold",
          };
          mutated = true;
        }
      }
      for (const url of Object.keys(next)) {
        if (!activeUrls.has(url)) {
          delete next[url];
          mutated = true;
        }
      }
      return mutated ? next : prev;
    });
  }, [sitemapPages]);

  useEffect(() => {
    setMarkdownErrors((prev) => {
      if (!Object.keys(prev).length) return prev;
      const next = { ...prev };
      let mutated = false;
      const activeUrls = new Set(sitemapPages.map((page) => page.url));
      for (const url of Object.keys(next)) {
        if (!activeUrls.has(url)) {
          delete next[url];
          mutated = true;
        }
      }
      return mutated ? next : prev;
    });

    setMarkdownLoadingMap((prev) => {
      if (!Object.keys(prev).length) return prev;
      const next = { ...prev };
      let mutated = false;
      const activeUrls = new Set(sitemapPages.map((page) => page.url));
      for (const url of Object.keys(next)) {
        if (!activeUrls.has(url)) {
          delete next[url];
          mutated = true;
        }
      }
      return mutated ? next : prev;
    });
  }, [sitemapPages]);

  // Handlers
  const fetchPageMarkdown = useCallback(
    async (page: EnrichedPage) => {
      if (!page?.url) throw new Error("Invalid page reference.");
      if (markdownByUrl[page.url]) return markdownByUrl[page.url];
      if (page.markdown && !markdownByUrl[page.url]) {
        const entry: MarkdownCacheEntry = {
          content: page.markdown,
          source: "crawler scaffold",
        };
        setMarkdownByUrl((prev) => ({ ...prev, [page.url]: entry }));
        return entry;
      }
      if (markdownLoadingMap[page.url]) return null;

      setMarkdownLoadingMap((prev) => ({ ...prev, [page.url]: true }));
      setMarkdownErrors((prev) => {
        const next = { ...prev };
        delete next[page.url];
        return next;
      });

      try {
        const response = await fetch("/api/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: page.url }),
        });

        if (!response.ok) throw new Error("Unable to fetch AI mirror markdown.");

        const text = await response.text();
        const trimmed = text.trim();
        const entry: MarkdownCacheEntry = {
          content: trimmed,
          source: "live extract",
        };

        setMarkdownByUrl((prev) => ({ ...prev, [page.url]: entry }));
        return entry;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unable to load AI mirror copy.";
        setMarkdownErrors((prev) => ({ ...prev, [page.url]: message }));
        throw new Error(message);
      } finally {
        setMarkdownLoadingMap((prev) => {
          const next = { ...prev };
          delete next[page.url];
          return next;
        });
      }
    },
    [markdownByUrl, markdownLoadingMap]
  );

  useEffect(() => {
    if (!selectedPage) {
      setSelectedMarkdown("");
      setSelectedMarkdownSource("");
      setSelectedMarkdownError(null);
      setIsMarkdownLoading(false);
      return;
    }

    const cached = markdownByUrl[selectedPage.url];
    if (cached) {
      setSelectedMarkdown(cached.content);
      setSelectedMarkdownSource(cached.source);
      setSelectedMarkdownError(null);
      setIsMarkdownLoading(false);
      return;
    }

    let cancelled = false;
    setIsMarkdownLoading(true);
    setSelectedMarkdownError(null);

    async function hydrateMarkdown() {
      if (!selectedPage) return;
      try {
        const entry = await fetchPageMarkdown(selectedPage);
        if (!entry || cancelled) return;
        setSelectedMarkdown(entry.content);
        setSelectedMarkdownSource(entry.source);
        setSelectedMarkdownError(null);
      } catch (fetchError) {
        if (!cancelled) {
          setSelectedMarkdownError(
            fetchError instanceof Error
              ? fetchError.message
              : "Unable to load AI mirror copy."
          );
        }
      } finally {
        if (!cancelled) setIsMarkdownLoading(false);
      }
    }

    hydrateMarkdown();
    return () => {
      cancelled = true;
    };
  }, [selectedPage, markdownByUrl, fetchPageMarkdown]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!rootUrl || isLoading) return;

    // Check if user is authenticated
    if (!isAuthenticated) {
      // Store the URL for after login
      sessionStorage.setItem("pendingUrl", rootUrl);
      router.push("/login");
      return;
    }

    setIsLoading(true);
    setError(null);
    setViewStage("progress");
    setDisplayState("json-xml");
    setSitemapPages([]);
    setSelectedPage(null);
    setSelectedMarkdown("");
    setSelectedMarkdownSource("");
    setSelectedMarkdownError(null);
    setResultJson("");
    setResultXml("");
    setMarkdownByUrl({});
    setMarkdownErrors({});
    setMarkdownLoadingMap({});

    try {
      const response = await fetch("/api/sitemap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: rootUrl, maxDepth: depth }),
      });

      const body = await response.text();

      if (!response.ok) {
        let message = "Unable to generate sitemap.";
        try {
          const payload = JSON.parse(body);
          message = payload?.error ?? message;
        } catch {
          // ignore parse errors
        }
        throw new Error(message);
      }

      const payload: SitemapApiResponse = body ? JSON.parse(body) : {};
      const enrichedPages = mapPagesFromPayload(payload);

      const xmlContent = payload.xml ?? "";
      const formattedJson = JSON.stringify(
        {
          site: payload.site ?? null,
          generated_at: payload.generated_at ?? null,
          pages: payload.pages ?? [],
        },
        null,
        2
      );

      setResultJson(formattedJson);
      setResultXml(xmlContent);
      setGeneratedAt(payload.generated_at ?? null);
      setSitemapPages(enrichedPages);
      setSelectedPage(enrichedPages[0] ?? null);

      // --- FIX: Save Data for AiMirrorPage ---
      // This ensures that when you navigate to /ai-mirror, it has the data immediately.
      const aiMirrorSnapshot = {
        rootUrl: rootUrl,
        resultXml: xmlContent,
        generatedAt: payload.generated_at ?? null,
        sitemapPages: enrichedPages
      };
      localStorage.setItem("ai-mirror-summary", JSON.stringify(aiMirrorSnapshot));
      // ---------------------------------------

      setDisplayState("ai-mirror");
      setTimeout(() => setDisplayState("ready"), 1000);

      setViewStage("progress");

      // --- Existing Feed Save ---
      saveFeedSnapshot({
        site: payload.site ?? undefined,
        rootUrl,
        generatedAt: payload.generated_at ?? null,
        json: formattedJson,
        xml: xmlContent,
        savedAt: new Date().toISOString(),
      });
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Unexpected crawl failure."
      );
      setViewStage("form");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setRootUrl("");
    setDepth(2);
    setViewStage("form");
    setDisplayState("json-xml");
    setIsLoading(false);
    setError(null);
    setResultJson("");
    setResultXml("");
    setGeneratedAt(null);
    setSitemapPages([]);
    setSelectedPage(null);
    setSelectedMarkdown("");
    setSelectedMarkdownSource("");
    setSelectedMarkdownError(null);
    setMarkdownByUrl({});
    setMarkdownErrors({});
    setMarkdownLoadingMap({});

    // --- FIX: Clear AI Mirror Data on Reset ---
    // This prevents old data from persisting if you start a new crawl
    try {
      localStorage.removeItem("ai-mirror-summary");
    } catch (e) { console.warn(e); }
    // ----------------------------------------
  };

  const handleDownloadXml = () => {
    if (!resultXml) return;
    downloadTextFile(resultXml, "sitemap.xml", "application/xml");
  };

  const viewXXmlAndJsonFiles = () => {
    const payload = resultXml || resultJson;
    if (!payload) return;
    const mimeType = resultXml ? "application/xml" : "application/json";
    const blob = new Blob([payload], { type: mimeType });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8 selection:bg-indigo-100 selection:text-indigo-700">

      <style jsx global>{`
        @keyframes shimmer {
          0% { background-position: -1000px 0; }
          100% { background-position: 1000px 0; }
        }
        @keyframes progress {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer { animation: shimmer 2s linear infinite; }
        .animate-progress { animation: progress 1.5s infinite linear; }
        .animate-fade-in { animation: fadeIn 0.5s ease-out; }
        .animate-fade-in-up { animation: fadeInUp 0.5s ease-out; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <header className="w-full max-w-5xl mb-12 flex justify-between items-center animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-6 h-6"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Sitemap<span className="text-indigo-600">Pro</span>
            </h1>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
              Traffic Bifurcate
            </p>
          </div>
        </div>

        {/* User Menu - Show only for authenticated users */}
        {isAuthenticated && !isLoadingSession && (
          <div className="flex items-center gap-3">
            <Link
              href="/recent-crawls"
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="7" height="9" x="3" y="3" rx="1"/>
                <rect width="7" height="5" x="14" y="3" rx="1"/>
                <rect width="7" height="9" x="14" y="12" rx="1"/>
                <rect width="7" height="5" x="3" y="16" rx="1"/>
              </svg>
              Dashboard
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" x2="9" y1="12" y2="12"/>
              </svg>
              Logout
            </button>
          </div>
        )}

        {viewStage !== "form" && (
          <button
            onClick={handleReset}
            className="text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors flex items-center gap-1"
          >
            Start New
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 12"></path>
              <path d="M3 3v9h9"></path>
            </svg>
          </button>
        )}
      </header>

      <main className="w-full max-w-5xl space-y-10">
        {/* FORM SECTION */}
        {showForm && (
          <div className="max-w-2xl mx-auto text-center animate-fade-in-up">
            <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-4">
              Discover your site structure
            </h2>
            <p className="text-lg text-slate-500 mb-10">
              Enter a URL to generate XML sitemaps, JSON feeds, and prepare an AI
              mirror for your content.
            </p>

            <form onSubmit={handleSubmit} className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
              <div className="relative bg-white rounded-xl shadow-xl p-2 flex items-center gap-2">
                <div className="pl-4 text-slate-400">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                  </svg>
                </div>
                <input
                  type="url"
                  required
                  value={rootUrl}
                  onChange={(e) => setRootUrl(e.target.value)}
                  placeholder="https://domain.com"
                  className="flex-1 bg-transparent border-none outline-none focus:ring-0 focus:outline-none text-slate-900 placeholder:text-slate-400 text-lg h-12"
                />
                <button
                  type="submit"
                  disabled={isLoading || !rootUrl}
                  className="bg-slate-900 text-white font-semibold px-8 py-3 rounded-lg hover:bg-indigo-600 transition-colors disabled:bg-slate-200 disabled:text-slate-400 whitespace-nowrap"
                >
                  {isLoading ? "Starting..." : "Start Crawl"}
                </button>
              </div>
            </form>

          </div>
        )}

        {/* PROGRESS SECTION */}
        {showProgress && (
          <section className="space-y-8 animate-fade-in">
            <div className="text-center space-y-2">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold uppercase tracking-wider border border-indigo-100">
                <span
                  className={`w-2 h-2 rounded-full ${displayState === "ready"
                    ? "bg-emerald-500"
                    : "bg-indigo-500 animate-pulse"
                    }`}
                ></span>
                {displayState === "ready" ? "Process Complete" : "Processing"}
              </span>
              <h2 className="text-3xl font-bold text-slate-900">
                {displayState === "ready"
                  ? "Your sitemaps are ready"
                  : displayState === "ai-mirror"
                    ? "Building AI Mirror..."
                    : "Crawling website structure"}
              </h2>
              <p className="text-slate-500">{rootUrl}</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <StatusCard
                icon={<DocumentIcon className="w-6 h-6" />}
                title="Sitemap Files"
                description={
                  jsonComplete
                    ? "XML and JSON sitemaps successfully generated."
                    : jsonActive
                      ? "Analyzing internal links and hierarchy..."
                      : "Waiting for crawler initialization..."
                }
                statusLabel={jsonComplete ? "Ready" : jsonActive ? "Processing" : "Queued"}
                statusTone={jsonComplete ? "success" : jsonActive ? "active" : "muted"}
                loading={jsonActive}
                primaryAction={{
                  label: "Download XML",
                  onClick: handleDownloadXml,
                  icon: <DownloadIcon className="w-4 h-4" />,
                  disabled: !jsonComplete,
                }}
                secondaryAction={{
                  label: "View Source",
                  onClick: viewXXmlAndJsonFiles,
                  icon: <EyeIcon className="w-4 h-4" />,
                  disabled: !viewFilesAvailable,
                }}
              />

              <StatusCard
                icon={<SparklesIcon className="w-6 h-6" />}
                title="AI Mirror"
                description={
                  aiComplete
                    ? "Content extracted and indexed for AI reflection."
                    : aiActive
                      ? "Parsing content and extracting semantics..."
                      : "Scheduled after sitemap generation."
                }
                statusLabel={aiComplete ? "Synced" : aiActive ? "Generating" : "Queued"}
                statusTone={aiComplete ? "success" : aiActive ? "active" : "muted"}
                loading={aiActive}
                primaryAction={{
                  label: "View AI Mirror",
                  onClick: () => router.push("/ai-mirror"),
                  icon: <ArrowRight className="w-4 h-4" />,
                  disabled: !aiComplete,
                }}
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-start gap-3 animate-pulse">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-5 h-5 shrink-0 mt-0.5"
                >
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <span className="text-sm font-medium">{error}</span>
              </div>
            )}

            {displayState === "ready" && (
              <div className="flex justify-center pt-4">
                <button
                  onClick={() => router.push("/ai-mirror")}
                  className="group inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-medium rounded-full hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 hover:shadow-indigo-300"
                >
                  Go to Analytics
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

// --- HELPER FUNCTIONS ---

function mapPagesFromPayload(payload: SitemapApiResponse): EnrichedPage[] {
  type ParsedEntry = { content: string; data: FrontMatterData };
  const entries = new Map<string, ParsedEntry>();
  const fallbackLastMod = payload.generated_at ?? null;

  for (const entry of payload.markdownEntries ?? []) {
    const parsed = matter(entry.markdown ?? "");
    entries.set(entry.url, {
      content: parsed.content.trim(),
      data: parsed.data as FrontMatterData,
    });
  }

  return (payload.pages ?? []).map((page) => {
    const parsed = entries.get(page.url);
    const frontMatter = parsed?.data;
    return {
      ...page,
      frontMatter,
      markdown: parsed?.content,
      lastModified: deriveLastModified(frontMatter, fallbackLastMod),
    };
  });
}

function downloadTextFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function deriveLastModified(
  frontMatter?: FrontMatterData,
  fallback?: string | null
): string | null {
  const candidate = frontMatter?.updated ?? frontMatter?.lastmod;
  if (candidate) {
    const parsed = new Date(candidate);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  if (fallback) {
    const parsedFallback = new Date(fallback);
    if (!Number.isNaN(parsedFallback.getTime())) {
      return parsedFallback.toISOString();
    }
  }
  return null;
}