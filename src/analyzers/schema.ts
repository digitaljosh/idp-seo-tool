import type { CrawlResult, Finding, AnalyzerResult } from '../types.js';
import { parseHTML } from '../utils/crawler.js';
import { calculateCategoryScore, getScoreSummary } from '../utils/scoring.js';

/**
 * Schema / Structured Data Analyzer
 *
 * Checks for JSON-LD structured data, Schema.org types,
 * and recommends missing schemas based on page content.
 */
export function analyzeSchema(crawl: CrawlResult): AnalyzerResult {
  const findings: Finding[] = [];
  const $ = parseHTML(crawl.html);

  const schemas = extractSchemas($);

  checkForSchema(schemas, findings);
  checkSchemaTypes(schemas, $, crawl, findings);
  checkFAQSchema(schemas, $, findings);
  checkBreadcrumbSchema(schemas, $, findings);
  checkLocalBusinessSchema(schemas, findings);
  checkOrganizationSchema(schemas, findings);

  const score = calculateCategoryScore(findings);

  return {
    category: 'schema',
    categoryLabel: 'Structured Data & Schema',
    score,
    maxScore: 100,
    findings,
    summary: getScoreSummary('Structured Data', score),
  };
}

interface SchemaData {
  type: string;
  data: any;
  raw: string;
}

function extractSchemas($: ReturnType<typeof parseHTML>): SchemaData[] {
  const schemas: SchemaData[] = [];

  // Extract JSON-LD schemas
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const content = $(el).html();
      if (!content) return;

      const parsed = JSON.parse(content);

      // Handle @graph arrays
      if (parsed['@graph'] && Array.isArray(parsed['@graph'])) {
        for (const item of parsed['@graph']) {
          schemas.push({
            type: item['@type'] || 'Unknown',
            data: item,
            raw: JSON.stringify(item),
          });
        }
      } else if (Array.isArray(parsed)) {
        for (const item of parsed) {
          schemas.push({
            type: item['@type'] || 'Unknown',
            data: item,
            raw: JSON.stringify(item),
          });
        }
      } else {
        schemas.push({
          type: parsed['@type'] || 'Unknown',
          data: parsed,
          raw: content,
        });
      }
    } catch {
      // Invalid JSON-LD
      schemas.push({
        type: 'INVALID',
        data: null,
        raw: $(el).html() || '',
      });
    }
  });

  return schemas;
}

function checkForSchema(schemas: SchemaData[], findings: Finding[]) {
  // Check for invalid JSON-LD
  const invalidSchemas = schemas.filter(s => s.type === 'INVALID');
  if (invalidSchemas.length > 0) {
    findings.push({
      id: 'schema-invalid-jsonld',
      title: 'Invalid JSON-LD Structured Data',
      description: `Found ${invalidSchemas.length} JSON-LD block(s) with invalid JSON. Search engines cannot parse these.`,
      severity: 'high',
      category: 'schema',
      subcategory: 'Validation',
      currentValue: 'Invalid JSON in schema blocks',
      recommendedValue: 'Valid JSON-LD markup',
      howToFix: 'Validate your JSON-LD at https://validator.schema.org/ or Google\'s Rich Results Test. Fix syntax errors in the JSON structure.',
      impact: 'Invalid structured data is ignored by search engines, meaning you miss out on rich results and enhanced search appearances.',
      effort: 'low',
    });
  }

  const validSchemas = schemas.filter(s => s.type !== 'INVALID');

  if (validSchemas.length === 0) {
    findings.push({
      id: 'schema-no-structured-data',
      title: 'No Structured Data Found',
      description: 'The page has no JSON-LD structured data. This is a significant missed opportunity for rich search results.',
      severity: 'high',
      category: 'schema',
      subcategory: 'Presence',
      recommendedValue: 'At least WebSite, Organization, and page-specific schema',
      howToFix: 'Add JSON-LD structured data to the page. At minimum, include:\n1. Organization or LocalBusiness schema\n2. WebSite schema with SearchAction\n3. Page-specific schema (Article, Product, Service, etc.)\n\nPlace JSON-LD in a <script type="application/ld+json"> tag in the <head>.',
      impact: 'Structured data enables rich results in Google (star ratings, FAQs, breadcrumbs, etc.), which dramatically improve click-through rates. Sites with rich results can see 20-30% higher CTR.',
      effort: 'medium',
    });
  }
}

function checkSchemaTypes(
  schemas: SchemaData[],
  $: ReturnType<typeof parseHTML>,
  crawl: CrawlResult,
  findings: Finding[]
) {
  const types = schemas.map(s => s.type).filter(t => t !== 'INVALID');

  // Check for WebSite schema
  if (!types.some(t => t === 'WebSite' || t === 'WebPage')) {
    findings.push({
      id: 'schema-no-website',
      title: 'Missing WebSite/WebPage Schema',
      description: 'No WebSite or WebPage structured data found. This helps search engines understand the site identity.',
      severity: 'medium',
      category: 'schema',
      subcategory: 'Types',
      recommendedValue: 'WebSite schema with name, url, and SearchAction',
      howToFix: `Add WebSite schema to the homepage and WebPage schema to other pages. Example:\n{\n  "@context": "https://schema.org",\n  "@type": "WebSite",\n  "name": "Your Site Name",\n  "url": "${crawl.finalUrl}",\n  "potentialAction": {\n    "@type": "SearchAction",\n    "target": "${crawl.finalUrl}/search?q={search_term_string}",\n    "query-input": "required name=search_term_string"\n  }\n}`,
      impact: 'WebSite schema with SearchAction can enable a sitelinks search box in Google results, improving visibility and user engagement.',
      effort: 'low',
    });
  }

  // Check WebSite schema for SearchAction
  const websiteSchemas = schemas.filter(s => s.type === 'WebSite');
  for (const ws of websiteSchemas) {
    if (!ws.data.potentialAction) {
      findings.push({
        id: 'schema-no-searchaction',
        title: 'WebSite Schema Missing SearchAction',
        description: 'The WebSite schema does not include a SearchAction. This enables the sitelinks search box in Google.',
        severity: 'low',
        category: 'schema',
        subcategory: 'Types',
        currentValue: 'WebSite schema without SearchAction',
        recommendedValue: 'WebSite schema with SearchAction',
        howToFix: 'Add a potentialAction property to your WebSite schema with a SearchAction type pointing to your site\'s search functionality.',
        impact: 'SearchAction enables a search box directly in Google search results, providing a direct path for users to search your site.',
        effort: 'low',
      });
    }
  }
}

function checkFAQSchema(
  schemas: SchemaData[],
  $: ReturnType<typeof parseHTML>,
  findings: Finding[]
) {
  const hasFAQSchema = schemas.some(s => s.type === 'FAQPage');

  // Detect FAQ-like content on the page
  const hasFAQContent = detectFAQContent($);

  if (hasFAQContent && !hasFAQSchema) {
    findings.push({
      id: 'schema-missing-faq',
      title: 'FAQ Content Detected Without FAQ Schema',
      description: 'The page appears to have FAQ-style content but no FAQPage structured data. Adding FAQ schema can generate rich results.',
      severity: 'medium',
      category: 'schema',
      subcategory: 'Types',
      recommendedValue: 'FAQPage schema for Q&A content',
      howToFix: 'Wrap your FAQ content in FAQPage schema. Each question/answer pair should use the Question type with an acceptedAnswer. Example:\n{\n  "@context": "https://schema.org",\n  "@type": "FAQPage",\n  "mainEntity": [{\n    "@type": "Question",\n    "name": "Your question here?",\n    "acceptedAnswer": {\n      "@type": "Answer",\n      "text": "Your answer here."\n    }\n  }]\n}',
      impact: 'FAQ rich results can significantly increase your search result size and CTR. Google shows FAQ answers directly in search results, often doubling the visible space for your listing.',
      effort: 'medium',
    });
  }
}

function detectFAQContent($: ReturnType<typeof parseHTML>): boolean {
  const text = $('body').text().toLowerCase();

  // Check for FAQ-like patterns
  const faqIndicators = [
    'frequently asked',
    'faq',
    'common questions',
    'q&a',
    'questions and answers',
  ];

  const hasFAQSection = faqIndicators.some(indicator => text.includes(indicator));

  // Check for question-like headings
  const headings = $('h2, h3, h4');
  let questionHeadings = 0;
  headings.each((_, el) => {
    const headingText = $(el).text().trim();
    if (headingText.endsWith('?')) questionHeadings++;
  });

  return hasFAQSection || questionHeadings >= 3;
}

function checkBreadcrumbSchema(
  schemas: SchemaData[],
  $: ReturnType<typeof parseHTML>,
  findings: Finding[]
) {
  const hasBreadcrumbSchema = schemas.some(s => s.type === 'BreadcrumbList');

  // Check if page has breadcrumb-like navigation
  const hasBreadcrumbNav = $('nav[aria-label*="breadcrumb"], .breadcrumb, .breadcrumbs, [class*="breadcrumb"]').length > 0;

  if (hasBreadcrumbNav && !hasBreadcrumbSchema) {
    findings.push({
      id: 'schema-missing-breadcrumb',
      title: 'Breadcrumb Navigation Without Schema',
      description: 'The page has breadcrumb navigation but no BreadcrumbList structured data.',
      severity: 'low',
      category: 'schema',
      subcategory: 'Types',
      recommendedValue: 'BreadcrumbList schema matching visible breadcrumbs',
      howToFix: 'Add BreadcrumbList schema that matches your visible breadcrumb navigation. This helps Google display breadcrumbs in search results instead of the URL.',
      impact: 'Breadcrumb rich results replace the URL in search results with a readable breadcrumb trail, improving click-through rates.',
      effort: 'low',
    });
  }
}

function checkLocalBusinessSchema(schemas: SchemaData[], findings: Finding[]) {
  const hasLocalBusiness = schemas.some(s =>
    s.type === 'LocalBusiness' ||
    s.type === 'Organization' ||
    s.type === 'ProfessionalService' ||
    s.type === 'Store'
  );

  // This is only a suggestion, so make it info-level
  if (!hasLocalBusiness) {
    findings.push({
      id: 'schema-no-business',
      title: 'Consider Adding Business Schema',
      description: 'No Organization or LocalBusiness schema found. If this is a business site, this schema helps Google understand and display business information.',
      severity: 'info',
      category: 'schema',
      subcategory: 'Types',
      recommendedValue: 'Organization or LocalBusiness schema',
      howToFix: 'If this is a business website, add Organization schema (for online businesses) or LocalBusiness schema (for businesses with physical locations). Include name, logo, contact info, and social profiles.',
      impact: 'Business schema helps Google display your business information in knowledge panels and local search results.',
      effort: 'low',
    });
  }
}

function checkOrganizationSchema(schemas: SchemaData[], findings: Finding[]) {
  const orgSchemas = schemas.filter(s =>
    s.type === 'Organization' || s.type === 'LocalBusiness'
  );

  for (const org of orgSchemas) {
    const missing: string[] = [];
    if (!org.data.name) missing.push('name');
    if (!org.data.logo) missing.push('logo');
    if (!org.data.url) missing.push('url');
    if (!org.data.contactPoint && !org.data.telephone) missing.push('contactPoint');

    if (missing.length > 0) {
      findings.push({
        id: 'schema-org-incomplete',
        title: 'Organization Schema Is Incomplete',
        description: `The ${org.type} schema is missing: ${missing.join(', ')}.`,
        severity: 'low',
        category: 'schema',
        subcategory: 'Completeness',
        currentValue: `Missing: ${missing.join(', ')}`,
        recommendedValue: 'Complete Organization schema with name, logo, url, contactPoint',
        howToFix: `Add the missing properties to your ${org.type} schema: ${missing.join(', ')}. More complete schemas have a better chance of generating rich results.`,
        impact: 'Incomplete schemas may not qualify for rich results. Google prefers well-formed, complete structured data.',
        effort: 'low',
      });
    }
  }
}
