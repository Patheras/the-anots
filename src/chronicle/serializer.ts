import * as yaml from 'js-yaml';
import { ChronicleChapter, ChronicleMetadata, ChronicleContent } from './types';

/**
 * Serialize Chronicle chapter to markdown format
 * 
 * Output format:
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
 * ```
 */
export function serializeChronicle(chapter: ChronicleChapter): string {
  const frontmatter = serializeMetadata(chapter.metadata);
  const content = serializeContent(chapter.content);
  
  return `${frontmatter}\n\n${content}`;
}

/**
 * Serialize metadata to YAML frontmatter
 */
function serializeMetadata(metadata: ChronicleMetadata): string {
  // Convert metadata to plain object for YAML serialization
  const yamlObject: Record<string, unknown> = {
    date: metadata.date,
    chapterId: metadata.chapterId,
    participants: metadata.participants,
    sessionType: metadata.sessionType,
    startTime: metadata.startTime,
    endTime: metadata.endTime,
  };
  
  // Add optional fields if present
  if (metadata.tags && metadata.tags.length > 0) {
    yamlObject.tags = metadata.tags;
  }
  
  if (metadata.summary) {
    yamlObject.summary = metadata.summary;
  }
  
  if (metadata.messageCount !== undefined) {
    yamlObject.messageCount = metadata.messageCount;
  }
  
  // Serialize to YAML with proper formatting
  const yamlContent = yaml.dump(yamlObject, {
    indent: 2,
    lineWidth: -1, // No line wrapping
    noRefs: true, // No references
    sortKeys: false, // Preserve order
  });
  
  return `---\n${yamlContent}---`;
}

/**
 * Serialize content to markdown sections
 */
function serializeContent(content: ChronicleContent): string {
  const sections: string[] = [];
  
  // Required sections
  sections.push(`## Summary\n\n${content.summary}`);
  sections.push(`## Dialogue\n\n${content.dialogue}`);
  
  // Optional sections (only include if non-empty)
  if (content.truths.length > 0) {
    sections.push(`## Truths\n\n${serializeList(content.truths)}`);
  }
  
  if (content.insights.length > 0) {
    sections.push(`## Insights\n\n${serializeList(content.insights)}`);
  }
  
  if (content.toolsCreated.length > 0) {
    sections.push(`## Tools Created\n\n${serializeList(content.toolsCreated)}`);
  }
  
  if (content.decisions.length > 0) {
    sections.push(`## Decisions\n\n${serializeList(content.decisions)}`);
  }
  
  return sections.join('\n\n');
}

/**
 * Serialize array to markdown list
 */
function serializeList(items: string[]): string {
  return items.map(item => `- ${item}`).join('\n');
}

/**
 * Serialize Chronicle chapter to markdown with custom formatting options
 */
export function serializeChronicleWithOptions(
  chapter: ChronicleChapter,
  options?: {
    indentSize?: number;
    listMarker?: '-' | '*';
    includeEmptySections?: boolean;
  }
): string {
  const indentSize = options?.indentSize ?? 2;
  const listMarker = options?.listMarker ?? '-';
  const includeEmptySections = options?.includeEmptySections ?? false;
  
  // Serialize metadata
  const yamlObject: Record<string, unknown> = {
    date: chapter.metadata.date,
    chapterId: chapter.metadata.chapterId,
    participants: chapter.metadata.participants,
    sessionType: chapter.metadata.sessionType,
    startTime: chapter.metadata.startTime,
    endTime: chapter.metadata.endTime,
  };
  
  if (chapter.metadata.tags && chapter.metadata.tags.length > 0) {
    yamlObject.tags = chapter.metadata.tags;
  }
  
  if (chapter.metadata.summary) {
    yamlObject.summary = chapter.metadata.summary;
  }
  
  if (chapter.metadata.messageCount !== undefined) {
    yamlObject.messageCount = chapter.metadata.messageCount;
  }
  
  const yamlContent = yaml.dump(yamlObject, {
    indent: indentSize,
    lineWidth: -1,
    noRefs: true,
    sortKeys: false,
  });
  
  const frontmatter = `---\n${yamlContent}---`;
  
  // Serialize content
  const sections: string[] = [];
  
  sections.push(`## Summary\n\n${chapter.content.summary}`);
  sections.push(`## Dialogue\n\n${chapter.content.dialogue}`);
  
  const addSection = (title: string, items: string[]) => {
    if (items.length > 0 || includeEmptySections) {
      const list = items.length > 0
        ? items.map(item => `${listMarker} ${item}`).join('\n')
        : '';
      sections.push(`## ${title}\n\n${list}`);
    }
  };
  
  addSection('Truths', chapter.content.truths);
  addSection('Insights', chapter.content.insights);
  addSection('Tools Created', chapter.content.toolsCreated);
  addSection('Decisions', chapter.content.decisions);
  
  const content = sections.join('\n\n');
  
  return `${frontmatter}\n\n${content}`;
}
