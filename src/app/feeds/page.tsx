

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SidebarRail } from "@/components/sidebar-rail";
import {
  loadFeedSnapshot,
  type PersistedFeedSnapshot,
} from "@/lib/feed-storage";

/* ----------------------------- Types ----------------------------- */

const SITEMAP_FORMATS = ["json", "xml"] as const;
type SitemapFormat = (typeof SITEMAP_FORMATS)[number];
type CopyState = "idle" | "success" | "error";

/* ----------------------------- Icons ----------------------------- */

const CodeIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="16 18 22 12 16 6"></polyline>
    <polyline points="8 6 2 12 8 18"></polyline>
  </svg>
);

const CopyIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
  </svg>
);

const DownloadIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
    <polyline points="7 10 12 15 17 10"></polyline>
    <line x1="12" y1="15" x2="12" y2="3"></line>
  </svg>
);

const CheckCircleIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
    <polyline points="22 4 12 14.01 9 11.01"></polyline>
  </svg>
);

const FileWarningIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
    <polyline points="14 2 14 8 20 8"></polyline>
    <circle cx="12" cy="14" r="2"></circle>
    <line x1="12" y1="16" x2="12" y2="18"></line>
  </svg>
);

/* ---------------------------- Helpers ---------------------------- */

function getPayload(
  snapshot: PersistedFeedSnapshot | null,
  format: SitemapFormat
) {
  if (!snapshot) return "";
  return format === "xml" ? snapshot.xml : snapshot.json;
}

function getMimeType(format: SitemapFormat) {
  return format === "xml" ? "application/xml" : "application/json";
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

/* ----------------------------- Page ----------------------------- */

export default function FeedsWorkspace() {
  const [format, setFormat] = useState<SitemapFormat>("json");
  const [snapshot, setSnapshot] = useState<PersistedFeedSnapshot | null>(null);
  const [copyState, setCopyState] = useState<CopyState>("idle");

  useEffect(() => {
    setSnapshot(loadFeedSnapshot());
  }, []);

  useEffect(() => {
    if (copyState !== "success") return;
    const timeout = window.setTimeout(() => setCopyState("idle"), 2000);
    return () => window.clearTimeout(timeout);
  }, [copyState]);

  const payload = getPayload(snapshot, format);

  const handleCopy = async () => {
    if (!payload) return;
    if (!navigator.clipboard) {
      alert("Clipboard unavailable in this browser context.");
      return;
    }
    try {
      await navigator.clipboard.writeText(payload);
      setCopyState("success");
    } catch {
      alert("Failed to copy content.");
    }
  };

  const handleDownload = () => {
    if (!payload) return;
    const filename = `sitemap.${format}`;
    downloadTextFile(payload, filename, getMimeType(format));
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 font-sans">
      <SidebarRail />

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="flex-none px-8 py-5.5 bg-white border-b border-slate-200 flex justify-between items-center shadow-sm z-10">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500 mb-1">
              {/* <span className="hover:text-slate-900 transition-colors cursor-pointer" onClick={() => window.location.href = '/'}>Home</span>
              <span className="text-slate-300">/</span>
              <span className="text-indigo-600 font-semibold">Feeds</span> */}
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Sitemap Files</h1>
          </div>
          {/* Optional Header Actions */}
        
        </header>

        {/* Main Workspace */}
        <main className="flex-1 overflow-hidden p-8 flex flex-col">
          {snapshot ? (
            <>
              {/* Toolbar */}
              <div className="flex items-center justify-between mb-6">
                {/* Format Toggle */}
                <div className="inline-flex items-center bg-slate-100 p-1 rounded-xl">
                  {SITEMAP_FORMATS.map((option) => {
                    const isActive = format === option;
                    return (
                      <button
                        key={option}
                        onClick={() => setFormat(option)}
                        className={`
                          flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
                          ${isActive 
                            ? "bg-white text-slate-900 shadow-sm" 
                            : "text-slate-500 hover:text-slate-700"
                          }
                        `}
                      >
                        <CodeIcon className="w-4 h-4 opacity-70" />
                        {option.toUpperCase()}
                      </button>
                    );
                  })}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm active:scale-95"
                  >
                    {copyState === "success" ? (
                      <>
                        <CheckCircleIcon className="w-4 h-4 text-emerald-500" />
                        Copied
                      </>
                    ) : (
                      <>
                        <CopyIcon className="w-4 h-4 text-slate-400" />
                        Copy
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-all shadow-md active:scale-95"
                  >
                    <DownloadIcon className="w-4 h-4" />
                    Download
                  </button>
                </div>
              </div>

              {/* Code Preview Pane */}
              <div className="flex-1 bg-slate-900 rounded-2xl shadow-inner border border-slate-800 overflow-hidden flex flex-col relative group">
                
                {/* Pseudo Window Header */}
                <div className="h-10 bg-slate-800/50 border-b border-slate-800 flex items-center px-4 justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50"></div>
                      <div className="w-3 h-3 rounded-full bg-amber-500/20 border border-amber-500/50"></div>
                      <div className="w-3 h-3 rounded-full bg-emerald-500/20 border border-emerald-500/50"></div>
                    </div>
                    <span className="ml-2 text-xs text-slate-400 font-mono">sitemap.{format}</span>
                  </div>
                  <div className="text-[10px] text-slate-600 uppercase tracking-widest font-semibold">
                    Preview
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6">
                  <pre className="font-mono text-sm leading-relaxed text-slate-300 whitespace-pre-wrap break-all">
                    {payload}
                  </pre>
                </div>
              </div>
            </>
          ) : (
            /* Empty State */
            <div className="flex-1 flex flex-col items-center justify-center text-center bg-white rounded-2xl border border-dashed border-slate-300">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                <FileWarningIcon className="w-10 h-10 text-slate-300" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">No Feed Snapshot Found</h2>
              <p className="text-slate-500 max-w-md mb-8">
                You need to run a crawl on the console to generate sitemap data before viewing feeds here.
              </p>
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
              >
                Go to Console
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
              </Link>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
