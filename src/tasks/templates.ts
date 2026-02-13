/**
 * Task Templates
 *
 * Pre-written, agency-quality task descriptions for common SEO findings.
 * These provide detailed, actionable guidance — not just "fix the issue."
 */

interface TaskTemplate {
  title: string;
  description: string;
  estimatedHours: number;
  deliverable: string;
  steps: string[];
}

export const TASK_TEMPLATES: Record<string, TaskTemplate> = {
  // ============================================================
  // Technical SEO Tasks
  // ============================================================

  'tech-ssl-invalid': {
    title: 'Install/Fix SSL Certificate',
    description: 'The site\'s SSL certificate is invalid, expired, or missing. This is a critical security and ranking issue that must be resolved immediately.',
    estimatedHours: 2,
    deliverable: 'Working SSL certificate with HTTPS enforced across the site',
    steps: [
      'Check current SSL status and identify the specific issue (expired, self-signed, domain mismatch)',
      'If using a hosting provider: Enable SSL through the hosting dashboard (most offer free Let\'s Encrypt)',
      'If self-managed: Generate a new certificate using Certbot/Let\'s Encrypt',
      'Configure the web server to use the new certificate',
      'Set up HTTP → HTTPS redirect (301) for all pages',
      'Update internal links to use HTTPS',
      'Update sitemap.xml to use HTTPS URLs',
      'Verify in Google Search Console (add HTTPS property if needed)',
      'Test: Visit the site and confirm the padlock icon appears',
    ],
  },

  'tech-no-https': {
    title: 'Migrate Site to HTTPS',
    description: 'The site is served over HTTP without encryption. HTTPS is a ranking signal and security requirement.',
    estimatedHours: 3,
    deliverable: 'Fully migrated HTTPS site with all redirects in place',
    steps: [
      'Obtain an SSL certificate (Let\'s Encrypt is free)',
      'Install the certificate on the web server',
      'Configure 301 redirects from HTTP to HTTPS for all URLs',
      'Update all internal links to use HTTPS',
      'Update canonical tags to use HTTPS',
      'Update sitemap.xml with HTTPS URLs',
      'Update robots.txt sitemap directive to HTTPS',
      'Add HTTPS property in Google Search Console',
      'Submit updated sitemap to Google Search Console',
      'Monitor for mixed content warnings (HTTP resources on HTTPS pages)',
    ],
  },

  'tech-no-robots': {
    title: 'Create and Configure robots.txt',
    description: 'Create a properly configured robots.txt file to guide search engine crawling.',
    estimatedHours: 1,
    deliverable: 'Deployed robots.txt file with correct directives',
    steps: [
      'Identify pages/directories that should NOT be crawled (admin, staging, duplicate content)',
      'Create robots.txt with Allow/Disallow rules',
      'Add Sitemap directive pointing to the XML sitemap',
      'Deploy to the root of the domain (e.g., example.com/robots.txt)',
      'Test using Google Search Console\'s robots.txt tester',
      'Verify search engines can access important pages',
    ],
  },

  'tech-no-sitemap': {
    title: 'Create and Submit XML Sitemap',
    description: 'Generate a comprehensive XML sitemap and submit it to search engines.',
    estimatedHours: 2,
    deliverable: 'Live XML sitemap submitted to Google Search Console',
    steps: [
      'Generate an XML sitemap including all important, indexable pages',
      'Exclude noindexed pages, redirects, and error pages from the sitemap',
      'Include lastmod dates for each URL (helps search engines prioritize crawling)',
      'If using a CMS: Configure the sitemap plugin (Yoast, RankMath, etc.)',
      'If custom site: Use a sitemap generator tool or create programmatically',
      'Deploy sitemap to /sitemap.xml',
      'Add Sitemap directive to robots.txt',
      'Submit sitemap in Google Search Console',
      'Verify all important pages are included in the sitemap',
    ],
  },

  'tech-no-canonical': {
    title: 'Implement Canonical Tags Across the Site',
    description: 'Add self-referencing canonical tags to all pages to prevent duplicate content issues.',
    estimatedHours: 2,
    deliverable: 'Canonical tags implemented on all pages',
    steps: [
      'Audit all pages to determine the canonical (preferred) URL for each',
      'Add <link rel="canonical" href="..."> to every page\'s <head>',
      'Ensure canonical URLs use the same protocol (HTTPS) and www/non-www as the site',
      'For paginated content: Use rel="canonical" pointing to the main page or use proper pagination markup',
      'For duplicate content: Point canonical to the primary version',
      'Test canonicals using Google Search Console or Screaming Frog',
    ],
  },

  'tech-no-viewport': {
    title: 'Add Mobile Viewport Configuration',
    description: 'Add the viewport meta tag to enable proper mobile rendering.',
    estimatedHours: 0.5,
    deliverable: 'Viewport meta tag added to all pages',
    steps: [
      'Add to <head> on all pages: <meta name="viewport" content="width=device-width, initial-scale=1">',
      'If using a template system, add to the base/layout template',
      'Verify mobile rendering on multiple devices',
      'Test using Google\'s Mobile-Friendly Test tool',
    ],
  },

  'tech-noindex': {
    title: 'Remove Noindex Directive from Important Pages',
    description: 'Critical: The page is set to noindex, which prevents it from appearing in search results entirely.',
    estimatedHours: 1,
    deliverable: 'Noindex removed, page re-submitted for indexing',
    steps: [
      'Identify WHERE the noindex is set (meta tag, HTTP header, or CMS setting)',
      'Remove the noindex directive',
      'Change to: <meta name="robots" content="index, follow">',
      'Also check X-Robots-Tag HTTP headers for noindex',
      'Request indexing in Google Search Console',
      'Monitor indexing status over the next few days',
    ],
  },

  // ============================================================
  // On-Page SEO Tasks
  // ============================================================

  'onpage-no-title': {
    title: 'Write Optimized Title Tags',
    description: 'Create unique, keyword-optimized title tags for pages missing them.',
    estimatedHours: 2,
    deliverable: 'Optimized title tags deployed on all key pages',
    steps: [
      'Research primary keywords for each page using keyword tools',
      'Write unique title tags (50-60 characters) for each page',
      'Format: "Primary Keyword - Secondary Keyword | Brand Name"',
      'Front-load the most important keyword',
      'Make each title compelling and click-worthy (think ad copy)',
      'Implement title tags on the site',
      'Verify using View Source or browser SEO extension',
    ],
  },

  'onpage-no-meta-desc': {
    title: 'Write Compelling Meta Descriptions',
    description: 'Create unique meta descriptions that drive clicks from search results.',
    estimatedHours: 2,
    deliverable: 'Meta descriptions written and deployed for all key pages',
    steps: [
      'Write unique meta descriptions (150-160 characters) for each page',
      'Include target keywords naturally (Google bolds matching terms)',
      'Include a clear call-to-action (Learn more, Get started, Discover, etc.)',
      'Make each description unique — no duplicates across pages',
      'Think of meta descriptions as ad copy — they sell the click',
      'Implement and verify',
    ],
  },

  'onpage-no-h1': {
    title: 'Add Optimized H1 Headings',
    description: 'Add a single, keyword-rich H1 heading to pages missing one.',
    estimatedHours: 1,
    deliverable: 'H1 headings added to all pages',
    steps: [
      'Write a clear, descriptive H1 for each page',
      'Include the primary target keyword naturally',
      'Ensure only ONE H1 per page',
      'Make the H1 different from (but related to) the title tag',
      'Place the H1 as the first heading visible on the page',
    ],
  },

  'onpage-thin-content': {
    title: 'Expand Thin Content Pages',
    description: 'Add substantive, valuable content to pages identified as having thin content.',
    estimatedHours: 6,
    deliverable: 'Expanded content meeting minimum quality thresholds',
    steps: [
      'Identify the target audience and search intent for each thin page',
      'Research what competitors cover for the same topics',
      'Expand content to at least 500-800 words (1000+ for articles)',
      'Structure with H2/H3 subheadings every 200-300 words',
      'Include relevant keywords naturally throughout',
      'Add FAQ section answering common questions',
      'Add images, lists, or tables where they add value',
      'Include internal links to related pages',
      'Proofread and optimize for readability',
    ],
  },

  'onpage-missing-alt': {
    title: 'Add Alt Text to All Images',
    description: 'Write descriptive alt text for all images missing it.',
    estimatedHours: 2,
    deliverable: 'Alt text added to all images across the site',
    steps: [
      'Audit all images on the site to find those missing alt text',
      'Write descriptive alt text for each image (describe what the image shows)',
      'Include relevant keywords where natural (don\'t keyword-stuff)',
      'For decorative images, use alt="" (empty alt, not missing alt)',
      'Keep alt text under 125 characters',
      'Implement and verify',
    ],
  },

  'onpage-og-incomplete': {
    title: 'Implement Complete Social Meta Tags',
    description: 'Add Open Graph and Twitter Card meta tags for optimal social sharing.',
    estimatedHours: 2,
    deliverable: 'Complete social meta tags on all pages',
    steps: [
      'Add og:title, og:description, og:image, og:type to all pages',
      'Add twitter:card (summary_large_image) meta tag',
      'Create a default sharing image (1200x630px) for pages without a specific image',
      'If using a CMS, configure the SEO plugin to auto-generate these',
      'Test using Facebook Sharing Debugger and Twitter Card Validator',
      'Verify images display correctly when shared',
    ],
  },

  // ============================================================
  // Performance Tasks
  // ============================================================

  'perf-lcp-poor-mobile': {
    title: 'Fix Mobile LCP (Largest Contentful Paint)',
    description: 'The largest content element on mobile takes too long to render. This is a Core Web Vital and direct ranking factor.',
    estimatedHours: 6,
    deliverable: 'LCP improved to under 2500ms on mobile',
    steps: [
      'Identify the LCP element (usually hero image or large heading) using Chrome DevTools',
      'If LCP is an image: Convert to WebP/AVIF, resize to mobile dimensions, add srcset for responsive images',
      'If LCP is text: Ensure fonts are preloaded, use font-display: swap',
      'Preload the LCP resource: <link rel="preload" href="..." as="image">',
      'Reduce render-blocking CSS: inline critical CSS, defer non-critical',
      'Reduce render-blocking JS: defer or async non-critical scripts',
      'Implement server-side caching and CDN if not already',
      'Reduce TTFB (server response time) if above 600ms',
      'Re-test using PageSpeed Insights after each change',
    ],
  },

  'perf-cls-poor-mobile': {
    title: 'Fix Mobile Layout Shift (CLS)',
    description: 'The page has significant layout shifts during loading, causing a poor user experience.',
    estimatedHours: 4,
    deliverable: 'CLS score reduced to under 0.1',
    steps: [
      'Use Chrome DevTools → Performance panel to identify layout shift sources',
      'Add explicit width and height attributes to all images and videos',
      'Add aspect-ratio CSS to image/video containers',
      'Reserve space for ads and dynamic content with fixed-size containers',
      'Preload web fonts and use font-display: swap to prevent font-swap shifts',
      'Avoid inserting content above existing content (especially ads, banners)',
      'Use CSS contain: layout on containers that change size',
      'Re-test using PageSpeed Insights after changes',
    ],
  },

  // ============================================================
  // Schema Tasks
  // ============================================================

  'schema-no-structured-data': {
    title: 'Implement Core Structured Data (JSON-LD)',
    description: 'Add foundational structured data to enable rich results in Google search.',
    estimatedHours: 4,
    deliverable: 'JSON-LD structured data deployed and validated',
    steps: [
      'Determine the appropriate schema types for the site (Organization, LocalBusiness, WebSite, etc.)',
      'Create Organization/LocalBusiness schema with name, logo, url, contact info',
      'Create WebSite schema with SearchAction for sitelinks search box',
      'Create WebPage schema for individual pages',
      'For service pages: Add Service schema',
      'For blog posts: Add Article schema with author, date, publisher',
      'Place all JSON-LD in <script type="application/ld+json"> tags in <head>',
      'Validate using Google\'s Rich Results Test (https://search.google.com/test/rich-results)',
      'Validate using Schema.org Validator (https://validator.schema.org/)',
      'Submit updated pages for reindexing in Google Search Console',
    ],
  },

  'schema-missing-faq': {
    title: 'Add FAQ Schema to FAQ Content',
    description: 'Implement FAQPage structured data on pages with FAQ content to enable rich FAQ results in Google.',
    estimatedHours: 2,
    deliverable: 'FAQ schema implemented and validated',
    steps: [
      'Identify all pages with FAQ-style content',
      'Format content as clear question/answer pairs if not already',
      'Create FAQPage JSON-LD schema for each FAQ section',
      'Ensure the schema matches the visible page content exactly',
      'Validate using Google\'s Rich Results Test',
      'Note: Google may show FAQ rich results, dramatically increasing your search result size',
    ],
  },

  // ============================================================
  // AEO Tasks
  // ============================================================

  'aeo-no-structure': {
    title: 'Restructure Content for AI Extraction',
    description: 'Reorganize page content with clear sections and headings so AI systems can easily extract and cite information.',
    estimatedHours: 4,
    deliverable: 'Restructured content with clear sections optimized for AI citation',
    steps: [
      'Identify the main topics and subtopics covered on each page',
      'Create a clear heading hierarchy (H1 → H2 → H3) for each page',
      'Use question-format headings where appropriate (matching user queries)',
      'Ensure each section starts with a direct, clear answer (40-60 words)',
      'Follow with supporting details, examples, and evidence',
      'Add summary/key takeaway paragraphs at the end of major sections',
      'Test by asking: "Could an AI read just the headings and understand the page structure?"',
    ],
  },

  'aeo-no-question-headings': {
    title: 'Add Question-Format Headings for AI & Featured Snippets',
    description: 'Rephrase content headings as questions to match how users query AI assistants and search engines.',
    estimatedHours: 2,
    deliverable: 'Updated headings in question format with direct answers below',
    steps: [
      'Research "People Also Ask" questions for your target topics',
      'Rephrase 3-5 headings per page as natural questions',
      'Ensure the first 1-2 sentences after each question heading provide a direct, clear answer',
      'Use the inverted pyramid: answer first, details second',
      'Include a mix of "What", "How", "Why" questions',
      'Keep answers concise (40-60 words) for the featured snippet/AI extraction zone',
    ],
  },

  'aeo-no-semantic-html': {
    title: 'Implement Semantic HTML Structure',
    description: 'Add semantic HTML5 elements to help AI systems and search engines understand content hierarchy.',
    estimatedHours: 3,
    deliverable: 'Semantic HTML implemented across all page templates',
    steps: [
      'Wrap the primary content area in a <main> tag',
      'Use <article> for self-contained content pieces (blog posts, product descriptions)',
      'Use <section> for thematic groupings of content',
      'Use <aside> for sidebar and supplementary content',
      'Ensure <nav> is used for all navigation blocks',
      'Use <header> and <footer> for page/section headers and footers',
      'Verify using browser DevTools or HTML validator',
    ],
  },

  // ============================================================
  // Search Console Tasks
  // ============================================================

  'gsc-low-impressions': {
    title: 'Increase Search Visibility & Impressions',
    description: 'The site has very few impressions in Google Search, indicating limited presence in search results. This is the most fundamental SEO metric to address.',
    estimatedHours: 8,
    deliverable: 'Content strategy document + 5 new keyword-targeted pages published',
    steps: [
      'Verify the site is properly indexed — check for noindex tags, robots.txt blocks, and crawl errors in GSC',
      'Ensure the XML sitemap is submitted and processing without errors',
      'Research target keywords using Keywords Everywhere or DataforSEO to find queries with search volume',
      'Create a content plan targeting 5-10 keywords with moderate volume and low-medium competition',
      'Write and publish optimized content for each target keyword',
      'Build internal links from existing pages to new content',
      'Submit new URLs for indexing via Google Search Console',
      'Monitor impressions weekly — expect growth within 4-8 weeks',
    ],
  },

  'gsc-low-overall-ctr': {
    title: 'Improve Site-Wide Click-Through Rate',
    description: 'The average CTR across all queries is below industry benchmarks. People see the site in results but are not clicking.',
    estimatedHours: 4,
    deliverable: 'Rewritten title tags and meta descriptions for top 20 pages',
    steps: [
      'Export the top 20 pages by impressions from Google Search Console',
      'For each page, review the current title tag and meta description',
      'Rewrite titles to be more compelling: front-load keywords, add power words, keep under 60 chars',
      'Rewrite meta descriptions with clear value propositions and calls-to-action, keep under 160 chars',
      'Implement structured data (FAQ, review, how-to) to enable rich results that increase visual appeal',
      'Deploy changes and monitor CTR changes in GSC over the next 2-4 weeks',
    ],
  },

  'gsc-low-avg-position': {
    title: 'Improve Average Search Position',
    description: 'Most queries rank on page 2+ of Google. Focus on moving "striking distance" keywords to page 1.',
    estimatedHours: 10,
    deliverable: 'Optimization plan for top 20 striking-distance pages with implementation',
    steps: [
      'Export queries ranking in positions 8-20 from Google Search Console',
      'Prioritize queries with the highest impressions (most traffic potential)',
      'For each priority query, identify the ranking page and analyze content gaps',
      'Improve content depth and quality — ensure the page fully satisfies the search intent',
      'Add internal links from high-authority pages to the target pages',
      'Optimize on-page elements: title tag, H1, H2s, image alt text for the target keyword',
      'Identify link-building opportunities to strengthen these pages',
      'Re-test positions in 4-6 weeks',
    ],
  },

  'gsc-low-ctr-pages': {
    title: 'Optimize High-Impression, Low-CTR Pages',
    description: 'Several pages get many impressions but very few clicks. These represent the highest-ROI optimization opportunities — increase traffic without needing better rankings.',
    estimatedHours: 3,
    deliverable: 'Rewritten title tags and meta descriptions for low-CTR pages',
    steps: [
      'Review the flagged pages in the audit report',
      'For each page, search the target keyword on Google and review how your result looks vs competitors',
      'Rewrite the title tag to be more compelling and differentiated from competitors',
      'Write a meta description that sells the click — include unique value, numbers, calls-to-action',
      'Consider adding structured data for rich results (FAQ, review stars, etc.)',
      'Deploy changes and track CTR in Google Search Console over 2-4 weeks',
    ],
  },

  'gsc-opportunity-queries': {
    title: 'Create Content for Opportunity Keywords',
    description: 'Multiple high-impression queries are not generating clicks. These represent proven demand that your site is not capitalizing on.',
    estimatedHours: 8,
    deliverable: 'New or optimized content targeting opportunity keywords',
    steps: [
      'Review the opportunity keywords identified in the audit report',
      'Group similar keywords by topic/intent',
      'For each keyword group, determine if an existing page should be optimized or if new content is needed',
      'For existing pages: expand content to better address the keyword, add relevant sections and headings',
      'For new content: create comprehensive pages targeting the keyword cluster',
      'Use the target keyword in the title, H1, and naturally throughout the content',
      'Build internal links to and from the new/updated content',
      'Submit URLs for re-indexing in Google Search Console',
    ],
  },

  'gsc-striking-distance': {
    title: 'Push Striking-Distance Keywords to Page 1',
    description: 'Keywords ranking in positions 4-15 are close to generating significantly more traffic. Small improvements can have outsized results.',
    estimatedHours: 6,
    deliverable: 'Optimization implemented for striking-distance keywords',
    steps: [
      'Review the striking-distance keywords from the audit report',
      'For each keyword, identify the ranking page in Google Search Console',
      'Analyze the top 3 results for each keyword — what do they have that your page doesn\'t?',
      'Update content: add missing sections, improve depth, add supporting data/examples',
      'Improve on-page signals: ensure keyword is in title, H1, first paragraph, and URL if possible',
      'Add 3-5 internal links from relevant pages pointing to the target page',
      'Consider creating supporting content that links to and strengthens the target page',
      'Monitor position changes weekly in GSC',
    ],
  },

  'gsc-low-page1-ratio': {
    title: 'Increase Page 1 Ranking Coverage',
    description: 'Less than 20% of tracked queries rank on Google page 1. A comprehensive SEO improvement strategy is needed.',
    estimatedHours: 12,
    deliverable: 'Comprehensive SEO improvement strategy with execution plan',
    steps: [
      'Audit existing content quality across the site — identify thin, outdated, or low-quality pages',
      'Research competitor content to identify gaps in your coverage',
      'Build a topical authority strategy: create content clusters around core topics',
      'Prioritize content improvements starting with pages closest to page 1',
      'Implement technical SEO fixes to ensure clean crawling and indexing',
      'Develop a link-building strategy to improve domain authority',
      'Set monthly ranking targets and track progress in GSC',
    ],
  },

  'gsc-no-sitemap-submitted': {
    title: 'Submit XML Sitemap to Google Search Console',
    description: 'No sitemap is registered with Google Search Console. This is a quick fix that helps Google discover and index your pages.',
    estimatedHours: 0.5,
    deliverable: 'XML sitemap submitted and verified in Google Search Console',
    steps: [
      'Verify your XML sitemap exists at /sitemap.xml',
      'If no sitemap exists: generate one including all important, indexable pages',
      'Log into Google Search Console',
      'Navigate to Sitemaps section',
      'Enter your sitemap URL and click Submit',
      'Wait for Google to process it and verify it shows "Success"',
      'Check for any errors reported in the sitemap status',
    ],
  },

  'gsc-sitemap-stale': {
    title: 'Fix Stale Sitemap in Search Console',
    description: 'The sitemap hasn\'t been re-downloaded by Google recently, which may indicate it is not being updated properly.',
    estimatedHours: 1,
    deliverable: 'Updated sitemap re-submitted and processing in GSC',
    steps: [
      'Check if your sitemap is being regenerated when content changes',
      'Ensure the sitemap includes lastmod dates that update with content changes',
      'If using a CMS: verify the sitemap plugin is configured correctly',
      'Re-submit the sitemap in Google Search Console',
      'Check the GSC sitemaps report for any errors',
      'Verify Google re-downloads the sitemap within 1-2 weeks',
    ],
  },
};
