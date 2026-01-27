import { NextResponse } from "next/server";
import { JSDOM } from "jsdom";

export const runtime = "nodejs";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";
const MAX_DEPTH = 4;
const MAX_PAGES = 120;
const MAX_DOCUMENT_BYTES = 2 * 1024 * 1024; // 2 MB cap keeps crawl bounded.
const STATIC_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".svg",
  ".webp",
  ".ico",
  ".css",
  ".js",
  ".pdf",
  ".zip",
  ".mp4",
  ".mp3",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
];
const BLOCKED_SEGMENTS = [
  /\/(login|logout|signin|signup|register|auth)\b/i,
  /\/(admin|dashboard)\b/i,
  /\/(account|profile)\b/i,
  /\/(cart|checkout)\b/i,
  /\/(search|filter|track|query)/i,
];

type PageType = "homepage" | "article" | "product" | "docs" | "category";

type PageEntry = {
  url: string;
  ai_url: string;
  type: PageType;
  priority: number;
};

type MarkdownEntry = {
  url: string;
  markdown: string;
};

type QueueItem = {
  url: string;
  depth: number;
};

type FetchResult = {
  finalUrl: string;
  canonical?: string;
  document: Document;
  links: string[];
  cleanup: () => void;
};

type RobotsChecker = {
  allows: (path: string) => boolean;
};

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => ({}));
    const inputUrl = typeof payload?.url === "string" ? payload.url.trim() : "";
    const depthSetting = Number(payload?.maxDepth ?? 3);
    const format =
      typeof payload?.format === "string"
        ? payload.format.toLowerCase()
        : "json";

    if (!inputUrl) {
      return NextResponse.json(
        { error: "Provide a root URL to crawl." },
        { status: 400 }
      );
    }

    const normalizedRoot = normalizeUrl(inputUrl);
    const root = new URL(normalizedRoot);
    const depthLimit = clamp(depthSetting, 1, MAX_DEPTH);
    const siteDomain = root.hostname.replace(/^www\./i, "");

    const robots = await loadRobots(root).catch(() => defaultRobots());

    const queue: QueueItem[] = [{ url: normalizedRoot, depth: 0 }];
    const visited = new Set<string>();
    const recorded = new Set<string>();
    const pages: PageEntry[] = [];

    while (queue.length && pages.length < MAX_PAGES) {
      const current = queue.shift()!;
      const normalizedCurrent = normalizeUrl(current.url);

      if (visited.has(normalizedCurrent)) {
        continue;
      }
      visited.add(normalizedCurrent);

      const currentUrl = new URL(normalizedCurrent);
      if (!isSameHost(root, currentUrl)) {
        continue;
      }
      if (!robots.allows(currentUrl.pathname)) {
        continue;
      }
      if (isBlockedPath(currentUrl)) {
        continue;
      }

      const page = await fetchPage(normalizedCurrent);
      if (!page) {
        continue;
      }

      const canonicalUrl = normalizeUrl(page.canonical ?? page.finalUrl);
      const canonical = new URL(canonicalUrl);
      if (!isSameHost(root, canonical)) {
        page.cleanup();
        continue;
      }
      if (isBlockedPath(canonical) || !robots.allows(canonical.pathname)) {
        page.cleanup();
        continue;
      }

      if (!recorded.has(canonicalUrl)) {
        const pageType = inferType(canonical, page.document);
        pages.push({
          url: canonicalUrl,
          ai_url: buildAiUrl(canonical, siteDomain),
          type: pageType,
          priority: priorityForType(pageType),
        });
        recorded.add(canonicalUrl);
      }

      if (current.depth < depthLimit) {
        for (const href of page.links) {
          try {
            const normalizedLink = normalizeUrl(href, canonical.href);
            const linkUrl = new URL(normalizedLink);
            if (!isSameHost(root, linkUrl)) {
              continue;
            }
            if (isBlockedPath(linkUrl)) {
              continue;
            }
            if (!robots.allows(linkUrl.pathname)) {
              continue;
            }
            if (visited.has(normalizedLink)) {
              continue;
            }
            queue.push({ url: normalizedLink, depth: current.depth + 1 });
          } catch {
            continue;
          }
        }
      }

      page.cleanup();
    }

    const generatedAt = new Date().toISOString();

    const xml = buildSitemapXml(siteDomain, pages, generatedAt);
    const markdown = buildMarkdownSummary(siteDomain, pages, generatedAt);
    const markdownEntries = buildMarkdownEntries(pages);

    if (format === "xml") {
      return new NextResponse(xml, {
        status: 200,
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
        },
      });
    }

    if (format === "md") {
      return new NextResponse(markdown, {
        status: 200,
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
        },
      });
    }

    return NextResponse.json({
      site: siteDomain,
      generated_at: generatedAt,
      pages,
      xml,
      markdown,
      markdownEntries,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to generate sitemap.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

async function fetchPage(url: string): Promise<FetchResult | undefined> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
    cache: "no-store",
  }).catch(() => undefined);

  if (!response || !response.ok) {
    return undefined;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) {
    return undefined;
  }

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength === 0 || buffer.byteLength > MAX_DOCUMENT_BYTES) {
    return undefined;
  }

  const html = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
  const dom = new JSDOM(html, { url: response.url || url });
  const document = dom.window.document;
  const canonical = collectCanonical(document);
  const links = extractLinks(document);

  return {
    finalUrl: response.url || url,
    canonical,
    document,
    links,
    cleanup: () => dom.window.close(),
  };
}

function collectCanonical(document: Document): string | undefined {
  const node = document.querySelector("link[rel='canonical']");
  return node?.getAttribute("href")?.trim();
}

function extractLinks(document: Document): string[] {
  const anchors = Array.from(document.querySelectorAll("a[href]"));
  return anchors
    .map((anchor) => anchor.getAttribute("href")?.trim() ?? "")
    .filter((href) => {
      if (!href || href.startsWith("#")) {
        return false;
      }
      if (href.startsWith("mailto:") || href.startsWith("tel:")) {
        return false;
      }
      if (href.toLowerCase().startsWith("javascript:")) {
        return false;
      }
      return true;
    });
}

function normalizeUrl(input: string, base?: string): string {
  let target: URL;
  try {
    const hasProtocol = /^https?:\/\//i.test(input);
    if (hasProtocol) {
      target = new URL(input);
    } else if (base) {
      target = new URL(input, base);
    } else {
      target = new URL(`https://${input}`);
    }
  } catch {
    throw new Error(`Unable to normalize URL: ${input}`);
  }

  target.protocol = "https:";
  target.hash = "";
  target.search = "";
  if (target.pathname !== "/") {
    target.pathname = target.pathname.replace(/\/+$/, "");
    if (target.pathname === "") {
      target.pathname = "/";
    }
  }
  return target.toString();
}

function buildAiUrl(url: URL, domain: string): string {
  const path = url.pathname === "/" ? "/" : url.pathname;
  return `https://ai.${domain}${path}`;
}

function buildSitemapXml(
  site: string,
  pages: PageEntry[],
  generatedAt: string
): string {
  const urlEntries = pages
    .map((page) => {
      const priority = page.priority.toFixed(2);
      return [
        "  <url>",
        `    <loc>${escapeXml(page.url)}</loc>`,
        `    <lastmod>${escapeXml(generatedAt)}</lastmod>`,
        `    <priority>${priority}</priority>`,
        "  </url>",
      ].join("\n");
    })
    .join("\n");

  const body = urlEntries || "  <!-- No crawlable pages found -->";

  return [
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
    '        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">',
    `  <!--  created with Traffic Bifurcate crawler for ${escapeXml(site)} at ${escapeXml(
      generatedAt
    )}  -->`,
    body,
    "</urlset>",
  ].join("\n");
}

function buildMarkdownSummary(
  site: string,
  pages: PageEntry[],
  generatedAt: string
): string {
  const header = [`# AI Mirror Coverage for ${site}`, `Generated ${generatedAt}`];

  if (!pages.length) {
    return `${header.join("\n\n")}\n\n_No crawlable pages found._\n`;
  }

  const table = [
    "| # | Human URL | AI Mirror URL | Type | Priority |",
    "| --- | --- | --- | --- | --- |",
    ...pages.map((page, index) => {
      const human = formatMarkdownLink(page.url);
      const mirror = formatMarkdownLink(page.ai_url);
      const type = page.type;
      const priority = page.priority.toFixed(2);
      return `| ${index + 1} | ${human} | ${mirror} | ${type} | ${priority} |`;
    }),
  ];

  return `${header.join("\n\n")}\n\n${table.join("\n")}\n`;
}

function buildMarkdownEntries(pages: PageEntry[]): MarkdownEntry[] {
  return pages.map((page, index) => {
    const heading = `Page ${index + 1}: ${formatPageHeading(page)}`;
    const lines = [
      "---",
      "type: ai-mirror-page",
      `source_url: ${page.url}`,
      `canonical: ${page.url}`,
      `page_type: ${page.type}`,
      `intent: ${intentForType(page.type)}`,
      "language: en",
      `priority: ${page.priority.toFixed(2)}`,
      "---",
      "",
      `# ${heading}`,
      "",
      "## Human URL",
      page.url,
      "",
      "## AI Mirror URL",
      page.ai_url,
      "",
      "## Summary",
      "_Replace this section with the AI-specific copy for this route._",
      "",
      "## Key Sections",
      "- Heading 1",
      "- Heading 2",
      "- Call to Action",
      "",
      "## Notes",
      "- Describe the AI intent and guardrails for this mirror page.",
    ];
    return {
      url: page.url,
      markdown: lines.join("\n"),
    };
  });
}

function intentForType(type: PageType): string {
  switch (type) {
    case "product":
      return "transactional";
    case "category":
      return "navigational";
    case "homepage":
      return "overview";
    case "docs":
    case "article":
      return "informational";
    default:
      return "informational";
  }
}

function formatPageHeading(page: PageEntry): string {
  if (page.type === "homepage") {
    return "Homepage";
  }
  return page.type
    .split("-")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function formatMarkdownLink(value: string): string {
  const label = value.replace(/\|/g, "\\|");
  return `[${label}](${value})`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function isSameHost(root: URL, candidate: URL): boolean {
  return hostKey(root.hostname) === hostKey(candidate.hostname);
}

function hostKey(value: string): string {
  return value.replace(/^www\./i, "").toLowerCase();
}

function isBlockedPath(url: URL): boolean {
  const path = url.pathname.toLowerCase();
  if (STATIC_EXTENSIONS.some((ext) => path.endsWith(ext))) {
    return true;
  }
  return BLOCKED_SEGMENTS.some((pattern) => pattern.test(path));
}

function inferType(url: URL, document: Document): PageType {
  const path = url.pathname.toLowerCase();
  const ogType = document
    .querySelector("meta[property='og:type']")
    ?.getAttribute("content")
    ?.toLowerCase();

  if (path === "/") {
    return "homepage";
  }
  if (ogType === "product" || /\/product|\/pricing/.test(path)) {
    return "product";
  }
  if (ogType === "article" || document.querySelector("meta[property='article:published_time']")) {
    return "article";
  }
  if (/\/blog|\/news/.test(path)) {
    return "article";
  }
  if (/\/docs|\/documentation|\/guide/.test(path)) {
    return "docs";
  }
  if (/\/category|\/collections|\/topics/.test(path)) {
    return "category";
  }
  return "category";
}

function priorityForType(type: PageType): number {
  switch (type) {
    case "homepage":
      return 1.0;
    case "product":
    case "docs":
      return 0.8;
    case "article":
      return 0.6;
    default:
      return 0.5;
  }
}

async function loadRobots(root: URL): Promise<RobotsChecker> {
  const robotsUrl = new URL("/robots.txt", root.origin);
  const response = await fetch(robotsUrl.toString(), {
    headers: { "User-Agent": USER_AGENT },
    cache: "no-store",
  }).catch(() => undefined);

  if (!response || !response.ok) {
    return defaultRobots();
  }

  const text = await response.text();
  return parseRobots(text);
}

function defaultRobots(): RobotsChecker {
  return { allows: () => true };
}

function parseRobots(contents: string): RobotsChecker {
  const disallow: string[] = [];
  const allow: string[] = [];
  let applies = false;

  const lines = contents.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const [directive, value = ""] = line.split(":");
    const key = directive.trim().toLowerCase();
    const val = value.trim();

    if (key === "user-agent") {
      applies = val === "*";
      continue;
    }

    if (!applies) {
      continue;
    }

    if (key === "disallow" && val) {
      disallow.push(val);
    }
    if (key === "allow" && val) {
      allow.push(val);
    }
  }

  return {
    allows(path: string) {
      const normalized = path || "/";
      if (matchesAny(normalized, allow)) {
        return true;
      }
      if (!disallow.length) {
        return true;
      }
      return !matchesAny(normalized, disallow);
    },
  };
}

function matchesAny(path: string, rules: string[]): boolean {
  return rules.some((rule) => matchesRule(path, rule));
}

function matchesRule(path: string, rule: string): boolean {
  if (!rule) {
    return false;
  }
  const normalizedRule = rule.startsWith("/") ? rule : `/${rule}`;
  if (normalizedRule === "/") {
    return true;
  }
  if (normalizedRule.includes("*")) {
    const escaped = normalizedRule
      .split("*")
      .map((segment) => segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join(".*");
    const regex = new RegExp(`^${escaped}`);
    return regex.test(path);
  }
  return path.startsWith(normalizedRule);
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
}
