import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({}));
  const inputUrl = typeof payload?.url === "string" ? payload.url.trim() : "";

  if (!inputUrl) {
    return NextResponse.json(
      { error: "Provide a valid URL in the request body." },
      { status: 400 }
    );
  }

  try {
    const result = await extractStructuredContent(inputUrl);
    const mdf = formatAsMdf(result);

    return new Response(mdf, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const status = error instanceof ExtractionError ? error.status : 502;
    const message =
      error instanceof Error ? error.message : "Unexpected extraction failure.";
    return NextResponse.json({ error: message }, { status });
  }
}

// Explicitly handle GET and other unsupported methods
export function GET() {
  return new Response("Method Not Allowed", { status: 405 });
}
import { JSDOM } from "jsdom";
import TurndownService from "turndown";

/* ---------------------------- Errors ---------------------------- */

export class ExtractionError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

/* ---------------------------- Types ---------------------------- */

export type StructuredContent = {
  url: string;
  title?: string;
  description?: string;
  headings: { level: number; text: string }[];
  paragraphs: string[];
  lists: string[][];
  codeBlocks: { language?: string; code: string }[];
  links: { text: string; href: string }[];
  lastModified?: string;
};

/* ---------------------- Extraction Logic ----------------------- */

export async function extractStructuredContent(
  url: string
): Promise<StructuredContent> {
  let response: Response;

  try {
    response = await fetch(url, { redirect: "follow" });
  } catch {
    throw new ExtractionError("Unable to fetch URL.", 502);
  }

  if (!response.ok) {
    throw new ExtractionError(`Upstream error: ${response.status}`, 502);
  }

  const html = await response.text();
  const dom = new JSDOM(html);
  const document = dom.window.document;

  /* Remove UI noise */
  document
    .querySelectorAll(
      "script, style, nav, footer, header, aside, iframe, noscript"
    )
    .forEach((el) => el.remove());

  const content: StructuredContent = {
    url,
    title: document.querySelector("title")?.textContent?.trim(),
    description: document
      .querySelector('meta[name="description"]')
      ?.getAttribute("content")?.trim(),
    headings: [],
    paragraphs: [],
    lists: [],
    codeBlocks: [],
    links: [],
    lastModified: response.headers.get("last-modified") ?? undefined,
  };

  /* Headings */
  document.querySelectorAll("h1,h2,h3,h4,h5,h6").forEach((h) => {
    content.headings.push({
      level: Number(h.tagName[1]),
      text: h.textContent?.trim() || "",
    });
  });

  /* Paragraphs */
  document.querySelectorAll("p").forEach((p) => {
    const text = p.textContent?.trim();
    if (text) content.paragraphs.push(text);
  });

  /* Lists */
  document.querySelectorAll("ul,ol").forEach((list) => {
    const items = Array.from(list.querySelectorAll("li"))
      .map((li) => li.textContent?.trim() || "")
      .filter(Boolean);
    if (items.length) content.lists.push(items);
  });

  /* Code blocks */
  document.querySelectorAll("pre code").forEach((code) => {
    content.codeBlocks.push({
      language: code.className.replace("language-", "") || undefined,
      code: code.textContent || "",
    });
  });

  /* Links */
  document.querySelectorAll("a[href]").forEach((a) => {
    const text = a.textContent?.trim();
    const href = a.getAttribute("href");
    if (text && href) {
      content.links.push({ text, href });
    }
  });

  return content;
}

/* ---------------------- Markdown Formatter ---------------------- */

export function formatAsMdf(content: StructuredContent): string {
  const md: string[] = [];

  /* Front matter */
  md.push("---");
  if (content.title) md.push(`title: "${escape(content.title)}"`);
  if (content.lastModified) md.push(`lastmod: ${content.lastModified}`);
  md.push(`source: ${content.url}`);
  md.push("---\n");

  /* Title */
  if (content.title) {
    md.push(`# ${content.title}\n`);
  }

  /* Description */
  if (content.description) {
    md.push(content.description + "\n");
  }

  /* Headings */
  content.headings.forEach((h) => {
    md.push(`${"#".repeat(h.level)} ${h.text}`);
  });

  /* Paragraphs */
  content.paragraphs.forEach((p) => {
    md.push(`\n${p}`);
  });

  /* Lists */
  content.lists.forEach((list) => {
    md.push("");
    list.forEach((item) => md.push(`- ${item}`));
  });

  /* Code blocks */
  content.codeBlocks.forEach((block) => {
    md.push(
      `\n\`\`\`${block.language || ""}\n${block.code.trim()}\n\`\`\``
    );
  });

  /* Links */
  if (content.links.length) {
    md.push("\n## Links");
    content.links.forEach((l) => {
      md.push(`- [${l.text}](${l.href})`);
    });
  }

  return md.join("\n").trim();
}

function escape(text: string) {
  return text.replace(/"/g, '\\"');
}
