/**
 * Structure Analyzer - Validates markdown structure for AI consumption
 * Analyzes content to ensure it's properly formatted for AI systems
 */

export type HeadingInfo = {
  level: number;
  text: string;
  line: number;
};

export type MDFSections = {
  hasTitle: boolean;
  hasUrl: boolean;
  hasContent: boolean;
  hasMetadata: boolean;
  hasFrontmatter: boolean;
};

export type ContentMetrics = {
  wordCount: number;
  paragraphCount: number;
  headingCount: number;
  listCount: number;
  codeBlockCount: number;
  linkCount: number;
};

export type ValidationWarning = {
  severity: "error" | "warning" | "info";
  message: string;
  section?: string;
};

export type HealthScore = {
  score: number; // 0-100
  grade: "Excellent" | "Good" | "Fair" | "Poor";
  color: string;
  description: string;
};

export type StructureAnalysis = {
  sections: MDFSections;
  metrics: ContentMetrics;
  headings: HeadingInfo[];
  warnings: ValidationWarning[];
  health: HealthScore;
  aiReadability: {
    score: number;
    issues: string[];
    strengths: string[];
  };
};

/**
 * Analyzes markdown structure and returns comprehensive analysis
 */
export function analyzeMarkdownStructure(markdown: string): StructureAnalysis {
  const sections = extractSections(markdown);
  const metrics = calculateMetrics(markdown);
  const headings = extractHeadings(markdown);
  const warnings = validateStructure(markdown, sections, metrics);
  const health = calculateHealthScore(sections, metrics, warnings);
  const aiReadability = analyzeAIReadability(markdown, sections, metrics);

  return {
    sections,
    metrics,
    headings,
    warnings,
    health,
    aiReadability,
  };
}

/**
 * Extract and identify MDF sections
 */
function extractSections(markdown: string): MDFSections {
  const lines = markdown.toLowerCase();

  return {
    hasFrontmatter: /^---[\s\S]*?---/.test(markdown),
    hasTitle: /^#\s+.+/m.test(markdown),
    hasUrl: /##\s*url/i.test(lines) || /source:\s*https?:\/\//i.test(lines),
    hasContent: /##\s*content/i.test(lines) || markdown.split('\n').filter(l => l.trim().length > 0).length > 5,
    hasMetadata: /##\s*metadata/i.test(lines) || /author:|published|updated|language:/i.test(lines),
  };
}

/**
 * Calculate content metrics
 */
function calculateMetrics(markdown: string): ContentMetrics {
  const words = markdown.match(/\b\w+\b/g) || [];
  const paragraphs = markdown.split(/\n\n+/).filter(p => {
    const trimmed = p.trim();
    return trimmed.length > 0 && !trimmed.startsWith('#') && !trimmed.startsWith('-');
  });

  const headings = markdown.match(/^#{1,6}\s+.+$/gm) || [];
  const lists = markdown.match(/^[\s]*[-*+]\s+.+$/gm) || [];
  const codeBlocks = markdown.match(/```[\s\S]*?```/g) || [];
  const links = markdown.match(/\[.+?\]\(.+?\)/g) || [];

  return {
    wordCount: words.length,
    paragraphCount: paragraphs.length,
    headingCount: headings.length,
    listCount: lists.length,
    codeBlockCount: codeBlocks.length,
    linkCount: links.length,
  };
}

/**
 * Extract heading hierarchy
 */
function extractHeadings(markdown: string): HeadingInfo[] {
  const headings: HeadingInfo[] = [];
  const lines = markdown.split('\n');

  lines.forEach((line, index) => {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      headings.push({
        level: match[1].length,
        text: match[2].trim(),
        line: index + 1,
      });
    }
  });

  return headings;
}

/**
 * Validate structure and generate warnings
 */
function validateStructure(
  markdown: string,
  sections: MDFSections,
  metrics: ContentMetrics
): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  // Critical sections
  if (!sections.hasTitle) {
    warnings.push({
      severity: "error",
      message: "Missing main title (H1 heading)",
      section: "Title",
    });
  }

  if (!sections.hasContent && metrics.paragraphCount < 3) {
    warnings.push({
      severity: "error",
      message: "Insufficient content - AI needs more context",
      section: "Content",
    });
  }

  // Recommended sections
  if (!sections.hasUrl && !sections.hasFrontmatter) {
    warnings.push({
      severity: "warning",
      message: "Missing source URL - AI can't verify origin",
      section: "URL",
    });
  }

  if (!sections.hasMetadata) {
    warnings.push({
      severity: "info",
      message: "Consider adding metadata (author, date, language) for better AI context",
      section: "Metadata",
    });
  }

  // Content quality
  if (metrics.wordCount < 50) {
    warnings.push({
      severity: "warning",
      message: "Low word count - may not provide enough information for AI",
      section: "Content",
    });
  }

  if (metrics.headingCount === 0) {
    warnings.push({
      severity: "warning",
      message: "No headings found - structure helps AI understand hierarchy",
      section: "Structure",
    });
  }

  // Check for very long paragraphs
  const paragraphs = markdown.split(/\n\n+/);
  const longParagraphs = paragraphs.filter(p => (p.match(/\b\w+\b/g) || []).length > 200);
  if (longParagraphs.length > 0) {
    warnings.push({
      severity: "info",
      message: "Some paragraphs are very long - consider breaking them up for better AI parsing",
      section: "Content",
    });
  }

  return warnings;
}

/**
 * Calculate overall health score
 */
function calculateHealthScore(
  sections: MDFSections,
  metrics: ContentMetrics,
  warnings: ValidationWarning[]
): HealthScore {
  let score = 0;

  // Section completeness (40 points)
  if (sections.hasTitle) score += 10;
  if (sections.hasFrontmatter) score += 10;
  if (sections.hasUrl) score += 10;
  if (sections.hasContent) score += 5;
  if (sections.hasMetadata) score += 5;

  // Content richness (40 points)
  if (metrics.wordCount > 100) score += 10;
  if (metrics.wordCount > 300) score += 5;
  if (metrics.headingCount > 0) score += 10;
  if (metrics.headingCount > 3) score += 5;
  if (metrics.paragraphCount > 2) score += 5;
  if (metrics.listCount > 0) score += 5;

  // Warning penalties (20 points)
  const errors = warnings.filter(w => w.severity === "error").length;
  const warningCount = warnings.filter(w => w.severity === "warning").length;
  score += Math.max(0, 20 - (errors * 10) - (warningCount * 3));

  // Determine grade
  let grade: HealthScore["grade"];
  let color: string;
  let description: string;

  if (score >= 85) {
    grade = "Excellent";
    color = "emerald";
    description = "Perfect for AI consumption - well-structured with rich content";
  } else if (score >= 70) {
    grade = "Good";
    color = "blue";
    description = "Good structure - AI can easily extract information";
  } else if (score >= 50) {
    grade = "Fair";
    color = "amber";
    description = "Acceptable but could be improved for better AI understanding";
  } else {
    grade = "Poor";
    color = "red";
    description = "Needs improvement - AI may struggle to extract meaningful information";
  }

  return { score, grade, color, description };
}

/**
 * Analyze AI readability specifically
 */
function analyzeAIReadability(
  markdown: string,
  sections: MDFSections,
  metrics: ContentMetrics
): { score: number; issues: string[]; strengths: string[] } {
  const issues: string[] = [];
  const strengths: string[] = [];
  let score = 100;

  // Check for good practices
  if (sections.hasFrontmatter) {
    strengths.push("Has frontmatter with structured metadata");
  } else {
    issues.push("Missing frontmatter - AI prefers structured metadata");
    score -= 10;
  }

  if (metrics.headingCount >= 3) {
    strengths.push("Good heading structure for hierarchical understanding");
  } else if (metrics.headingCount === 0) {
    issues.push("No headings - AI can't understand content hierarchy");
    score -= 15;
  }

  if (metrics.listCount > 0) {
    strengths.push("Contains lists for structured information");
  }

  if (metrics.wordCount >= 100) {
    strengths.push("Sufficient content length for context");
  } else {
    issues.push("Content too short - AI needs more context");
    score -= 10;
  }

  // Check for common AI parsing issues
  if (markdown.includes("```")) {
    strengths.push("Properly formatted code blocks");
  }

  if (markdown.match(/\[.+?\]\(.+?\)/g)) {
    strengths.push("Contains properly formatted links");
  }

  // Check for noise patterns
  if (/skip to content|accept cookies|gdpr|subscribe now/i.test(markdown)) {
    issues.push("Contains UI noise that should be removed");
    score -= 5;
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    issues,
    strengths,
  };
}
