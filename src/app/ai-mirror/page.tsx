"use client";

import React, { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SidebarRail } from "@/components/sidebar-rail";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import JSZip from "jszip";
import { marked } from "marked";
import { StructurePanel } from "@/components/structure-panel";

/* ----------------------------- Types ----------------------------- */

type ApiPage = {
  url: string;
  priority?: number;
};

type EnrichedPage = ApiPage & {
  markdown?: string;
  lastModified?: string | null;
  description?: string;
  title?: string;
};

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

const PackageIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M16.5 9.4L7.55 4.24"></path>
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
    <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
    <line x1="12" y1="22.08" x2="12" y2="12"></line>
  </svg>
);

/* ---------------------------- Helpers ---------------------------- */

// Enhanced sanitizer to ensure perfect structure for AI
const sanitizeMarkdown = (text: string) => {
  let clean = text;

  // 1. Remove conversational noise lines
  const noisePhrases = [
    "Please Wait",
    "Why not use this time to clean your screen",
    "Rome wasn't built in a day",
    "Look at the pink disk closely",
    "Don't rush it",
    "We'd let you in now",
    "Drag and drop"
  ];

  noisePhrases.forEach(phrase => {
    const regex = new RegExp(`.*${phrase}.*`, 'i'); // Case insensitive
    clean = clean.replace(regex, '');
  });

  // 2. Remove weird dash separators
  clean = clean.replace(/-{20,}/g, ''); // Remove long lines of dashes

  // 3. Remove "explore more" footer noise
  clean = clean.replace(/explore more\s*-/gi, '');

  // --- NEW: STRUCTURAL FIXES ---

  // 4. FIX: Convert "List Item Headers" (e.g., "- 1. What You'll Do") to H3 Headers
  // This breaks the link between the list above and the section below
  clean = clean.replace(/^\s*-\s*(\d+\.\s+(?:What You'll Do|Requirements|Benefits|Location|Key Responsibility|What You'll Be Doing|Skills & Personal Qualities|Job Description|Notes))/gm, '### $1');

  // 5. FIX: Convert Job Titles (e.g., "Content Planner") to H3 Headers
  // This ensures the AI knows exactly what the title is before reading the description
  // Logic: Match lines that start with Capital letter, are medium length, include support for parentheses, commas, dots
  clean = clean.replace(/^(?![-\d])([A-Z][a-zA-Z0-9\s&/\\\(\)\-\.\,]{4,70})$/gm, '### $1');

  // 6. FIX: Ensure Paragraph Separation (Lowercase.\nUppercase -> Lowercase.\n\nUppercase)
  clean = clean.replace(/([a-z0-9])\n([A-Z])/g, '$1\n\n$2');
  clean = clean.replace(/([.!?])\s*\n\s*([A-Z])/g, '$1\n\n$2');

  // 7. Clean up excessive newlines
  clean = clean.replace(/\n{3,}/g, '\n\n');

  return clean.trim();
};

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
  h1: ({ node, ...props }: any) => <h1 className="text-3xl font-extrabold text-slate-900 mb-4 mt-6 pb-2 " {...props} />,
  h2: ({ node, ...props }: any) => <h2 className="text-2xl font-bold text-slate-900 mb-3 mt-6 pt-2" {...props} />,
  h3: ({ node, ...props }: any) => <h3 className="text-xl font-semibold text-slate-800 mb-2 mt-4" {...props} />,
  p: ({ node, ...props }: any) => <p className="mb-4 leading-relaxed text-slate-600 text-[15px]" {...props} />,
  ul: ({ node, ...props }: any) => <ul className="list-disc pl-6 mb-4 space-y-2 text-slate-600" {...props} />,
  ol: ({ node, ...props }: any) => <ol className="list-decimal pl-6 mb-4 space-y-2 text-slate-600" {...props} />,
  li: ({ node, ...props }: any) => <li className="pl-1" {...props} />,
  code: ({ node, inline, ...props }: any) =>
    inline
      ? <code className="bg-slate-100 text-rose-600 px-1.5 py-0.5 rounded text-sm font-mono font-semibold" {...props} />
      : <code className="block  text-slate-900 p-4  text-sm font-mono overflow-x-auto mb-6 " {...props} />,
  blockquote: ({ node, ...props }: any) => <blockquote className=" pl-4 italic text-slate-500 mb-4 py-2 " {...props} />,
  a: ({ node, ...props }: any) => <a className="text-indigo-600 font-medium hover:text-indigo-800 underline decoration-indigo-200 underline-offset-4 transition-colors" {...props} />,
  hr: ({ node, ...props }: any) => <hr className="my-8" {...props} />,
  strong: ({ node, ...props }: any) => <strong className="font-bold text-slate-900" {...props} />,
};

/* ----------------------------- Page Component ----------------------------- */

export default function AiMirrorPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-slate-500">Loading...</p>
        </div>
      </div>
    }>
      <AiMirrorPageContent />
    </Suspense>
  );
}

function AiMirrorPageContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  const [rootUrl, setRootUrl] = useState("");
  const [resultXml, setResultXml] = useState("");
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [sitemapPages, setSitemapPages] = useState<EnrichedPage[]>([]);
  const [selectedPage, setSelectedPage] = useState<EnrichedPage | null>(null);
  const [isLoadingFromDb, setIsLoadingFromDb] = useState(false);

  // Cache for markdown content
  const [markdownByUrl, setMarkdownByUrl] = useState<Record<string, MarkdownCacheEntry>>({});

  // Display state
  const [selectedMarkdown, setSelectedMarkdown] = useState("");
  const [selectedMarkdownSource, setSelectedMarkdownSource] = useState("");
  const [selectedMarkdownError, setSelectedMarkdownError] = useState<string | null>(null);
  const [isMarkdownLoading, setIsMarkdownLoading] = useState(false);

  // Zip Export State
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [exportProgress, setExportProgress] = useState("");

  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  // Structure verification view state
  const [activeTab, setActiveTab] = useState<"preview" | "structure">("preview");

  /* ------------------------ Hydrate State ------------------------ */

  useEffect(() => {
    const loadData = async () => {
      // If sessionId is provided, load from MongoDB
      if (sessionId) {
        setIsLoadingFromDb(true);
        try {
          const response = await fetch(`/api/crawled-data?sessionId=${sessionId}`);
          if (response.ok) {
            const data = await response.json();
            const pages = data.data || [];

            // Set the pages from MongoDB
            setSitemapPages(pages);
            setSelectedPage(pages[0] || null);

          }
        } catch (error) {
          console.error("Failed to load from MongoDB:", error);
        } finally {
          setIsLoadingFromDb(false);
        }
        return;
      }

      // Otherwise, load from localStorage (existing behavior)
      const snapshot = loadAiMirrorSnapshot();
      if (snapshot) {
        setRootUrl(snapshot.rootUrl ?? "");
        setResultXml(snapshot.resultXml ?? "");
        setGeneratedAt(snapshot.generatedAt ?? null);
        setSitemapPages(snapshot.sitemapPages ?? []);
        setMarkdownByUrl({});
        setSelectedMarkdown("");
        setSelectedMarkdownError(null);
        setSelectedPage(snapshot.sitemapPages?.[0] ?? null);
      }
    };

    loadData();
  }, [sessionId]);

  /* ---------------------- Fetch Markdown ------------------------- */

  const fetchPageMarkdown = useCallback(async (page: EnrichedPage) => {
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
      const rawText = (await res.text()).trim();

      // CLEANSE THE CONTENT
      const cleanText = sanitizeMarkdown(rawText);

      const entry: MarkdownCacheEntry = { content: cleanText, source: "live extract" };
      setMarkdownByUrl((prev) => ({ ...prev, [page.url]: entry }));
      return entry;
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : "Markdown load error");
    } finally {
      setIsMarkdownLoading(false);
    }
  }, [markdownByUrl]);

  /* --------------------- Markdown Selection ---------------------- */

  useEffect(() => {
    if (!selectedPage) return;
    const cached = markdownByUrl[selectedPage.url];
    if (cached) {
      setSelectedMarkdown(cached.content);
      setSelectedMarkdownSource(cached.source);
      return;
    }
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
    return () => { cancelled = true; };
  }, [selectedPage, markdownByUrl, fetchPageMarkdown]);

  const handleCopy = () => {
    if (!selectedMarkdown) return;
    navigator.clipboard.writeText(selectedMarkdown);
    setCopyMessage("Copied!");
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = setTimeout(() => setCopyMessage(null), 2000);
  };

  /* ---------------------- Download ZIP Logic ----------------------- */

  const handleDownloadZip = async () => {
    if (sitemapPages.length === 0) return;

    setIsExportingZip(true);
    setExportProgress("Initializing...");

    try {
      const zip = new JSZip();
      const folder = zip.folder("ai-mirror-content");

      const fileEntries: { filename: string, displayName: string }[] = [];

      // Helper to sanitize filename
      const getFilename = (url: string) => {
        let name = url.replace(rootUrl, "").replace(/^\//, "");
        name = name.replace(/[^a-z0-9-_\/]/gi, '_');
        if (name.endsWith('/')) name = name.slice(0, -1);
        if (!name) name = "home";
        return `${name}.html`;
      };

      for (let i = 0; i < sitemapPages.length; i++) {
        const page = sitemapPages[i];
        setExportProgress(`Converting ${i + 1} of ${sitemapPages.length}...`);

        let content = "";

        if (markdownByUrl[page.url]) {
          content = markdownByUrl[page.url].content;
        } else {
          try {
            const res = await fetch("/api/extract", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ url: page.url }),
            });
            if (res.ok) {
              const rawText = (await res.text()).trim();
              // CLEANSE THE CONTENT
              content = sanitizeMarkdown(rawText);

              setMarkdownByUrl(prev => ({ ...prev, [page.url]: { content, source: "live extract" } }));
            } else {
              content = `# Error\n\nFailed to fetch content for ${page.url}. Status: ${res.status}`;
            }
          } catch (e) {
            content = `# Error\n\nNetwork error fetching ${page.url}.`;
          }
        }

        // Convert Markdown to HTML
        const htmlBody = await marked.parse(content);

        // Build HTML Document
        const fullHtmlDocument = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${page.url}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 2rem; }
        h1, h2, h3 { margin-top: 1.5em; color: #111; }
        p { margin-bottom: 1em; }
        a { color: #0066cc; }
        blockquote { border-left: 4px solid #ddd; padding-left: 1rem; color: #666; margin-left: 0; }
        pre { background: #f4f4f4; padding: 1rem; overflow-x: auto; border-radius: 4px; }
        code { background: #f4f4f4; padding: 2px 4px; border-radius: 3px; font-family: monospace; }
        pre code { background: none; padding: 0; }
        img { max-width: 100%; height: auto; }
    </style>
</head>
<body>
    ${htmlBody}
</body>
</html>
        `;

        const filename = getFilename(page.url);
        folder?.file(filename, fullHtmlDocument);

        const displayName = page.url.replace(rootUrl, "").replace(/^\//, "") || "Home";
        fileEntries.push({ filename, displayName });
      }

      // 2. Generate Index.html Navigation
      setExportProgress("Creating navigation...");
      const navigationList = fileEntries.map(entry => `
        <li style="border-bottom: 1px solid #eee;">
          <a href="${entry.filename}" style="display: block; padding: 12px 15px; text-decoration: none; color: #334155; font-weight: 500; transition: background 0.2s;">
            ${entry.displayName}
          </a>
        </li>
      `).join('');

      const indexHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Index - Site Export</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.5; color: #1e293b; background-color: #f1f5f9; margin: 0; padding: 2rem; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); overflow: hidden; }
        header { background: #4f46e5; padding: 1.5rem; color: white; text-align: center; }
        h1 { margin: 0; font-size: 1.5rem; font-weight: 700; }
        ul { list-style: none; margin: 0; padding: 0; }
        li { transition: background-color 0.2s; }
        li:hover { background-color: #f8fafc; }
        a:hover { color: #4f46e5; }
        .footer { padding: 1rem; text-align: center; font-size: 0.875rem; color: #64748b; border-top: 1px solid #e2e8f0; }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>📄 Exported Pages</h1>
        </header>
        <ul>
            ${navigationList}
        </ul>
        <div class="footer">
            Open any file to view the converted HTML.<br>Generated by AI Mirror
        </div>
    </div>
</body>
</html>
      `;

      folder?.file("index.html", indexHtml);

      setExportProgress("Compressing files...");
      const blob = await zip.generateAsync({ type: "blob" });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ai-mirror-${new Date().getTime()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportProgress("Done!");
      setTimeout(() => setExportProgress(""), 2000);

    } catch (error) {
      console.error("Zip creation failed", error);
      setExportProgress("Error creating zip");
    } finally {
      setIsExportingZip(false);
    }
  };

  /* ----------------------------- UI ------------------------------ */

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <SidebarRail aiMirrorActive />

      <div className="flex-1 flex flex-col h-screen overflow-hidden">

        <header className="flex-none px-8 py-6 bg-white border-b border-slate-200 flex justify-between items-center shadow-sm z-10">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <h1 className="text-2xl font-bold text-slate-900">AI Mirror HTML Export</h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadZip}
              disabled={isExportingZip || sitemapPages.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExportingZip ? (
                <>
                  <RefreshIcon className="w-4 h-4 animate-spin" />
                  <span>{exportProgress}</span>
                </>
              ) : (
                <>
                  <PackageIcon className="w-4 h-4" />
                  <span className="hidden sm:inline">Download ZIP</span>
                </>
              )}
            </button>

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

        <div className="flex-1 flex overflow-hidden">

          {/* Left Sidebar: List */}
          <div className="w-80 flex-none bg-white border-r border-slate-200 flex flex-col">
            <div className="h-14 border-b border-slate-100 flex items-center px-4 justify-between flex-shrink-0">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Pages ({sitemapPages.length})</h3>
              {isLoadingFromDb && (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-xs text-slate-500">Loading...</span>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {isLoadingFromDb ? (
                <div className="p-8 flex flex-col items-center justify-center text-center">
                  <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="text-sm text-slate-500">Loading crawled pages...</p>
                </div>
              ) : sitemapPages.length === 0 ? (
                <div className="p-8 flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                    <FileTextIcon className="w-6 h-6 text-slate-400" />
                  </div>
                  <p className="text-sm text-slate-500">No pages found</p>
                  <p className="text-xs text-slate-400 mt-1">Start a new crawl to see pages here</p>
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {sitemapPages.map((page) => {
                    const isActive = selectedPage?.url === page.url;
                    const relativePath = page.url.replace(rootUrl, "").replace(/^\//, "") || "Home";
                    return (
                      <button
                        key={page.url}
                        onClick={() => setSelectedPage(page)}
                        className={`w-full text-left flex items-center justify-between p-3 rounded-lg transition-all duration-200 group ${isActive ? "bg-indigo-50 border border-indigo-100 ring-1 ring-indigo-200 shadow-sm" : "border border-transparent hover:bg-slate-50 hover:border-slate-100 hover:shadow-sm"}`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`flex-shrink-0 p-1.5 rounded-md ${isActive ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-400 group-hover:text-slate-600"}`}>
                            <GlobeIcon className="w-3.5 h-3.5" />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className={`text-sm font-medium truncate ${isActive ? "text-indigo-900" : "text-slate-700"}`}>{relativePath}</span>
                            <span className="text-[10px] text-slate-400 truncate">{formatDateDisplay(page.lastModified ?? generatedAt)}</span>
                          </div>
                        </div>
                        {formatPriority(page.priority)}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Side: Content Preview */}
          <div className="flex-1 bg-slate-50 overflow-y-auto p-0 relative scroll-smooth">
            {!selectedPage ? (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-white border border-slate-200 rounded-2xl flex items-center justify-center mb-6 shadow-sm"><FileTextIcon className="w-8 h-8 text-slate-300" /></div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">No Page Selected</h2>
                <p className="text-slate-500 max-w-sm text-sm">Select a page from sidebar to view its content. The ZIP download will convert these to HTML and add a navigation file.</p>
              </div>
            ) : (
              <div className="max-w-4xl mx-auto w-full pb-12">

                <div className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-sm border-b border-slate-200">
                  {/* Tab Navigation */}
                  <div className="flex items-center justify-between px-6 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setActiveTab("preview")}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === "preview"
                          ? "bg-white text-indigo-700 shadow-sm border border-indigo-100"
                          : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                          }`}
                      >
                        📄 Preview
                      </button>
                      <button
                        onClick={() => setActiveTab("structure")}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === "structure"
                          ? "bg-white text-indigo-700 shadow-sm border border-indigo-100"
                          : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                          }`}
                      >
                        🤖 AI Structure
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${selectedMarkdownSource === "live extract" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-500 border-slate-200"}`}>
                        {selectedMarkdownSource === "live extract" ? <RefreshIcon className="w-3 h-3" /> : <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>}
                        {selectedMarkdownSource === "live extract" ? "Live" : "Cached"}
                      </span>
                      <a href={selectedPage.url} target="_blank" rel="noreferrer" className="text-xs font-bold text-slate-500 hover:text-indigo-600 transition-colors flex items-center gap-1"><span>Original</span><ExternalLinkIcon className="w-3 h-3" /></a>
                      <button onClick={handleCopy} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:text-indigo-600 hover:border-indigo-200 hover:shadow-sm transition-all shadow-sm">
                        {copyMessage ? <><CheckCircleIcon className="w-4 h-4 text-emerald-500" /></> : <><CopyIcon className="w-4 h-4 text-slate-400" /></>}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Preview Tab */}
                {activeTab === "preview" && (
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 relative overflow-hidden">
                    {isMarkdownLoading && <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-20 flex flex-col items-center justify-center"><div className="relative w-12 h-12"><div className="absolute inset-0 border-4 border-indigo-100 rounded-full"></div><div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div></div><p className="mt-4 text-sm font-medium text-slate-600 animate-pulse">Generating preview...</p></div>}
                    {selectedMarkdownError && <div className="p-12 flex flex-col items-center justify-center text-center h-full"><div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-4"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-red-500"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg></div><h3 className="text-lg font-bold text-slate-900 mb-1">Unable to load content</h3><p className="text-slate-500 text-sm max-w-sm mb-6">{selectedMarkdownError}</p><button onClick={() => fetchPageMarkdown(selectedPage)} className="px-4 py-2 bg-slate-900 text-white text-sm rounded-lg hover:bg-slate-800 font-medium transition-colors">Retry Request</button></div>}
                    {!isMarkdownLoading && !selectedMarkdownError && <div className="px-6 py-4 md:px-8 md:py-0"><ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownComponents}>{selectedMarkdown}</ReactMarkdown></div>}
                  </div>
                )}

                {/* Structure Verification Tab */}
                {activeTab === "structure" && (
                  <div className="px-6 py-6">
                    {isMarkdownLoading ? (
                      <div className="flex flex-col items-center justify-center py-24">
                        <div className="relative w-12 h-12 mb-4">
                          <div className="absolute inset-0 border-4 border-indigo-100 rounded-full"></div>
                          <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
                        </div>
                        <p className="text-sm font-medium text-slate-600">Loading structure analysis...</p>
                      </div>
                    ) : selectedMarkdownError ? (
                      <div className="p-12 flex flex-col items-center justify-center text-center">
                        <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-4">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-red-500">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                          </svg>
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 mb-1">Cannot analyze structure</h3>
                        <p className="text-slate-500 text-sm max-w-sm mb-6">{selectedMarkdownError}</p>
                      </div>
                    ) : (
                      <StructurePanel markdown={selectedMarkdown} />
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}