"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { SidebarRail } from "@/components/sidebar-rail";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/* ----------------------------- Types ----------------------------- */

type ApiPage = {
  url: string;
  priority?: number;
};

type EnrichedPage = ApiPage & {
  markdown?: string;
  lastModified?: string | null;
};

// Define a snapshot type similar to FeedsWorkspace for cleaner data loading
type AiMirrorSnapshot = {
  rootUrl: string;
  resultXml: string;
  generatedAt: string | null;
  sitemapPages: EnrichedPage[];
};

type MarkdownSource = "crawler scaffold" | "live extract";

type MarkdownCacheEntry = {
  content: string;
  source: MarkdownSource;
};

/* ----------------------------- Icons ----------------------------- */

const GlobeIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="2" y1="12" x2="22" y2="12"></line>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
  </svg>
);

const FileTextIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
    <polyline points="14 2 14 8 20 8"></polyline>
    <line x1="16" y1="13" x2="8" y2="13"></line>
    <line x1="16" y1="17" x2="8" y2="17"></line>
    <line x1="10" y1="9" x2="8" y2="9"></line>
  </svg>
);

const CopyIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
  </svg>
);

const CheckCircleIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
    <polyline points="22 4 12 14.01 9 11.01"></polyline>
  </svg>
);

const ExternalLinkIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
    <polyline points="15 3 21 3 21 9"></polyline>
    <line x1="10" y1="14" x2="21" y2="3"></line>
  </svg>
);

const RefreshIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
    <path d="M3 3v5h5"></path>
    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"></path>
    <path d="M16 16h5v5"></path>
  </svg>
);

/* ---------------------------- Helpers ---------------------------- */

// Helper to load data cleanly, similar to FeedsWorkspace
function loadAiMirrorSnapshot(): AiMirrorSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("ai-mirror-summary");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.error("Failed to parse AI Mirror snapshot", e);
    return null;
  }
}

function formatDateDisplay(date?: string | null) {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric"
  });
}

function formatPriority(priority?: number) {
  if (typeof priority !== "number") return null;
  
  let colorClass = "text-slate-500 bg-slate-100";
  if (priority >= 0.8) colorClass = "text-emerald-700 bg-emerald-50 border-emerald-100";
  else if (priority >= 0.5) colorClass = "text-indigo-700 bg-indigo-50 border-indigo-100";
  
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${colorClass}`}>
      {priority.toFixed(1)}
    </span>
  );
}

function downloadTextFile(text: string, filename: string, mimeType: string) {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ---------------------------- Markdown Styling ---------------------------- */

const MarkdownComponents = {
  h1: ({ node, ...props }: any) => <h1 className="text-3xl font-extrabold text-slate-900 mb-4 mt-6 pb-2 border-b border-slate-100" {...props} />,
  h2: ({ node, ...props }: any) => <h2 className="text-2xl font-bold text-slate-900 mb-3 mt-6 pt-2" {...props} />,
  h3: ({ node, ...props }: any) => <h3 className="text-xl font-semibold text-slate-800 mb-2 mt-4" {...props} />,
  p: ({ node, ...props }: any) => <p className="mb-4 leading-relaxed text-slate-600 text-[15px]" {...props} />,
  ul: ({ node, ...props }: any) => <ul className="list-disc pl-6 mb-4 space-y-2 text-slate-600" {...props} />,
  ol: ({ node, ...props }: any) => <ol className="list-decimal pl-6 mb-4 space-y-2 text-slate-600" {...props} />,
  li: ({ node, ...props }: any) => <li className="pl-1" {...props} />,
  code: ({ node, inline, ...props }: any) => 
    inline 
      ? <code className="bg-slate-100 text-rose-600 px-1.5 py-0.5 rounded text-sm font-mono font-semibold" {...props} />
      : <code className="block bg-slate-900 text-slate-50 p-4 rounded-lg text-sm font-mono overflow-x-auto mb-6 border border-slate-800 shadow-inner" {...props} />,
  blockquote: ({ node, ...props }: any) => <blockquote className="border-l-4 border-indigo-200 pl-4 italic text-slate-500 mb-4 bg-slate-50/50 py-2 rounded-r-md" {...props} />,
  a: ({ node, ...props }: any) => <a className="text-indigo-600 font-medium hover:text-indigo-800 underline decoration-indigo-200 underline-offset-4 transition-colors" {...props} />,
  hr: ({ node, ...props }: any) => <hr className="my-8 border-slate-100" {...props} />,
  strong: ({ node, ...props }: any) => <strong className="font-bold text-slate-900" {...props} />,
};

/* ----------------------------- Page Component ----------------------------- */

export default function AiMirrorPage() {
  const [rootUrl, setRootUrl] = useState("");
  const [resultXml, setResultXml] = useState("");
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [sitemapPages, setSitemapPages] = useState<EnrichedPage[]>([]);
  const [selectedPage, setSelectedPage] = useState<EnrichedPage | null>(null);

  // Cache for markdown content
  const [markdownByUrl, setMarkdownByUrl] = useState<Record<string, MarkdownCacheEntry>>({});
  
  // Display state
  const [selectedMarkdown, setSelectedMarkdown] = useState("");
  const [selectedMarkdownSource, setSelectedMarkdownSource] = useState("");
  const [selectedMarkdownError, setSelectedMarkdownError] = useState<string | null>(null);
  const [isMarkdownLoading, setIsMarkdownLoading] = useState(false);

  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ------------------------ Hydrate State (THE FIX) ------------------------ */

  useEffect(() => {
    // 1. Load fresh data from storage
    const snapshot = loadAiMirrorSnapshot();

    if (snapshot) {
      // 2. Update basic fields
      setRootUrl(snapshot.rootUrl ?? "");
      setResultXml(snapshot.resultXml ?? "");
      setGeneratedAt(snapshot.generatedAt ?? null);
      setSitemapPages(snapshot.sitemapPages ?? []);

      // 3. CRITICAL FIX: Clear the old markdown cache and selected content
      // This prevents showing the previous domain's markdown when a new domain is loaded.
      setMarkdownByUrl({});
      setSelectedMarkdown("");
      setSelectedMarkdownError(null);

      // 4. Select the first page of the new list
      setSelectedPage(snapshot.sitemapPages?.[0] ?? null);
    }
  }, []); // Run once on mount (or whenever component remounts)

  /* ---------------------- Fetch Markdown ------------------------- */

  const fetchPageMarkdown = useCallback(async (page: EnrichedPage) => {
    // If already cached for this specific URL, return it
    if (markdownByUrl[page.url]) return markdownByUrl[page.url];

    setIsMarkdownLoading(true);
    setSelectedMarkdownError(null);

    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: page.url }),
      });

      if (!res.ok) throw new Error("Extraction failed");

      const text = (await res.text()).trim();
      const entry: MarkdownCacheEntry = { content: text, source: "live extract" };

      setMarkdownByUrl((prev) => ({ ...prev, [page.url]: entry }));
      return entry;
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : "Markdown load error");
    } finally {
      setIsMarkdownLoading(false);
    }
  }, [markdownByUrl]); // Dependent on cache

  /* --------------------- Markdown Selection ---------------------- */

  useEffect(() => {
    if (!selectedPage) return;

    // 1. Check Cache
    const cached = markdownByUrl[selectedPage.url];
    if (cached) {
      setSelectedMarkdown(cached.content);
      setSelectedMarkdownSource(cached.source);
      return;
    }

    // 2. Fetch Live
    let cancelled = false;

    fetchPageMarkdown(selectedPage)
      .then((entry) => {
        if (cancelled) return;
        setSelectedMarkdown(entry.content);
        setSelectedMarkdownSource(entry.source);
      })
      .catch((e) => {
        if (!cancelled) setSelectedMarkdownError(e.message);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedPage, markdownByUrl, fetchPageMarkdown]);

  const handleCopy = () => {
    if (!selectedMarkdown) return;
    navigator.clipboard.writeText(selectedMarkdown);
    setCopyMessage("Copied!");
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = setTimeout(() => setCopyMessage(null), 2000);
  };

  /* ----------------------------- UI ------------------------------ */

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <SidebarRail aiMirrorActive />

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        
        <header className="flex-none px-8 py-6 bg-white border-b border-slate-200 flex justify-between items-center shadow-sm z-10">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <h1 className="text-2xl font-bold text-slate-900">AI Mirror Markdown</h1>
          </div>

          <div className="flex items-center gap-3">
             <button
              onClick={() => downloadTextFile(resultXml, "sitemap.xml", "application/xml")}
              disabled={!resultXml}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              <span className="hidden sm:inline">Export XML</span>
            </button>
          </div>
        </header>

        {/* Main Workspace */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Left Sidebar: List */}
          <div className="w-80 flex-none bg-white border-r border-slate-200 flex flex-col">
            <div className="h-14 border-b border-slate-100 flex items-center px-4 justify-between flex-shrink-0">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Pages ({sitemapPages.length})</h3>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="p-2 space-y-1">
                {sitemapPages.map((page) => {
                  const isActive = selectedPage?.url === page.url;
                  const relativePath = page.url.replace(rootUrl, "").replace(/^\//, "") || "Home"; 
                  
                  return (
                    <button
                      key={page.url}
                      onClick={() => setSelectedPage(page)}
                      className={`
                        w-full text-left flex items-center justify-between p-3 rounded-lg transition-all duration-200 group
                        ${isActive 
                          ? "bg-indigo-50 border border-indigo-100 ring-1 ring-indigo-200 shadow-sm" 
                          : "border border-transparent hover:bg-slate-50 hover:border-slate-100 hover:shadow-sm"
                        }
                      `}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`flex-shrink-0 p-1.5 rounded-md ${isActive ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-400 group-hover:text-slate-600"}`}>
                          <GlobeIcon className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className={`text-sm font-medium truncate ${isActive ? "text-indigo-900" : "text-slate-700"}`}>
                            {relativePath}
                          </span>
                          <span className="text-[10px] text-slate-400 truncate">
                            {formatDateDisplay(page.lastModified ?? generatedAt)}
                          </span>
                        </div>
                      </div>
                      {formatPriority(page.priority)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Side: Content Preview */}
          <div className="flex-1 bg-slate-50 overflow-y-auto p-0 relative scroll-smooth">
            {!selectedPage ? (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-white border border-slate-200 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                  <FileTextIcon className="w-8 h-8 text-slate-300" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">No Page Selected</h2>
                <p className="text-slate-500 max-w-sm text-sm">Select a page from sidebar to view its AI-generated markdown content and analysis.</p>
              </div>
            ) : (
              <div className="max-w-4xl mx-auto w-full pb-12">
                
                {/* Sticky Header */}
                <div className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-sm px-6 py-3 border-b border-slate-200">
                  <div className="flex justify-between items-center w-full">
                    <div className="flex items-center gap-3">
                      
                      {/* Status Pill */}
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                        selectedMarkdownSource === "live extract" 
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                          : "bg-slate-100 text-slate-500 border-slate-200"
                      }`}>
                        {selectedMarkdownSource === "live extract" ? (
                          <RefreshIcon className="w-3 h-3" />
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>
                        )}
                        {selectedMarkdownSource === "live extract" ? "Live Extraction" : "Cached Scaffold"}
                      </span>

                      {/* View Original Link */}
                      <a 
                        href={selectedPage.url} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-xs font-bold text-slate-500 hover:text-indigo-600 transition-colors flex items-center gap-1"
                      >
                        <span>View Original</span>
                        <ExternalLinkIcon className="w-3 h-3" />
                      </a>
                    </div>

                    {/* Copy Button */}
                    <button 
                      onClick={handleCopy}
                      className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:text-indigo-600 hover:border-indigo-200 hover:shadow-sm transition-all shadow-sm active:scale-95"
                    >
                      {copyMessage ? (
                        <>
                          <CheckCircleIcon className="w-4 h-4 text-emerald-500" />
                          {copyMessage}
                        </>
                      ) : (
                        <>
                          <CopyIcon className="w-4 h-4 text-slate-400" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Document Paper */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 relative overflow-hidden">
                  
                  {/* Loading Overlay */}
                  {isMarkdownLoading && (
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-20 flex flex-col items-center justify-center">
                      <div className="relative w-12 h-12">
                        <div className="absolute inset-0 border-4 border-indigo-100 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
                      </div>
                      <p className="mt-4 text-sm font-medium text-slate-600 animate-pulse">Generating preview...</p>
                    </div>
                  )}

                  {/* Error State */}
                  {selectedMarkdownError && (
                    <div className="p-12 flex flex-col items-center justify-center text-center h-full">
                      <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-red-500"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 mb-1">Unable to load content</h3>
                      <p className="text-slate-500 text-sm max-w-sm mb-6">{selectedMarkdownError}</p>
                      <button 
                        onClick={() => fetchPageMarkdown(selectedPage)}
                        className="px-4 py-2 bg-slate-900 text-white text-sm rounded-lg hover:bg-slate-800 font-medium transition-colors"
                      >
                        Retry Request
                      </button>
                    </div>
                  )}

                  {/* Markdown Content */}
                  {!isMarkdownLoading && !selectedMarkdownError && (
                    <div className="px-6 py-4 md:px-8 md:py-0">
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownComponents}>
                        {selectedMarkdown}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}