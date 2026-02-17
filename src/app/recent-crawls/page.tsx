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

  const handleDelete = async (sessionId: string) => {
    if (!confirm("Are you sure you want to delete this crawl session?")) {
      return;
    }

    setDeletingId(sessionId);
    try {
      const response = await fetch(`/api/crawled-data?sessionId=${sessionId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setCrawlHistory((prev) => prev.filter((item) => item.sessionId !== sessionId));
      }
    } catch (error) {
      console.error("Failed to delete crawl:", error);
    } finally {
      setDeletingId(null);
    }
  };

  const handleSessionClick = (sessionId: string) => {
    router.push(`/ai-mirror?sessionId=${sessionId}`);
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <SidebarRail />
      <main className="flex-1 p-8">
        <div className="max-w-4xl mx-auto">
          <header className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900">Recent Crawls</h1>
            <p className="text-slate-500 mt-2">View and manage your crawl history</p>
          </header>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                <p className="text-slate-500">Loading crawl history...</p>
              </div>
            </div>
          ) : crawlHistory.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="w-8 h-8 text-slate-400"
                >
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 12" />
                  <path d="M3 3v9h9" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-slate-900 mb-2">No crawls yet</h2>
              <p className="text-slate-500 mb-6">Start your first crawl from the home page</p>
              <a
                href="/"
                className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-indigo-700 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="w-5 h-5"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Start New Crawl
              </a>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="divide-y divide-slate-100">
                {crawlHistory.map((session) => (
                  <div
                    key={session.sessionId}
                    className="p-6 hover:bg-slate-50 transition-colors cursor-pointer group"
                    onClick={() => handleSessionClick(session.sessionId)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0 pr-4">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-semibold text-slate-900 text-lg">
                            {session.siteDomain}
                          </span>
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${session.status === "completed"
                                ? "bg-emerald-100 text-emerald-800"
                                : session.status === "pending"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                          >
                            {session.status}
                          </span>
                        </div>
                        <p className="text-slate-500 truncate mb-3">{session.rootUrl}</p>
                        <div className="flex items-center gap-6 text-sm text-slate-400">
                          <span className="flex items-center gap-1">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              className="w-4 h-4"
                            >
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                              <polyline points="14 2 14 8 20 8" />
                            </svg>
                            {session.pageCount} pages
                          </span>
                          <span className="flex items-center gap-1">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              className="w-4 h-4"
                            >
                              <circle cx="12" cy="12" r="10" />
                              <polyline points="12 6 12 12 16 14" />
                            </svg>
                            {new Date(session.generatedAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSessionClick(session.sessionId);
                          }}
                          className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium opacity-0 group-hover:opacity-100 transition-opacity hover:bg-indigo-700 flex items-center gap-2"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className="w-4 h-4"
                          >
                            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                          View AI Mirror
                        </button>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              const response = await fetch(`/api/crawled-data?sessionId=${session.sessionId}`);
                              if (response.ok) {
                                const data = await response.json();
                                if (data.feed?.xmlContent) {
                                  const blob = new Blob([data.feed.xmlContent], { type: "application/xml" });
                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement("a");
                                  a.href = url;
                                  a.download = `${session.siteDomain}-sitemap.xml`;
                                  a.click();
                                  URL.revokeObjectURL(url);
                                } else {
                                  alert("No XML data available for this crawl");
                                }
                              }
                            } catch (error) {
                              console.error("Failed to download XML:", error);
                              alert("Failed to download XML");
                            }
                          }}
                          className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium opacity-0 group-hover:opacity-100 transition-opacity hover:bg-emerald-700 flex items-center gap-2"
                        >
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
                          Download XML
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(session.sessionId);
                          }}
                          disabled={deletingId === session.sessionId}
                          className="p-2 text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50"
                        >
                          {deletingId === session.sessionId ? (
                            <div className="animate-spin h-5 w-5 border-2 border-red-500 border-t-transparent rounded-full" />
                          ) : (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              className="w-5 h-5"
                            >
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
