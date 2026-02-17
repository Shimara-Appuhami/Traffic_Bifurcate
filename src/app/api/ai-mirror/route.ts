import { NextResponse } from "next/server";
import {
  ExtractionError,
  extractStructuredContent,
  type ExtractionResult,
} from "@/lib/extractor";
import { saveAIMirrorData, getAIMirrorByUrl } from "@/lib/mongodb";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => ({}));
    const inputUrl = typeof payload?.url === "string" ? payload.url.trim() : "";
    const sessionId = typeof payload?.sessionId === "string" ? payload.sessionId : undefined;

    if (!inputUrl) {
      return NextResponse.json(
        { error: "Provide a source URL to transform." },
        { status: 400 },
      );
    }

    // Check if we already have this URL cached
    const cached = await getAIMirrorByUrl(inputUrl);
    if (cached && !payload?.forceRefresh) {
      return NextResponse.json({
        ...cached,
        cached: true,
      });
    }

    const result = await extractStructuredContent(inputUrl);
    const canonical = result.canonical ?? result.url ?? inputUrl;
    const mirrorUrl = buildMirrorUrl(canonical);
    const sentences = splitSentences(stripMarkdown(result.markdown));
    const summary = buildSummary(sentences);
    const structured = buildStructuredContent(result.markdown, sentences);

    const responseBody = {
      type: "ai-mirror-page" as const,
      source_url: result.url ?? inputUrl,
      mirror_url: mirrorUrl,
      page_type: determinePageType(result),
      intent: determineIntent(result),
      language: result.metadata.language || "en",
      summary,
      key_topics: buildKeyTopics(result),
      entities: buildEntities(result),
      structured_content: structured,
      actions_available: [],
      last_updated: inferLastUpdated(result),
      canonical,
    };

    // Save AI mirror data to MongoDB
    try {
      await saveAIMirrorData({
        source_url: canonical,
        mirror_url: mirrorUrl,
        page_type: determinePageType(result),
        intent: determineIntent(result),
        language: result.metadata.language || "en",
        summary,
        key_topics: buildKeyTopics(result),
        entities: buildEntities(result),
        structured_content: structured,
        markdown: result.markdown,
        metadata: {
          author: result.metadata.author,
          published: result.metadata.published,
          updated: result.metadata.updated,
        },
        sessionId,
      });
    } catch (dbError) {
      console.error("Failed to save AI mirror data to MongoDB:", dbError);
      // Continue to return results even if DB save fails
    }

    return NextResponse.json(responseBody);
  } catch (error) {
    const message =
      error instanceof ExtractionError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Unable to generate AI mirror JSON.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

function buildMirrorUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./i, "");
    return `https://ai.${host}${parsed.pathname}${parsed.search}`;
  } catch {
    return "";
  }
}

function stripMarkdown(source: string): string {
  return source
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
    .replace(/[*_~#>-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function buildSummary(sentences: string[]): string {
  if (!sentences.length) {
    return "";
  }
  return sentences.slice(0, 4).join(" ");
}

function buildStructuredContent(
  markdown: string,
  fallbackSentences: string[],
): Array<{ section: string; facts: string[] }> {
  const sections = markdown.split(/\n(?=##\s)/);
  const structured = sections
    .map((block, index) => {
      const trimmed = block.trim();
      if (!trimmed) {
        return undefined;
      }
      const lines = trimmed.split(/\n+/);
      let title = lines[0].replace(/^#+\s*/, "").trim();
      if (!title) {
        title = index === 0 ? "Overview" : "Section";
      }
      const body = stripMarkdown(lines.slice(1).join(" "));
      const facts = splitSentences(body).slice(0, 5);
      if (!facts.length) {
        return undefined;
      }
      return { section: title, facts };
    })
    .filter((entry): entry is { section: string; facts: string[] } => Boolean(entry));

  if (structured.length) {
    return structured;
  }

  const fallbackFacts = fallbackSentences.slice(0, 5);
  return fallbackFacts.length
    ? [{ section: "Overview", facts: fallbackFacts }]
    : [{ section: "Overview", facts: [] }];
}

function buildKeyTopics(result: ExtractionResult): string[] {
  if (result.metadata.primaryTopics.length) {
    return result.metadata.primaryTopics.slice(0, 10);
  }
  const headings = result.markdown
    .split(/\n/)
    .filter((line) => line.startsWith("##"))
    .map((line) => line.replace(/^#+\s*/, "").trim())
    .filter(Boolean);
  return headings.slice(0, 10);
}

function buildEntities(result: ExtractionResult) {
  return {
    people: result.metadata.author ? [result.metadata.author] : [],
    organizations: [],
    technologies: [],
    locations: [],
  };
}

function determinePageType(result: ExtractionResult) {
  switch (result.metadata.contentType) {
    case "homepage":
      return "home";
    case "product":
      return "product";
    case "docs":
      return "documentation";
    case "article":
      return "blog";
    case "category":
      return "service";
    default:
      return "other";
  }
}

function determineIntent(result: ExtractionResult) {
  switch (result.metadata.contentType) {
    case "product":
      return "transactional";
    case "homepage":
      return "navigational";
    default:
      return "informational";
  }
}

function inferLastUpdated(result: ExtractionResult): string {
  const candidate = result.metadata.updated || result.metadata.published;
  if (candidate) {
    return new Date(candidate).toISOString();
  }
  return new Date().toISOString();
}
