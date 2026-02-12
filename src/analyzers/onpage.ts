import type { CrawlResult, Finding, AnalyzerResult } from '../types.js';
import { parseHTML } from '../utils/crawler.js';
import { calculateCategoryScore, getScoreSummary } from '../utils/scoring.js';
import { URL } from 'url';

/**
 * On-Page SEO Analyzer
 *
 * Checks: Title, meta description, headings, content, images,
 * links, URL structure, Open Graph, Twitter cards
 */
export function analyzeOnPage(crawl: CrawlResult): AnalyzerResult {
  const findings: Finding[] = [];
  const $ = parseHTML(crawl.html);

  checkTitle($, findings);
  checkMetaDescription($, findings);
  checkHeadings($, findings);
  checkContent($, findings);
  checkImages($, findings);
  checkLinks($, crawl, findings);
  checkURLStructure(crawl, findings);
  checkOpenGraph($, findings);
  checkTwitterCard($, findings);

  const score = calculateCategoryScore(findings);

  return {
    category: 'onpage',
    categoryLabel: 'On-Page SEO',
    score,
    maxScore: 100,
    findings,
    summary: getScoreSummary('On-Page SEO', score),
  };
}

function checkTitle($: ReturnType<typeof parseHTML>, findings: Finding[]) {
  const title = $('title').text().trim();

  if (!title) {
    findings.push({
      id: 'onpage-no-title',
      title: 'Missing Title Tag',
      description: 'The page has no <title> tag. This is one of the most important on-page SEO elements.',
      severity: 'critical',
      category: 'onpage',
      subcategory: 'Title',
      recommendedValue: 'A unique, descriptive title tag (50-60 characters)',
      howToFix: 'Add a <title> tag inside the <head> section. It should be unique for every page, include target keywords near the beginning, and be 50-60 characters long.',
      impact: 'The title tag is the single most impactful on-page SEO element. It appears as the clickable headline in search results.',
      effort: 'low',
    });
    return;
  }

  if (title.length < 30) {
    findings.push({
      id: 'onpage-title-short',
      title: 'Title Tag Is Too Short',
      description: `The title tag is only ${title.length} characters: "${title}". Short titles miss opportunities to include relevant keywords.`,
      severity: 'medium',
      category: 'onpage',
      subcategory: 'Title',
      currentValue: `${title.length} characters: "${title}"`,
      recommendedValue: '50-60 characters',
      howToFix: 'Expand the title to include target keywords and a compelling description. Format: "Primary Keyword - Secondary Keyword | Brand Name"',
      impact: 'Longer, keyword-rich titles have higher click-through rates and provide more ranking signals.',
      effort: 'low',
    });
  } else if (title.length > 60) {
    findings.push({
      id: 'onpage-title-long',
      title: 'Title Tag Is Too Long',
      description: `The title tag is ${title.length} characters and will be truncated in search results. Title: "${title}"`,
      severity: 'low',
      category: 'onpage',
      subcategory: 'Title',
      currentValue: `${title.length} characters`,
      recommendedValue: '50-60 characters',
      howToFix: 'Shorten the title to under 60 characters. Put the most important keywords first, as truncated text may be cut off.',
      impact: 'Truncated titles look unprofessional in search results and may lose important keyword information.',
      effort: 'low',
    });
  }
}

function checkMetaDescription($: ReturnType<typeof parseHTML>, findings: Finding[]) {
  const metaDesc = $('meta[name="description"]').attr('content')?.trim();

  if (!metaDesc) {
    findings.push({
      id: 'onpage-no-meta-desc',
      title: 'Missing Meta Description',
      description: 'The page has no meta description. Google may generate one from page content, but it won\'t be optimized.',
      severity: 'high',
      category: 'onpage',
      subcategory: 'Meta Description',
      recommendedValue: 'A compelling meta description (150-160 characters)',
      howToFix: 'Add a meta description tag: <meta name="description" content="Your description here">. Include target keywords naturally and write a compelling call-to-action.',
      impact: 'Meta descriptions don\'t directly impact rankings but strongly affect click-through rates from search results. A well-written description can significantly increase organic traffic.',
      effort: 'low',
    });
    return;
  }

  if (metaDesc.length < 70) {
    findings.push({
      id: 'onpage-meta-desc-short',
      title: 'Meta Description Is Too Short',
      description: `The meta description is only ${metaDesc.length} characters. You're missing an opportunity to attract clicks.`,
      severity: 'medium',
      category: 'onpage',
      subcategory: 'Meta Description',
      currentValue: `${metaDesc.length} characters`,
      recommendedValue: '150-160 characters',
      howToFix: 'Expand the meta description to 150-160 characters. Include target keywords and a clear value proposition or call-to-action.',
      impact: 'Short descriptions use less real estate in search results, potentially losing clicks to competitors with better descriptions.',
      effort: 'low',
    });
  } else if (metaDesc.length > 160) {
    findings.push({
      id: 'onpage-meta-desc-long',
      title: 'Meta Description Is Too Long',
      description: `The meta description is ${metaDesc.length} characters and will be truncated in search results.`,
      severity: 'low',
      category: 'onpage',
      subcategory: 'Meta Description',
      currentValue: `${metaDesc.length} characters`,
      recommendedValue: '150-160 characters',
      howToFix: 'Shorten the meta description to under 160 characters. Ensure the most important information and call-to-action appear early.',
      impact: 'Truncated descriptions may cut off your call-to-action or important information.',
      effort: 'low',
    });
  }
}

function checkHeadings($: ReturnType<typeof parseHTML>, findings: Finding[]) {
  const h1s = $('h1');
  const h2s = $('h2');
  const h3s = $('h3');

  // Check H1
  if (h1s.length === 0) {
    findings.push({
      id: 'onpage-no-h1',
      title: 'Missing H1 Heading',
      description: 'The page has no H1 heading. Every page should have exactly one H1 that describes the main topic.',
      severity: 'high',
      category: 'onpage',
      subcategory: 'Headings',
      recommendedValue: 'One H1 tag per page',
      howToFix: 'Add a single H1 tag that clearly describes the page\'s main topic. Include the primary target keyword naturally.',
      impact: 'The H1 tag is a strong on-page ranking signal. It tells search engines and users what the page is about.',
      effort: 'low',
    });
  } else if (h1s.length > 1) {
    findings.push({
      id: 'onpage-multiple-h1',
      title: 'Multiple H1 Tags Found',
      description: `The page has ${h1s.length} H1 tags. Best practice is to use exactly one H1 per page.`,
      severity: 'medium',
      category: 'onpage',
      subcategory: 'Headings',
      currentValue: `${h1s.length} H1 tags`,
      recommendedValue: '1 H1 tag',
      howToFix: 'Consolidate to a single H1 tag. Change extra H1 tags to H2 or H3 as appropriate for the content hierarchy.',
      impact: 'Multiple H1 tags dilute the topical focus of the page and can confuse search engines about the main topic.',
      effort: 'low',
    });
  } else {
    const h1Text = h1s.first().text().trim();
    if (h1Text.length < 10) {
      findings.push({
        id: 'onpage-h1-short',
        title: 'H1 Heading Is Too Short',
        description: `The H1 heading "${h1Text}" is very short and may not be descriptive enough.`,
        severity: 'low',
        category: 'onpage',
        subcategory: 'Headings',
        currentValue: h1Text,
        recommendedValue: 'A descriptive H1 with target keywords',
        howToFix: 'Make the H1 more descriptive by including the primary keyword and clearly stating the page\'s topic.',
        impact: 'A well-crafted H1 provides a strong ranking signal and helps users understand the page content.',
        effort: 'low',
      });
    }
  }

  // Check heading hierarchy
  if (h1s.length > 0 && h2s.length === 0 && h3s.length > 0) {
    findings.push({
      id: 'onpage-heading-skip',
      title: 'Heading Level Skipped (H1 → H3)',
      description: 'The page jumps from H1 to H3 without any H2 headings. This breaks the logical content hierarchy.',
      severity: 'low',
      category: 'onpage',
      subcategory: 'Headings',
      currentValue: 'H1 → H3 (skipping H2)',
      recommendedValue: 'H1 → H2 → H3',
      howToFix: 'Add H2 headings to create a proper hierarchy, or change H3 tags to H2 if they represent major sections.',
      impact: 'A proper heading hierarchy helps search engines understand content structure and improves accessibility.',
      effort: 'low',
    });
  }

  // Check for no subheadings on long content
  const textContent = $('body').text().trim();
  const wordCount = textContent.split(/\s+/).length;
  if (wordCount > 300 && h2s.length === 0) {
    findings.push({
      id: 'onpage-no-subheadings',
      title: 'Long Content Without Subheadings',
      description: `The page has ~${wordCount} words but no H2 subheadings. Long content should be broken into sections.`,
      severity: 'medium',
      category: 'onpage',
      subcategory: 'Headings',
      currentValue: `${wordCount} words, 0 H2 tags`,
      recommendedValue: 'H2 subheadings every 200-300 words',
      howToFix: 'Break the content into logical sections using H2 headings. Each section should focus on a subtopic and include relevant keywords.',
      impact: 'Subheadings improve readability, help search engines understand content structure, and create opportunities for featured snippets.',
      effort: 'medium',
    });
  }
}

function checkContent($: ReturnType<typeof parseHTML>, findings: Finding[]) {
  // Remove script, style, and nav elements for content analysis
  const $clone = parseHTML($.html());
  $clone('script, style, nav, footer, header, aside').remove();
  const textContent = $clone('body').text().trim();
  const wordCount = textContent.split(/\s+/).filter(w => w.length > 0).length;

  if (wordCount < 100) {
    findings.push({
      id: 'onpage-thin-content',
      title: 'Thin Content Detected',
      description: `The page has only ~${wordCount} words of content. This is considered thin content by search engines.`,
      severity: 'high',
      category: 'onpage',
      subcategory: 'Content',
      currentValue: `~${wordCount} words`,
      recommendedValue: 'At least 300+ words for standard pages, 1000+ for articles',
      howToFix: 'Add more substantive content that thoroughly covers the topic. Include relevant keywords naturally, answer common questions, and provide genuine value to visitors.',
      impact: 'Thin content pages struggle to rank because they don\'t provide enough information for search engines to determine relevance or for users to find value.',
      effort: 'high',
    });
  } else if (wordCount < 300) {
    findings.push({
      id: 'onpage-low-content',
      title: 'Below-Average Content Length',
      description: `The page has ~${wordCount} words. While not critically thin, more content could improve rankings.`,
      severity: 'medium',
      category: 'onpage',
      subcategory: 'Content',
      currentValue: `~${wordCount} words`,
      recommendedValue: '500+ words for standard pages',
      howToFix: 'Expand the content to more thoroughly cover the topic. Consider adding FAQs, examples, or detailed explanations.',
      impact: 'Pages with more comprehensive content tend to rank higher because they better satisfy user search intent.',
      effort: 'medium',
    });
  }
}

function checkImages($: ReturnType<typeof parseHTML>, findings: Finding[]) {
  const images = $('img');
  const imagesWithoutAlt: string[] = [];
  const imagesWithEmptyAlt: string[] = [];

  images.each((_, img) => {
    const alt = $(img).attr('alt');
    const src = $(img).attr('src') || $(img).attr('data-src') || 'unknown';

    if (alt === undefined) {
      imagesWithoutAlt.push(src);
    } else if (alt.trim() === '') {
      imagesWithEmptyAlt.push(src);
    }
  });

  if (imagesWithoutAlt.length > 0) {
    findings.push({
      id: 'onpage-missing-alt',
      title: 'Images Missing Alt Text',
      description: `${imagesWithoutAlt.length} image(s) have no alt attribute. Alt text is critical for accessibility and image SEO.`,
      severity: 'medium',
      category: 'onpage',
      subcategory: 'Images',
      currentValue: `${imagesWithoutAlt.length} images without alt text`,
      recommendedValue: 'All images should have descriptive alt text',
      howToFix: `Add descriptive alt text to these images. The alt text should describe what the image shows and include relevant keywords where natural. Images missing alt:\n${imagesWithoutAlt.slice(0, 5).join('\n')}${imagesWithoutAlt.length > 5 ? `\n... and ${imagesWithoutAlt.length - 5} more` : ''}`,
      impact: 'Image alt text helps search engines understand images (improving image search rankings) and is required for web accessibility compliance.',
      effort: 'low',
    });
  }

  if (images.length === 0) {
    const textContent = $('body').text().trim();
    const wordCount = textContent.split(/\s+/).length;
    if (wordCount > 200) {
      findings.push({
        id: 'onpage-no-images',
        title: 'No Images on Content Page',
        description: 'The page has substantial text content but no images. Visual content improves engagement and can rank in image search.',
        severity: 'low',
        category: 'onpage',
        subcategory: 'Images',
        recommendedValue: 'At least 1 relevant image per major content section',
        howToFix: 'Add relevant images to break up the content and improve engagement. Include descriptive file names, alt text, and consider using WebP format for performance.',
        impact: 'Pages with images tend to get more engagement. Images can also rank in Google Image Search, providing additional traffic.',
        effort: 'medium',
      });
    }
  }
}

function checkLinks(
  $: ReturnType<typeof parseHTML>,
  crawl: CrawlResult,
  findings: Finding[]
) {
  const links = $('a[href]');
  const internalLinks: string[] = [];
  const externalLinks: string[] = [];
  const noFollowLinks: string[] = [];
  const emptyLinks: string[] = [];

  let baseHost: string;
  try {
    baseHost = new URL(crawl.finalUrl).hostname;
  } catch {
    baseHost = '';
  }

  links.each((_, link) => {
    const href = $(link).attr('href') || '';
    const rel = $(link).attr('rel') || '';
    const text = $(link).text().trim();

    if (!href || href === '#' || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) {
      if (!text && !$(link).find('img').length) {
        emptyLinks.push(href);
      }
      return;
    }

    try {
      const linkUrl = new URL(href, crawl.finalUrl);
      if (linkUrl.hostname === baseHost) {
        internalLinks.push(href);
      } else {
        externalLinks.push(href);
      }
    } catch {
      internalLinks.push(href); // relative URLs are internal
    }

    if (rel.includes('nofollow')) {
      noFollowLinks.push(href);
    }
  });

  if (internalLinks.length < 3) {
    findings.push({
      id: 'onpage-few-internal-links',
      title: 'Too Few Internal Links',
      description: `The page has only ${internalLinks.length} internal links. Internal linking is crucial for SEO.`,
      severity: 'medium',
      category: 'onpage',
      subcategory: 'Links',
      currentValue: `${internalLinks.length} internal links`,
      recommendedValue: 'At least 3-5 contextual internal links',
      howToFix: 'Add internal links to related pages on your site within the content. Use descriptive anchor text that includes relevant keywords for the linked page.',
      impact: 'Internal links help search engines discover pages, understand site structure, and distribute page authority. They also keep users on your site longer.',
      effort: 'low',
    });
  }

  if (externalLinks.length === 0) {
    const textContent = $('body').text().trim();
    const wordCount = textContent.split(/\s+/).length;
    if (wordCount > 300) {
      findings.push({
        id: 'onpage-no-external-links',
        title: 'No External Links',
        description: 'The page has no outbound links to external sites. Linking to authoritative sources can boost credibility.',
        severity: 'low',
        category: 'onpage',
        subcategory: 'Links',
        currentValue: '0 external links',
        recommendedValue: '2-5 external links to authoritative sources',
        howToFix: 'Add links to relevant, authoritative external sources that support your content. This builds trust with both users and search engines.',
        impact: 'External links to quality sources signal that your content is well-researched and part of the broader web ecosystem.',
        effort: 'low',
      });
    }
  }
}

function checkURLStructure(crawl: CrawlResult, findings: Finding[]) {
  try {
    const parsedUrl = new URL(crawl.finalUrl);
    const path = parsedUrl.pathname;

    // Check for excessively long URLs
    if (crawl.finalUrl.length > 100) {
      findings.push({
        id: 'onpage-long-url',
        title: 'URL Is Too Long',
        description: `The URL is ${crawl.finalUrl.length} characters long. Shorter URLs tend to perform better.`,
        severity: 'low',
        category: 'onpage',
        subcategory: 'URL',
        currentValue: `${crawl.finalUrl.length} characters`,
        recommendedValue: 'Under 75 characters',
        howToFix: 'Shorten the URL by using concise, keyword-rich slugs. Remove unnecessary words (a, the, and, etc.) and parameters.',
        impact: 'Shorter URLs are easier to share, look cleaner in search results, and may have a minor ranking advantage.',
        effort: 'medium',
      });
    }

    // Check for underscores
    if (path.includes('_')) {
      findings.push({
        id: 'onpage-url-underscores',
        title: 'URL Contains Underscores',
        description: 'The URL uses underscores instead of hyphens. Google treats hyphens as word separators but not underscores.',
        severity: 'low',
        category: 'onpage',
        subcategory: 'URL',
        currentValue: path,
        recommendedValue: path.replace(/_/g, '-'),
        howToFix: 'Replace underscores with hyphens in URLs. Set up 301 redirects from old URLs to new ones.',
        impact: 'Google recommends hyphens over underscores for word separation in URLs. This can improve how Google parses keywords in your URL.',
        effort: 'medium',
      });
    }

    // Check for uppercase characters
    if (path !== path.toLowerCase()) {
      findings.push({
        id: 'onpage-url-uppercase',
        title: 'URL Contains Uppercase Characters',
        description: 'The URL contains uppercase letters. URLs are case-sensitive and this can cause duplicate content issues.',
        severity: 'low',
        category: 'onpage',
        subcategory: 'URL',
        currentValue: path,
        recommendedValue: path.toLowerCase(),
        howToFix: 'Use lowercase URLs consistently and set up 301 redirects from uppercase versions to lowercase.',
        impact: 'Mixed case URLs can lead to duplicate content when the same page is accessed via different URL cases.',
        effort: 'low',
      });
    }

    // Check for query parameters
    if (parsedUrl.search && parsedUrl.search.length > 1) {
      findings.push({
        id: 'onpage-url-params',
        title: 'URL Contains Query Parameters',
        description: `The URL contains query parameters: ${parsedUrl.search}. Dynamic URLs are less SEO-friendly than clean URLs.`,
        severity: 'info',
        category: 'onpage',
        subcategory: 'URL',
        currentValue: crawl.finalUrl,
        recommendedValue: 'Clean, static-looking URLs without query parameters',
        howToFix: 'If possible, use URL rewriting to create clean, readable URLs. If parameters are necessary, ensure canonical tags are set to the preferred URL version.',
        impact: 'Clean URLs are more clickable in search results and easier for search engines to understand.',
        effort: 'high',
      });
    }
  } catch {
    // Invalid URL, already caught by technical analyzer
  }
}

function checkOpenGraph($: ReturnType<typeof parseHTML>, findings: Finding[]) {
  const ogTitle = $('meta[property="og:title"]').attr('content');
  const ogDescription = $('meta[property="og:description"]').attr('content');
  const ogImage = $('meta[property="og:image"]').attr('content');
  const ogType = $('meta[property="og:type"]').attr('content');

  const missing: string[] = [];
  if (!ogTitle) missing.push('og:title');
  if (!ogDescription) missing.push('og:description');
  if (!ogImage) missing.push('og:image');
  if (!ogType) missing.push('og:type');

  if (missing.length > 0) {
    findings.push({
      id: 'onpage-og-incomplete',
      title: 'Incomplete Open Graph Tags',
      description: `Missing Open Graph tags: ${missing.join(', ')}. These control how the page appears when shared on social media.`,
      severity: missing.includes('og:title') || missing.includes('og:image') ? 'medium' : 'low',
      category: 'onpage',
      subcategory: 'Social',
      currentValue: `Missing: ${missing.join(', ')}`,
      recommendedValue: 'Complete og:title, og:description, og:image, og:type tags',
      howToFix: 'Add the missing Open Graph meta tags to the <head> section. At minimum, include og:title, og:description, og:image (1200x630px recommended), and og:type.',
      impact: 'Open Graph tags control how your pages look when shared on Facebook, LinkedIn, and other platforms. Good social sharing leads to more traffic and engagement.',
      effort: 'low',
    });
  }
}

function checkTwitterCard($: ReturnType<typeof parseHTML>, findings: Finding[]) {
  const twitterCard = $('meta[name="twitter:card"]').attr('content');

  if (!twitterCard) {
    findings.push({
      id: 'onpage-no-twitter-card',
      title: 'Missing Twitter/X Card Tags',
      description: 'No Twitter Card meta tags found. These control how the page appears when shared on Twitter/X.',
      severity: 'low',
      category: 'onpage',
      subcategory: 'Social',
      recommendedValue: '<meta name="twitter:card" content="summary_large_image">',
      howToFix: 'Add Twitter Card meta tags to the <head> section. At minimum: <meta name="twitter:card" content="summary_large_image">. Twitter will fall back to Open Graph tags for title, description, and image.',
      impact: 'Twitter Cards improve how your content appears when shared on Twitter/X, potentially increasing click-through rates from social shares.',
      effort: 'low',
    });
  }
}
