import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import TurndownService from "turndown";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";
const MAX_DOCUMENT_BYTES = 3 * 1024 * 1024;
const FALLBACK_CONTENT =
  "*No extractable content—site returned an error page or unsupported markup.*";

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});

turndown.keep(["table", "thead", "tbody", "tr", "th", "td"]);

export type ExtractedMetadata = {
  canonical?: string;
  author?: string;
  published?: string;
  updated?: string;
  language?: string;
  contentType?: string;
  primaryTopics: string[];
  entities: string[];
};

export type ExtractionResult = {
  title: string;
  url: string;
  canonical: string;
  markdown: string;
  metadata: ExtractedMetadata;
};

export class ExtractionError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "ExtractionError";
    this.status = status;
  }
}

export async function extractStructuredContent(
  inputUrl: string
): Promise<ExtractionResult> {
  const normalizedUrl = normalizeUrl(inputUrl);
  const { html, finalUrl } = await fetchHtml(normalizedUrl);
  const dom = new JSDOM(html, { url: finalUrl });

  try {
    const document = dom.window.document;
    const reader = new Readability(document);
    const article = reader.parse();

    const canonical = collectCanonical(document) ?? finalUrl;
    const markdown = toMarkdown(
      article?.content ?? document.querySelector("main")?.innerHTML ?? ""
    );

    const metadata = collectMetadata(document, {
      canonical,
      articleDetected: Boolean(article),
    });

    return {
      title: sanitizeLine(article?.title ?? document.title ?? "Untitled"),
      url: finalUrl,
      canonical,
      markdown: markdown || FALLBACK_CONTENT,
      metadata,
    };
  } finally {
    dom.window.close();
  }
}

export function formatAsMdf(result: ExtractionResult): string {
  const lines = [
    `# ${result.title}`,
    "",
    "## URL",
    result.url,
    "",
    "## Canonical",
    result.canonical,
    "",
    "## Content",
    result.markdown,
    "",
    "## Metadata",
    `- Author: ${result.metadata.author ?? ""}`,
    `- Published Date: ${result.metadata.published ?? ""}`,
    `- Updated Date: ${result.metadata.updated ?? ""}`,
    `- Language: ${result.metadata.language ?? ""}`,
    "",
    "## Schema Hints",
    `- Content Type: ${result.metadata.contentType ?? ""}`,
    `- Primary Topics: ${result.metadata.primaryTopics.join(", ")}`,
    `- Entities Mentioned: ${result.metadata.entities.join(", ")}`,
  ];

  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .concat("\n");
}

function normalizeUrl(input: string): string {
  try {
    const hasProtocol = /^https?:\/\//i.test(input);
    const url = new URL(hasProtocol ? input : `https://${input}`);
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new ExtractionError("Only HTTP(S) URLs are supported.", 400);
    }
    url.hash = "";
    return url.toString();
  } catch (error) {
    if (error instanceof ExtractionError) {
      throw error;
    }
    throw new ExtractionError(
      "Unable to parse the provided URL. Use a valid http(s) address.",
      400
    );
  }
}

async function fetchHtml(targetUrl: string): Promise<{ html: string; finalUrl: string }> {
  const response = await fetch(targetUrl, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
    cache: "no-store",
  }).catch(() => undefined);

  if (!response) {
    throw new ExtractionError("Unable to reach source URL.", 502);
  }

  if (!response.ok) {
    const status = response.status >= 500 ? 502 : 400;
    throw new ExtractionError(`Source responded with status ${response.status}.`, status);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) {
    throw new ExtractionError("Source did not return HTML content.", 400);
  }

  const documentBuffer = await response.arrayBuffer();
  if (documentBuffer.byteLength === 0) {
    throw new ExtractionError("Fetched document was empty.", 400);
  }

  if (documentBuffer.byteLength > MAX_DOCUMENT_BYTES) {
    throw new ExtractionError("HTML payload exceeds the 3 MB safety limit.", 400);
  }

  const html = new TextDecoder("utf-8", { fatal: false }).decode(documentBuffer);
  return { html, finalUrl: response.url || targetUrl };
}

function toMarkdown(fragmentHtml: string): string {
  if (!fragmentHtml) {
    return "";
  }

  const markdown = turndown.turndown(fragmentHtml);
  return markdown
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function collectCanonical(document: Document): string | undefined {
  const link = document.querySelector("link[rel='canonical']");
  const href = link?.getAttribute("href")?.trim();
  if (!href) {
    return undefined;
  }

  try {
    const canonicalUrl = new URL(href, document.URL);
    canonicalUrl.hash = "";
    return canonicalUrl.toString();
  } catch {
    return undefined;
  }
}

function collectMetadata(
  document: Document,
  opts: { canonical?: string; articleDetected: boolean }
): ExtractedMetadata {
  const author = getMetaContent(document, [
    "meta[name='author']",
    "meta[property='article:author']",
    "meta[name='byline']",
  ]);
  const published = getMetaContent(document, [
    "meta[property='article:published_time']",
    "meta[name='pubdate']",
    "meta[name='date']",
  ]);
  const updated = getMetaContent(document, [
    "meta[property='article:modified_time']",
    "meta[name='lastmod']",
    "meta[name='updated']",
  ]);

  const language = document.documentElement.lang?.trim() ?? "";
  const contentType =
    getMetaContent(document, [
      "meta[property='og:type']",
      "meta[name='medium']",
    ]) || (opts.articleDetected ? "article" : "");

  const keywords = extractListContent(
    document.querySelector("meta[name='keywords']")?.getAttribute("content") || ""
  );
  const tags = Array.from(
    document.querySelectorAll("meta[property='article:tag']"),
    (node) => node.getAttribute("content")?.trim()
  ).filter(Boolean) as string[];

  const primaryTopics = dedupe([...keywords, ...tags]);

  const entityCandidates = dedupe(
    [
      getMetaContent(document, ["meta[property='og:site_name']"]),
      getMetaContent(document, ["meta[name='publisher']", "meta[property='article:publisher']"]),
      author,
    ].filter(Boolean) as string[]
  );

  return {
    canonical: opts.canonical,
    author,
    published,
    updated,
    language,
    contentType,
    primaryTopics,
    entities: entityCandidates,
  };
}

function getMetaContent(document: Document, selectors: string[]): string | undefined {
  for (const selector of selectors) {
    const node = document.querySelector(selector);
    if (node) {
      const content = node.getAttribute("content") ?? node.getAttribute("value") ?? node.textContent;
      if (content && content.trim()) {
        return sanitizeLine(content);
      }
    }
  }
  return undefined;
}

function extractListContent(value: string): string[] {
  return value
    .split(/[,;]|\n/)
    .map((item) => sanitizeLine(item))
    .filter((item) => item.length > 0);
}

function dedupe(values: string[]): string[] {
  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const normalized = raw?.trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    ordered.push(normalized);
  }
  return ordered;
}

function sanitizeLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
