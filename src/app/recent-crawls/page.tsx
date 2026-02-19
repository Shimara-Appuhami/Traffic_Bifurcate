"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SidebarRail } from "@/components/sidebar-rail";

type CrawlHistoryItem = {
  sessionId: string;
  siteDomain: string;
  rootUrl: string;
  pageCount: number;
  generatedAt: string;
  completedAt: string;
  status: string;
};

export default function RecentCrawlsPage() {
  const router = useRouter();
  const [crawlHistory, setCrawlHistory] = useState<CrawlHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchCrawlHistory = async () => {
      try {
        setIsLoading(true);
        const response = await fetch("/api/crawled-data");
        if (response.ok) {
          const data = await response.json();
          setCrawlHistory(data.data || []);
        }
      } catch (error) {
        console.error("Failed to fetch crawl history:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCrawlHistory();
  }, []);

  const handleDelete = async (sessionId: string, siteDomain: string) => {
    // Using a custom confirm logic via window for simplicity, 
    // but you could replace this with a Modal component
    const confirmDelete = window.confirm(
      `Are you sure you want to delete the crawl for ${siteDomain}?`
    );
    if (!confirmDelete) return;

    setDeletingId(sessionId);
    try {
      const response = await fetch(
        `/api/crawled-data?sessionId=${sessionId}`,
        {
          method: "DELETE",
        }
      );
      if (response.ok) {
        setCrawlHistory((prev) =>
          prev.filter((item) => item.sessionId !== sessionId)
        );
      }
    } catch (error) {
      console.error("Failed to delete crawl:", error);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownload = async (sessionId: string, siteDomain: string) => {
    setDownloadingId(sessionId);
    try {
      const response = await fetch(
        `/api/crawled-data?sessionId=${sessionId}`
      );
      if (response.ok) {
        const data = await response.json();
        if (data.feed?.xmlContent) {
          const blob = new Blob([data.feed.xmlContent], {
            type: "application/xml",
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${siteDomain}-sitemap.xml`;
          a.click();
          URL.revokeObjectURL(url);
        } else {
          alert("No XML data available for this crawl");
        }
      } else {
        alert("Failed to fetch XML data");
      }
    } catch (error) {
      console.error("Failed to download XML:", error);
      alert("Failed to download XML");
    } finally {
      setDownloadingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusStyles = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
        return "bg-emerald-50 text-emerald-700 border-emerald-100 ring-emerald-600/20";
      case "pending":
        return "bg-amber-50 text-amber-700 border-amber-100 ring-amber-600/20";
      case "failed":
        return "bg-red-50 text-red-700 border-red-100 ring-red-600/20";
      default:
        return "bg-slate-50 text-slate-700 border-slate-100";
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50/50">
      <SidebarRail />
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        <div className="max-w-5xl mx-auto space-y-8">
          {/* Header */}
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
                Recent Crawls
              </h1>
              <p className="text-slate-500 mt-1">
                Manage your website scanning history and exports
              </p>
            </div>
            <a
              href="/"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-all shadow-sm hover:shadow active:scale-95 text-sm"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="w-4 h-4"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              New Crawl
            </a>
          </header>

          {/* Content Area */}
          {isLoading ? (
            <div className="space-y-4">
              {/* Skeleton Loading State */}
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="bg-white p-5 rounded-xl border border-slate-200 animate-pulse"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-3 flex-1">
                      <div className="h-5 bg-slate-200 rounded w-1/3"></div>
                      <div className="h-4 bg-slate-100 rounded w-2/3"></div>
                      <div className="flex gap-4 pt-2">
                        <div className="h-4 bg-slate-100 rounded w-20"></div>
                        <div className="h-4 bg-slate-100 rounded w-24"></div>
                      </div>
                    </div>
                    <div className="h-8 bg-slate-100 rounded-lg w-24"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : crawlHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-slate-300 text-center">
              <div className="w-20 h-20 bg-slate-50 rounded-2xl flex items-center justify-center mb-6 rotate-3">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="w-10 h-10 text-slate-400"
                >
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                  <line x1="12" y1="22.08" x2="12" y2="12" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-slate-900 mb-2">
                No crawls found
              </h2>
              <p className="text-slate-500 max-w-sm mx-auto mb-6">
                Get started by crawling your first website to generate an AI mirror and sitemap.
              </p>
              <a
                href="/"
                className="inline-flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-xl font-medium hover:bg-slate-800 transition-colors"
              >
                Start Your First Crawl
              </a>
            </div>
          ) : (
            <div className="space-y-3">
              {crawlHistory.map((session) => (
                <div
                  key={session.sessionId}
                  onClick={() => router.push(`/ai-mirror?sessionId=${session.sessionId}`)}
                  className="group bg-white p-5 rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer relative overflow-hidden"
                >
                  {/* Left colored bar accent on hover */}
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>

                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Info Section */}
                    <div className="flex items-start gap-4 flex-1 min-w-0 pl-2 md:pl-4">
                      {/* Favicon placeholder */}
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-50 to-slate-50 border border-slate-100 flex items-center justify-center shrink-0 text-indigo-600 font-bold text-lg shadow-sm">
                        {session.siteDomain.charAt(0).toUpperCase()}
                      </div>
                      
                      <div className="min-w-0">
                        <div className="flex items-center gap-3 mb-1 flex-wrap">
                          <h3 className="font-semibold text-slate-900 truncate text-lg">
                            {session.siteDomain}
                          </h3>
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold border ring-1 ring-inset ${getStatusStyles(
                              session.status
                            )}`}
                          >
                            {session.status}
                          </span>
                        </div>
                        <p className="text-sm text-slate-500 truncate mb-2 font-mono bg-slate-50 py-1 px-2 rounded inline-block">
                          {session.rootUrl}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-slate-400 font-medium">
                          <span className="flex items-center gap-1.5">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              className="w-3.5 h-3.5"
                            >
                              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                              <polyline points="14 2 14 8 20 8" />
                            </svg>
                            {session.pageCount} pages
                          </span>
                          <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                          <span className="flex items-center gap-1.5">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              className="w-3.5 h-3.5"
                            >
                              <circle cx="12" cy="12" r="10" />
                              <polyline points="12 6 12 12 16 14" />
                            </svg>
                            {formatDate(session.generatedAt)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions Section */}
                    <div className="flex items-center gap-2 pt-2 md:pt-0 md:pl-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/ai-mirror?sessionId=${session.sessionId}`);
                        }}
                        className="text-sm font-medium text-slate-600 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 px-4 py-2 rounded-lg border border-slate-200 transition-colors flex items-center gap-2"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="w-4 h-4"
                        >
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                        <span className="hidden sm:inline">View</span>
                      </button>

                      <button
                        disabled={downloadingId === session.sessionId}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(session.sessionId, session.siteDomain);
                        }}
                        className="text-sm font-medium text-slate-600 bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 px-4 py-2 rounded-lg border border-slate-200 transition-colors flex items-center gap-2 disabled:opacity-50"
                      >
                        {downloadingId === session.sessionId ? (
                          <div className="animate-spin h-4 w-4 border-2 border-emerald-600 border-t-transparent rounded-full" />
                        ) : (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className="w-4 h-4"
                          >
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                          </svg>
                        )}
                        <span className="hidden sm:inline">XML</span>
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(session.sessionId, session.siteDomain);
                        }}
                        disabled={deletingId === session.sessionId}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Delete Crawl"
                      >
                        {deletingId === session.sessionId ? (
                          <div className="animate-spin h-4 w-4 border-2 border-red-500 border-t-transparent rounded-full" />
                        ) : (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className="w-5 h-5"
                          >
                            <path d="M3 6h18" />
                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}