"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { SidebarRail } from "@/components/sidebar-rail";

type SitemapPage = {
  url: string;
  ai_url?: string;
  type?: string;
  priority?: number;
  lastmod?: string;
  lastModified?: string;
  depth?: number;
  markdown?: string;
};

const MAX_SITEMAP_DEPTH = 4;

type Props = {
  searchParams?: {
    url?: string;
    depth?: string;
  };
};

export default function SitemapPreview({ searchParams }: Props) {
  const initialUrl = searchParams?.url ?? "";
  const initialDepth = searchParams?.depth ? Number(searchParams.depth) : 3;

  const [targetUrl, setTargetUrl] = useState(initialUrl);
  const [depth, setDepth] = useState(
    Number.isFinite(initialDepth) ? initialDepth : 3,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [pages, setPages] = useState<SitemapPage[]>([]);
  const [error, setError] = useState("");
  const [xml, setXml] = useState("");
  const [selectedPage, setSelectedPage] = useState<SitemapPage | null>(null);

  const hasResults = pages.length > 0;

  useEffect(() => {
    if (!pages.length) {
      setSelectedPage(null);
      return;
    }
    setSelectedPage((current) => {
      if (!current) return pages[0];
      const stillPresent = pages.find((page) => page.url === current.url);
      return stillPresent ?? pages[0];
    });
  }, [pages]);

  const summary = useMemo(() => {
    if (!pages.length) {
      return {
        total: 0,
        aiMapped: 0,
        uniqueTypes: 0,
        averageDepth: 0,
      };
    }
    const aiMapped = pages.filter((page) => Boolean(page.ai_url)).length;
    const uniqueTypes = new Set(
      pages
        .map((page) => page.type)
        .filter((value): value is string => Boolean(value)),
    ).size;
    const averageDepth =
      pages.reduce(
        (acc, page) => acc + (typeof page.depth === "number" ? page.depth : 0),
        0,
      ) / pages.length;
    return {
      total: pages.length,
      aiMapped,
      uniqueTypes,
      averageDepth,
    };
  }, [pages]);

  useEffect(() => {
    if (initialUrl) {
      void runPreview(initialUrl, depth);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runPreview = async (url: string, depthValue: number) => {
    setIsLoading(true);
    setError("");
    setPages([]);
    setXml("");

    try {
      const response = await fetch("/api/sitemap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, maxDepth: depthValue }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to load sitemap preview.");
      }

      const parsedPages = Array.isArray(payload.pages)
        ? (payload.pages as SitemapPage[])
        : [];
      const markdownEntries = Array.isArray(payload.markdownEntries)
        ? (payload.markdownEntries as Array<{ url: string; markdown: string }>)
        : [];
      const enrichedPages = parsedPages.map((page) => {
        const markdown = markdownEntries.find(
          (entry) => entry.url === page.url,
        )?.markdown;
        return markdown ? { ...page, markdown } : page;
      });
      setPages(enrichedPages);
      const xmlContent = typeof payload.xml === "string" ? payload.xml : "";
      setXml(xmlContent);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unexpected error.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!targetUrl) return;
    void runPreview(targetUrl, depth);
  };

  const handleXmlDownload = () => {
    if (!xml) return;
    const blob = new Blob([xml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "ai-sitemap.xml";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const getLastMod = (page: SitemapPage) => {
    const raw = page.lastmod ?? page.lastModified;
    if (!raw) return "—";
    try {
      const parsed = new Date(raw);
      return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString();
    } catch {
      return raw;
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-50">
      <SidebarRail />
      <div className="flex-1 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.4em] text-lime-300">
                Sitemap Preview
              </p>
              <h1 className="text-4xl font-semibold text-white">
                Inspect the AI mirror-ready sitemap.
              </h1>
              <p className="text-slate-300">
                Re-run the crawl for any root URL, download the XML, or skim the
                routing table below.
              </p>
            </div>
            <Link
              href="/"
              className="rounded-2xl border border-white/20 px-5 py-3 text-sm font-semibold text-white transition hover:border-lime-200 hover:text-lime-200"
            >
              Back to Console
            </Link>
          </div>

          <div className="grid gap-8 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
            <section className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-[0_0_80px_rgba(0,0,0,0.35)] backdrop-blur">
              <form className="space-y-6" onSubmit={handleSubmit}>
                <div className="space-y-3">
                  <label className="text-sm font-semibold uppercase tracking-wide text-slate-200">
                    Root URL
                  </label>
                  <input
                    type="url"
                    required
                    value={targetUrl}
                    onChange={(event) => setTargetUrl(event.target.value)}
                    placeholder="https://domain.com"
                    className="w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-base text-white placeholder:text-slate-400 focus:border-lime-300 focus:outline-none"
                  />
                </div>

                <div className="space-y-3">
                  <label className="flex items-center justify-between text-sm font-semibold uppercase tracking-wide text-slate-200">
                    <span>Depth</span>
                    <span className="text-slate-400">
                      Up to {MAX_SITEMAP_DEPTH} hops (currently {depth})
                    </span>
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={MAX_SITEMAP_DEPTH}
                    value={depth}
                    onChange={(event) => setDepth(Number(event.target.value))}
                    className="w-full accent-lime-200"
                  />
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={isLoading || !targetUrl}
                    className="flex-1 rounded-2xl bg-lime-200 px-6 py-3 text-center text-slate-950 transition hover:bg-lime-100 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
                  >
                    {isLoading ? "Crawling…" : "Preview Sitemap"}
                  </button>
                  <button
                    type="button"
                    onClick={handleXmlDownload}
                    disabled={!xml}
                    className="rounded-2xl border border-white/20 px-6 py-3 text-sm font-semibold text-white transition hover:border-lime-200 hover:text-lime-200 disabled:cursor-not-allowed disabled:border-white/5 disabled:text-slate-500"
                  >
                    Download XML
                  </button>
                </div>
              </form>
              {error && (
                <p className="mt-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                  {error}
                </p>
              )}

              <div className="mt-8 space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                      Total Pages
                    </p>
                    <p className="text-3xl font-semibold text-white">
                      {summary.total}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                      AI Mirrors
                    </p>
                    <p className="text-3xl font-semibold text-white">
                      {summary.aiMapped}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                      Content Types
                    </p>
                    <p className="text-3xl font-semibold text-white">
                      {summary.uniqueTypes}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                      Avg Depth
                    </p>
                    <p className="text-3xl font-semibold text-white">
                      {summary.averageDepth
                        ? summary.averageDepth.toFixed(1)
                        : "0.0"}
                    </p>
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-slate-900/40 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                    Selected Page
                  </p>
                  {selectedPage ? (
                    <div className="mt-4 space-y-4">
                      <div>
                        <p className="text-sm text-slate-300">Canonical URL</p>
                        <p className="text-base font-semibold text-white break-words">
                          {selectedPage.url}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-300">AI Mirror</p>
                        <p className="text-base font-semibold text-lime-200 break-words">
                          {selectedPage.ai_url ?? "Not available"}
                        </p>
                        <div className="mt-3">
                          <Link
                            href={`/ai?source=${encodeURIComponent(
                              selectedPage.ai_url ?? selectedPage.url,
                            )}`}
                            className="inline-flex items-center justify-center rounded-2xl bg-lime-200 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-lime-100"
                            target="_blank"
                            rel="noreferrer noopener"
                          >
                            View Mirror
                          </Link>
                        </div>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-center">
                          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                            Type
                          </p>
                          <p className="text-base font-semibold text-white">
                            {selectedPage.type ?? "unknown"}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-center">
                          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                            Depth
                          </p>
                          <p className="text-base font-semibold text-white">
                            {typeof selectedPage.depth === "number"
                              ? selectedPage.depth
                              : "—"}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-center">
                          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                            Priority
                          </p>
                          <p className="text-base font-semibold text-white">
                            {typeof selectedPage.priority === "number"
                              ? selectedPage.priority.toFixed(2)
                              : "—"}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-center">
                          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                            Last Modified
                          </p>
                          <p className="text-xs font-semibold text-white">
                            {getLastMod(selectedPage)}
                          </p>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                          Markdown Snapshot
                        </p>
                        <div className="mt-3 rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                          {selectedPage.markdown ? (
                            <div className="ai-article max-h-48 overflow-auto text-xs text-slate-100">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {selectedPage.markdown}
                              </ReactMarkdown>
                            </div>
                          ) : (
                            <p className="text-sm text-slate-400">
                              No markdown captured for this page.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-slate-400">
                      Run a preview, then select any row on the right to
                      populate this panel.
                    </p>
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white p-0 text-slate-900 shadow-2xl">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/5 px-6 py-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                    Current Preview
                  </p>
                  <p className="text-lg font-semibold text-slate-900">
                    {targetUrl || "Awaiting domain"}
                  </p>
                </div>
                <span className="text-sm text-slate-500">
                  {hasResults ? `${pages.length} pages` : "No results yet"}
                </span>
              </div>
              <div className="overflow-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-100 text-xs uppercase tracking-widest text-slate-500">
                    <tr>
                      <th className="px-4 py-3">URL</th>
                      <th className="px-4 py-3">AI Mirror</th>
                      <th className="px-4 py-3">Last Mod</th>
                      <th className="px-4 py-3">Depth</th>
                      <th className="px-4 py-3 text-right">Priority</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!hasResults ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-4 py-6 text-center text-slate-400"
                        >
                          {isLoading
                            ? "Crawling sitemap…"
                            : "Run a preview to see entries here."}
                        </td>
                      </tr>
                    ) : (
                      pages.map((page) => {
                        const isActive = selectedPage?.url === page.url;
                        return (
                          <tr
                            key={page.url}
                            role="button"
                            tabIndex={0}
                            onClick={() => setSelectedPage(page)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                setSelectedPage(page);
                              }
                            }}
                            className={`border-t border-slate-100 focus-visible:outline-none ${isActive ? "bg-lime-50" : "hover:bg-slate-50"
                              } cursor-pointer transition`}
                          >
                            <td className="px-4 py-3">
                              <div className="flex flex-col">
                                <span className="font-medium text-slate-900">
                                  {page.url}
                                </span>
                                <span className="text-xs text-slate-400">
                                  Type {page.type ?? "unknown"}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {page.ai_url ?? "—"}
                            </td>
                            <td className="px-4 py-3 text-slate-500">
                              {getLastMod(page)}
                            </td>
                            <td className="px-4 py-3 text-slate-500">
                              {page.depth ?? "—"}
                            </td>
                            <td className="px-4 py-3 text-right text-slate-900">
                              {typeof page.priority === "number"
                                ? page.priority.toFixed(2)
                                : "—"}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
