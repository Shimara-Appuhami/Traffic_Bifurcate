import { marked } from "marked";
import {
  ExtractionError,
  extractStructuredContent,
  type ExtractionResult,
} from "@/lib/extractor";

marked.setOptions({
  gfm: true,
  breaks: false,
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SearchParams = {
  source?: string;
};

type Params = {
  searchParams?: SearchParams;
};

export default async function AiMirror({ searchParams }: Params) {
  const source = searchParams?.source?.trim() ?? "";

  if (!source) {
    return (
      <Shell heading="AI Mirror">
        <p>
          Append <code>?source=https://domain.com/path</code> to this endpoint
          to render the AI mirror.
        </p>
      </Shell>
    );
  }
  let result: ExtractionResult | null = null;
  let failureMessage = "Unable to render AI mirror.";

  try {
    result = await extractStructuredContent(source);
  } catch (error) {
    if (error instanceof ExtractionError) {
      failureMessage = error.message;
    }
  }

  if (!result) {
    return (
      <Shell heading="AI Mirror Error">
        <p>{failureMessage}</p>
      </Shell>
    );
  }

  const html = marked.parse(result.markdown) as string;
  const jsonLd = buildJsonLd(result);

  return (
    <Shell
      heading={result.title}
      canonical={result.canonical}
      original={result.url}
    >
      <section aria-labelledby="md-heading">
        <h2 id="md-heading">Markdown Payload</h2>
        <pre data-format="md">{result.markdown}</pre>
      </section>

      <section aria-labelledby="html-heading">
        <h2 id="html-heading">Rendered HTML</h2>
        <article
          className="ai-article"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </section>

      <section aria-labelledby="meta-heading">
        <h2 id="meta-heading">Metadata</h2>
        <dl>
          <MetaRow label="Author" value={result.metadata.author} />
          <MetaRow label="Published" value={result.metadata.published} />
          <MetaRow label="Updated" value={result.metadata.updated} />
          <MetaRow label="Language" value={result.metadata.language} />
          <MetaRow label="Content Type" value={result.metadata.contentType} />
          <MetaRow
            label="Primary Topics"
            value={result.metadata.primaryTopics.join(", ") || undefined}
          />
          <MetaRow
            label="Entities"
            value={result.metadata.entities.join(", ") || undefined}
          />
        </dl>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd }}
      />
    </Shell>
  );
}

function Shell({
  heading,
  canonical,
  original,
  children,
}: {
  heading: string;
  canonical?: string;
  original?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-8 px-6 py-12 text-base text-slate-100">
      <header>
        <p className="text-xs uppercase tracking-[0.4em] text-lime-300">
          AI Mirror
        </p>
        <h1 className="text-3xl font-semibold text-white">{heading}</h1>
        <div className="mt-4 space-y-1 text-sm text-slate-300">
          {original && (
            <p>
              Original URL: <span className="text-slate-100">{original}</span>
            </p>
          )}
          {canonical && (
            <p>
              Canonical URL: <span className="text-slate-100">{canonical}</span>
            </p>
          )}
        </div>
      </header>
      {children}
    </main>
  );
}

function MetaRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="border-b border-white/10 py-2">
      <dt className="text-xs uppercase tracking-widest text-slate-400">
        {label}
      </dt>
      <dd className="text-sm text-slate-100">{value ?? ""}</dd>
    </div>
  );
}

function buildJsonLd(result: ExtractionResult): string {
  const base: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": result.metadata.contentType === "product" ? "Product" : "Article",
    headline: result.title,
    mainEntityOfPage: result.canonical,
    url: result.canonical,
    inLanguage: result.metadata.language || "en",
    datePublished: result.metadata.published,
    dateModified: result.metadata.updated || result.metadata.published,
    articleBody: result.markdown,
  };

  if (result.metadata.author) {
    base.author = { "@type": "Person", name: result.metadata.author };
  }

  if (result.metadata.primaryTopics.length) {
    base.articleSection = result.metadata.primaryTopics;
    base.keywords = result.metadata.primaryTopics.join(", ");
  }

  if (result.metadata.entities.length) {
    base.publisher = {
      "@type": "Organization",
      name: result.metadata.entities[0],
    };
  }

  return JSON.stringify(stripEmpty(base));
}

function stripEmpty(source: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(source).filter(([, value]) =>
      Array.isArray(value) ? value.length > 0 : Boolean(value),
    ),
  );
}
