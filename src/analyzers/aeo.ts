import type { CrawlResult, Finding, AnalyzerResult } from '../types.js';
import { parseHTML } from '../utils/crawler.js';
import { calculateCategoryScore, getScoreSummary } from '../utils/scoring.js';

/**
 * AEO (Answer Engine Optimization) / AI Readiness Analyzer
 *
 * Checks how well the page content is structured for:
 * - AI assistants (ChatGPT, Perplexity, Google AI Overview)
 * - Featured snippets
 * - Voice search
 * - Knowledge panels
 *
 * This is the "future-proofing" analyzer — AEO is becoming
 * as important as traditional SEO as AI-driven search grows.
 */
export function analyzeAEO(crawl: CrawlResult): AnalyzerResult {
  const findings: Finding[] = [];
  const $ = parseHTML(crawl.html);

  checkContentStructure($, findings);
  checkAnswerPatterns($, findings);
  checkFAQPresence($, findings);
  checkDefinitions($, findings);
  checkListsAndTables($, findings);
  checkEntityClarity($, crawl, findings);
  checkContentFreshness($, findings);
  checkSemanticHTML($, findings);
  checkAIMetadata($, findings);

  const score = calculateCategoryScore(findings);

  return {
    category: 'aeo',
    categoryLabel: 'AEO & AI Readiness',
    score,
    maxScore: 100,
    findings,
    summary: getScoreSummary('AEO / AI Readiness', score),
  };
}

function checkContentStructure($: ReturnType<typeof parseHTML>, findings: Finding[]) {
  const h2s = $('h2');
  const h3s = $('h3');
  const totalSubheadings = h2s.length + h3s.length;

  // Remove script/style for content analysis
  const $clone = parseHTML($.html());
  $clone('script, style, nav, footer, header').remove();
  const bodyText = $clone('body').text().trim();
  const wordCount = bodyText.split(/\s+/).filter(w => w.length > 0).length;

  // AI models need well-structured content to extract answers
  if (wordCount > 200 && totalSubheadings === 0) {
    findings.push({
      id: 'aeo-no-structure',
      title: 'Content Lacks Structure for AI Extraction',
      description: 'The page has substantial content but no subheadings to organize it. AI systems rely on clear content structure to extract and cite information.',
      severity: 'high',
      category: 'aeo',
      subcategory: 'Content Structure',
      currentValue: `${wordCount} words with 0 subheadings`,
      recommendedValue: 'Subheadings every 150-300 words',
      howToFix: 'Break content into clear sections with descriptive H2/H3 headings. Each section should answer a specific question or cover a distinct subtopic. Think of each heading as a potential question an AI might need to answer.',
      impact: 'AI assistants and Google\'s AI Overview extract answers from well-structured content. Unstructured content is harder to parse and less likely to be cited.',
      effort: 'medium',
    });
  }

  // Check if headings are descriptive (question-like or topic-specific)
  const descriptiveHeadings: string[] = [];
  const vagueHeadings: string[] = [];

  $('h2, h3').each((_, el) => {
    const text = $(el).text().trim();
    if (text.length < 3) return;

    // Vague headings that don't help AI understand content
    const vaguePatterns = /^(overview|details|more|info|section|part|other|misc)/i;
    if (vaguePatterns.test(text) || text.length < 5) {
      vagueHeadings.push(text);
    } else {
      descriptiveHeadings.push(text);
    }
  });

  if (vagueHeadings.length > 2 && vagueHeadings.length > descriptiveHeadings.length) {
    findings.push({
      id: 'aeo-vague-headings',
      title: 'Headings Are Too Vague for AI Parsing',
      description: `${vagueHeadings.length} headings use generic terms like "${vagueHeadings[0]}". AI systems need specific, descriptive headings to understand content sections.`,
      severity: 'medium',
      category: 'aeo',
      subcategory: 'Content Structure',
      currentValue: `Vague headings: ${vagueHeadings.slice(0, 3).join(', ')}`,
      recommendedValue: 'Specific, question-like or topic-focused headings',
      howToFix: 'Replace vague headings with specific, descriptive ones. Use question format where appropriate (e.g., "What Is X?" instead of "Overview"). This helps AI systems match user queries to your content.',
      impact: 'AI systems use headings as key signals for understanding content structure. Specific headings are more likely to match user queries.',
      effort: 'low',
    });
  }
}

function checkAnswerPatterns($: ReturnType<typeof parseHTML>, findings: Finding[]) {
  // Check if content follows a question-answer pattern
  // AI systems love clear, concise answers immediately following questions

  const $clone = parseHTML($.html());
  $clone('script, style, nav, footer, header').remove();
  const bodyText = $clone('body').text();

  // Look for "answer-ready" content patterns
  // These are paragraph openings that directly answer questions
  const answerPatterns = [
    /\b(is|are|was|were)\s+(?:a|an|the)\s+\w+/gi,  // "X is a..."
    /\b(refers to|means|defined as|involves)\b/gi,     // "X refers to..."
    /\bthe\s+(?:main|primary|key|best|most)\b/gi,      // "The main..."
    /\b(there are|there is)\s+\w+\s+(?:types|ways|methods|steps)/gi, // "There are X ways..."
  ];

  let answerPatternCount = 0;
  for (const pattern of answerPatterns) {
    const matches = bodyText.match(pattern);
    if (matches) answerPatternCount += matches.length;
  }

  const wordCount = bodyText.split(/\s+/).filter(w => w.length > 0).length;

  if (wordCount > 300 && answerPatternCount < 2) {
    findings.push({
      id: 'aeo-no-direct-answers',
      title: 'Content Lacks Direct Answer Patterns',
      description: 'The content doesn\'t contain clear, direct answers to questions. AI systems prefer content that directly states facts and definitions.',
      severity: 'medium',
      category: 'aeo',
      subcategory: 'Answer Optimization',
      recommendedValue: 'Clear, concise answer statements within the first 1-2 sentences of each section',
      howToFix: 'Structure content sections to lead with a clear, concise answer in the first 1-2 sentences, then expand with details. Follow the "inverted pyramid" style used in journalism. Example:\n\n"What is SEO? SEO (Search Engine Optimization) is the practice of improving a website\'s visibility in search engine results. It involves optimizing content, technical elements, and building authority..."',
      impact: 'AI assistants and featured snippets favor content that provides clear, direct answers. The first 40-50 words after a heading are critical for AI extraction.',
      effort: 'medium',
    });
  }
}

function checkFAQPresence($: ReturnType<typeof parseHTML>, findings: Finding[]) {
  // Check for question patterns in headings (great for AEO)
  const headings = $('h2, h3, h4');
  let questionHeadings = 0;
  const questions: string[] = [];

  headings.each((_, el) => {
    const text = $(el).text().trim();
    if (text.endsWith('?') || /^(what|how|why|when|where|who|which|can|do|does|is|are|should|will)\s/i.test(text)) {
      questionHeadings++;
      questions.push(text);
    }
  });

  if (questionHeadings === 0) {
    findings.push({
      id: 'aeo-no-question-headings',
      title: 'No Question-Format Headings',
      description: 'None of the headings are phrased as questions. Question-based headings are optimal for AI answer extraction and featured snippets.',
      severity: 'medium',
      category: 'aeo',
      subcategory: 'FAQ Optimization',
      recommendedValue: 'At least 2-3 question-format headings',
      howToFix: 'Rephrase some headings as questions that your target audience actually asks. Use "People Also Ask" from Google search results for inspiration. Examples:\n• "What Is [Topic]?"\n• "How Does [Topic] Work?"\n• "Why Is [Topic] Important?"\n• "How Much Does [Topic] Cost?"',
      impact: 'Question-format headings directly match how people ask AI assistants and search engines. They are the #1 source for featured snippets and AI Overview citations.',
      effort: 'low',
    });
  }
}

function checkDefinitions($: ReturnType<typeof parseHTML>, findings: Finding[]) {
  const $clone = parseHTML($.html());
  $clone('script, style, nav, footer').remove();
  const bodyText = $clone('body').text();

  // Check for definition-style patterns that AI can extract
  const hasDefinitions = /\b(?:is defined as|refers to|is the process of|means that|is a type of)\b/i.test(bodyText);
  const hasGlossary = $('dl, .glossary, [class*="glossary"], [class*="definition"]').length > 0;

  // Check for semantic HTML definitions
  const hasAbbrOrDfn = $('abbr, dfn').length > 0;

  const wordCount = bodyText.split(/\s+/).length;

  if (wordCount > 500 && !hasDefinitions && !hasGlossary && !hasAbbrOrDfn) {
    findings.push({
      id: 'aeo-no-definitions',
      title: 'No Clear Definitions Found',
      description: 'The page content doesn\'t include explicit definitions of key terms. AI systems frequently extract and cite clear definitions.',
      severity: 'low',
      category: 'aeo',
      subcategory: 'Answer Optimization',
      recommendedValue: 'Clear definitions of key terms and concepts',
      howToFix: 'Include explicit definitions of key terms in your content. Use patterns like "[Term] is [definition]" or "[Term] refers to [explanation]". Consider adding a glossary section for technical content.',
      impact: 'Clear definitions are frequently extracted for featured snippets, knowledge panels, and AI assistant responses. They also help establish topical authority.',
      effort: 'low',
    });
  }
}

function checkListsAndTables($: ReturnType<typeof parseHTML>, findings: Finding[]) {
  const orderedLists = $('ol').length;
  const unorderedLists = $('ul').not('nav ul').length;
  const tables = $('table').length;
  const totalStructured = orderedLists + unorderedLists + tables;

  const $clone = parseHTML($.html());
  $clone('script, style, nav, footer').remove();
  const wordCount = $clone('body').text().split(/\s+/).length;

  if (wordCount > 500 && totalStructured === 0) {
    findings.push({
      id: 'aeo-no-lists-tables',
      title: 'No Lists or Tables in Content',
      description: 'The page has substantial content but no lists or tables. Structured content formats are preferred by AI systems and featured snippets.',
      severity: 'low',
      category: 'aeo',
      subcategory: 'Content Format',
      recommendedValue: 'Use lists for steps/features, tables for comparisons',
      howToFix: 'Add structured elements where appropriate:\n• Ordered lists for step-by-step processes\n• Unordered lists for features, benefits, or options\n• Tables for comparisons, pricing, or specifications\n\nThese formats are commonly extracted for featured snippets.',
      impact: 'Lists and tables are the most commonly extracted formats for featured snippets. They also improve readability and help AI systems understand structured information.',
      effort: 'low',
    });
  }

  // Check if lists have enough items
  $('ol, ul').not('nav ul').each((_, list) => {
    const items = $(list).children('li');
    if (items.length === 1) {
      // A list with one item is not useful
      findings.push({
        id: 'aeo-single-item-list',
        title: 'Single-Item List Detected',
        description: 'A list with only one item was found. This doesn\'t provide the structured format that AI systems and featured snippets prefer.',
        severity: 'info',
        category: 'aeo',
        subcategory: 'Content Format',
        howToFix: 'Either expand the list with more items or convert the single item to a regular paragraph.',
        impact: 'Minor formatting issue that can affect how AI systems perceive content structure.',
        effort: 'low',
      });
    }
  });
}

function checkEntityClarity(
  $: ReturnType<typeof parseHTML>,
  crawl: CrawlResult,
  findings: Finding[]
) {
  // Check if the page clearly establishes what entity/topic it's about
  const title = $('title').text().trim();
  const h1 = $('h1').first().text().trim();
  const metaDesc = $('meta[name="description"]').attr('content')?.trim() || '';

  // Check topical consistency between title, H1, and meta description
  if (title && h1) {
    // Extract significant words (more than 3 chars, not common words)
    const commonWords = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'with', 'your', 'that', 'this', 'have', 'from', 'they', 'been', 'said', 'each', 'which', 'their', 'will', 'other', 'about', 'many', 'then', 'them', 'these', 'some', 'would', 'make', 'like', 'into', 'time', 'very', 'when', 'come', 'could', 'more', 'most', 'also', 'what', 'how']);

    const titleWords = new Set(
      title.toLowerCase().split(/\s+/).filter(w => w.length > 3 && !commonWords.has(w))
    );
    const h1Words = new Set(
      h1.toLowerCase().split(/\s+/).filter(w => w.length > 3 && !commonWords.has(w))
    );

    // Check overlap
    let overlap = 0;
    for (const word of titleWords) {
      if (h1Words.has(word)) overlap++;
    }

    const maxPossible = Math.min(titleWords.size, h1Words.size);
    if (maxPossible > 0 && overlap / maxPossible < 0.3) {
      findings.push({
        id: 'aeo-entity-mismatch',
        title: 'Title and H1 Have Low Topical Overlap',
        description: `The title "${title}" and H1 "${h1}" don't share key terms. This can confuse AI systems about the page's primary topic.`,
        severity: 'medium',
        category: 'aeo',
        subcategory: 'Entity Clarity',
        currentValue: `Title: "${title}" | H1: "${h1}"`,
        recommendedValue: 'Title and H1 should share primary topic keywords',
        howToFix: 'Align the title tag and H1 heading to focus on the same primary topic. They don\'t need to be identical, but should clearly relate to the same subject. This helps AI systems confidently identify the page\'s topic.',
        impact: 'When the title and H1 are misaligned, AI systems may be uncertain about the page\'s primary topic, reducing the chance of being cited in AI responses.',
        effort: 'low',
      });
    }
  }
}

function checkContentFreshness($: ReturnType<typeof parseHTML>, findings: Finding[]) {
  // Check for date indicators
  const hasPublishDate = $('time, [class*="date"], [class*="published"], meta[property="article:published_time"]').length > 0;
  const hasModifiedDate = $('meta[property="article:modified_time"], [class*="updated"], [class*="modified"]').length > 0;

  if (!hasPublishDate && !hasModifiedDate) {
    findings.push({
      id: 'aeo-no-dates',
      title: 'No Content Date Information',
      description: 'The page doesn\'t display or include publish/update dates. AI systems and search engines use dates to assess content freshness.',
      severity: 'low',
      category: 'aeo',
      subcategory: 'Content Freshness',
      recommendedValue: 'Visible publish date and last-updated date',
      howToFix: 'Add visible publish and last-updated dates to content pages. Use <time datetime="YYYY-MM-DD"> for semantic markup. Also add article:published_time and article:modified_time Open Graph tags.',
      impact: 'Content freshness signals help AI systems and search engines determine if content is current and relevant. Dated content is more likely to be cited by AI assistants.',
      effort: 'low',
    });
  }
}

function checkSemanticHTML($: ReturnType<typeof parseHTML>, findings: Finding[]) {
  const semanticElements = {
    article: $('article').length,
    section: $('section').length,
    aside: $('aside').length,
    main: $('main').length,
    nav: $('nav').length,
  };

  const totalSemantic = Object.values(semanticElements).reduce((a, b) => a + b, 0);

  if (totalSemantic === 0) {
    findings.push({
      id: 'aeo-no-semantic-html',
      title: 'No Semantic HTML Elements',
      description: 'The page doesn\'t use semantic HTML5 elements (article, section, main, etc.). These help AI systems understand content structure and importance.',
      severity: 'medium',
      category: 'aeo',
      subcategory: 'Semantic Markup',
      currentValue: 'No semantic HTML elements detected',
      recommendedValue: 'article, section, main, nav elements for content structure',
      howToFix: 'Restructure the HTML using semantic elements:\n• <main> for the primary content area\n• <article> for self-contained content pieces\n• <section> for thematic groupings\n• <aside> for supplementary content\n• <nav> for navigation blocks\n\nThese elements help AI parsers distinguish main content from navigation, ads, and boilerplate.',
      impact: 'Semantic HTML helps AI systems and search engines identify the most important content on the page. Pages with clear semantic structure are easier to parse and more likely to be cited.',
      effort: 'medium',
    });
  }

  if (semanticElements.main === 0 && semanticElements.article === 0) {
    findings.push({
      id: 'aeo-no-main-content-marker',
      title: 'No Main Content Area Identified',
      description: 'The page doesn\'t use <main> or <article> tags to identify the primary content. AI systems may struggle to separate main content from boilerplate.',
      severity: 'low',
      category: 'aeo',
      subcategory: 'Semantic Markup',
      recommendedValue: '<main> wrapper around primary content',
      howToFix: 'Wrap the primary content area in a <main> tag. This is the single most important semantic element for AI content extraction.',
      impact: 'Without a clear content marker, AI systems use heuristics to guess the main content, which can lead to boilerplate text being included in AI-generated answers.',
      effort: 'low',
    });
  }
}

function checkAIMetadata($: ReturnType<typeof parseHTML>, findings: Finding[]) {
  // Check for author information (E-E-A-T signals)
  const hasAuthor = $('meta[name="author"], [class*="author"], [rel="author"], [itemprop="author"]').length > 0;
  const hasArticleAuthor = $('meta[property="article:author"]').length > 0;

  if (!hasAuthor && !hasArticleAuthor) {
    findings.push({
      id: 'aeo-no-author',
      title: 'No Author Information',
      description: 'No author attribution found on the page. Author information is a key E-E-A-T signal that AI systems use to evaluate content credibility.',
      severity: 'low',
      category: 'aeo',
      subcategory: 'E-E-A-T Signals',
      recommendedValue: 'Author name, bio, and credentials',
      howToFix: 'Add author information to content pages. Include:\n• Author name (visible on page)\n• Author bio with credentials/expertise\n• Link to author profile page\n• article:author meta tag\n\nFor businesses, include an "About" section establishing expertise.',
      impact: 'E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) is increasingly important for both traditional SEO and AI citation. Content with clear authorship is more trustworthy.',
      effort: 'low',
    });
  }

  // Check for speakable content (voice search)
  const hasSpeakable = $('script[type="application/ld+json"]').text().includes('"speakable"');
  if (!hasSpeakable) {
    findings.push({
      id: 'aeo-no-speakable',
      title: 'No Speakable Schema Markup',
      description: 'The page doesn\'t include speakable schema markup. This tells AI and voice assistants which content sections are suitable for text-to-speech.',
      severity: 'info',
      category: 'aeo',
      subcategory: 'Voice Search',
      recommendedValue: 'Speakable schema on key content sections',
      howToFix: 'Add speakable schema markup to indicate which content sections are best suited for voice assistant reading. This is especially important for news and informational content.',
      impact: 'Speakable markup helps voice assistants (Google Assistant, Alexa) know which parts of your content to read aloud. Early adoption provides a competitive advantage.',
      effort: 'low',
    });
  }
}
