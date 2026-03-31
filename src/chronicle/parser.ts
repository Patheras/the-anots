import * as yaml from 'js-yaml';
import {
  ChronicleChapter,
  ChronicleMetadata,
  ChronicleContent,
  ChronicleMetadataSchema,
  ChronicleContentSchema,
  ChronicleChapterSchema,
} from './types';

/**
 * Parse error with descriptive message
 */
export class ChronicleParseError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'ChronicleParseError';
  }
}

/**
 * Parse Chronicle markdown file into structured object
 * 
 * Expected format:
 * ```
 * ---
 * date: 2026-03-22
 * chapterId: 2026-03-22-chapter-001
 * participants: [Chip, Ubik]
 * sessionType: general
 * startTime: 2026-03-22T10:00:00.000Z
 * endTime: 2026-03-22T11:00:00.000Z
 * ---
 * 
 * ## Summary
 * Discussion about memory system
 * 
 * ## Dialogue
 * **Chip:** Let's implement Chronicle
 * **Ubik:** Great idea!
 * 
 * ## Truths
 * - TypeScript is type-safe
 * - Chronicle is immutable
 * 
 * ## Insights
 * - Memory system needs 4 layers
 * ```
 */
export function parseChronicle(markdown: string): ChronicleChapter {
  try {
    // Extract YAML frontmatter
    const { metadata: rawMetadata, content: markdownContent } = extractFrontmatter(markdown);
    
    // Parse and validate metadata
    const metadata = parseMetadata(rawMetadata);
    
    // Parse markdown content sections
    const content = parseContent(markdownContent);
    
    // Validate complete chapter
    const chapter: ChronicleChapter = { metadata, content };
    return ChronicleChapterSchema.parse(chapter);
    
  } catch (error) {
    if (error instanceof ChronicleParseError) {
      throw error;
    }
    throw new ChronicleParseError(
      `Failed to parse Chronicle: ${error instanceof Error ? error.message : String(error)}`,
      error
    );
  }
}

/**
 * Extract YAML frontmatter from markdown
 */
function extractFrontmatter(markdown: string): { metadata: unknown; content: string } {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
  const match = markdown.match(frontmatterRegex);
  
  if (!match) {
    throw new ChronicleParseError(
      'Invalid Chronicle format: Missing YAML frontmatter. Expected format:\n---\nmetadata\n---\ncontent'
    );
  }
  
  const [, yamlContent, markdownContent] = match;
  
  try {
    // Parse YAML with schema: 'failsafe' to prevent automatic date conversion
    // This ensures dates remain as strings (YYYY-MM-DD format)
    const metadata = yaml.load(yamlContent, { schema: yaml.FAILSAFE_SCHEMA });
    return { metadata, content: markdownContent.trim() };
  } catch (error) {
    throw new ChronicleParseError(
      `Malformed YAML frontmatter: ${error instanceof Error ? error.message : String(error)}`,
      error
    );
  }
}

/**
 * Parse and validate metadata from YAML
 */
function parseMetadata(rawMetadata: unknown): ChronicleMetadata {
  try {
    return ChronicleMetadataSchema.parse(rawMetadata);
  } catch (error) {
    throw new ChronicleParseError(
      `Invalid metadata: ${error instanceof Error ? error.message : String(error)}`,
      error
    );
  }
}

/**
 * Parse markdown content sections
 */
function parseContent(markdown: string): ChronicleContent {
  const sections = extractSections(markdown);
  
  // Required sections
  const summary = sections.get('Summary');
  const dialogue = sections.get('Dialogue');
  
  if (!summary) {
    throw new ChronicleParseError('Missing required section: ## Summary');
  }
  
  if (!dialogue) {
    throw new ChronicleParseError('Missing required section: ## Dialogue');
  }
  
  // Optional sections (parse as lists)
  const truths = parseListSection(sections.get('Truths') || '');
  const insights = parseListSection(sections.get('Insights') || '');
  const toolsCreated = parseListSection(sections.get('Tools Created') || '');
  const decisions = parseListSection(sections.get('Decisions') || '');
  
  const content: ChronicleContent = {
    summary: summary.trim(),
    dialogue: dialogue.trim(),
    truths,
    insights,
    toolsCreated,
    decisions,
  };
  
  try {
    return ChronicleContentSchema.parse(content);
  } catch (error) {
    throw new ChronicleParseError(
      `Invalid content: ${error instanceof Error ? error.message : String(error)}`,
      error
    );
  }
}

/**
 * Extract sections from markdown (## Heading)
 */
function extractSections(markdown: string): Map<string, string> {
  const sections = new Map<string, string>();
  const lines = markdown.split('\n');
  
  let currentSection: string | null = null;
  let currentContent: string[] = [];
  
  for (const line of lines) {
    // Check if line is a heading (## Section Name)
    const headingMatch = line.match(/^##\s+(.+)$/);
    
    if (headingMatch) {
      // Save previous section
      if (currentSection) {
        sections.set(currentSection, currentContent.join('\n').trim());
      }
      
      // Start new section
      currentSection = headingMatch[1].trim();
      currentContent = [];
    } else if (currentSection) {
      // Add line to current section
      currentContent.push(line);
    }
  }
  
  // Save last section
  if (currentSection) {
    sections.set(currentSection, currentContent.join('\n').trim());
  }
  
  return sections;
}

/**
 * Parse markdown list into array of strings
 * Supports both "- item" and "* item" formats
 */
function parseListSection(markdown: string): string[] {
  if (!markdown.trim()) {
    return [];
  }
  
  const lines = markdown.split('\n');
  const items: string[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Match list items: "- item" or "* item"
    const match = trimmed.match(/^[-*]\s+(.+)$/);
    if (match) {
      items.push(match[1].trim());
    }
  }
  
  return items;
}

/**
 * Validate Chronicle file without full parsing
 * Useful for quick validation checks
 */
export function validateChronicle(markdown: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  try {
    parseChronicle(markdown);
    return { valid: true, errors: [] };
  } catch (error) {
    if (error instanceof ChronicleParseError) {
      errors.push(error.message);
    } else {
      errors.push(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
    }
    return { valid: false, errors };
  }
}
