import type { CrawlResult, Finding, AnalyzerResult } from '../types.js';
import { parseHTML } from '../utils/crawler.js';
import { calculateCategoryScore, getScoreSummary } from '../utils/scoring.js';

/**
 * Technical SEO Analyzer
 *
 * Checks: SSL, robots.txt, sitemap, canonical tags, meta robots,
 * redirect chains, HTTP headers, viewport, language, hreflang
 */
export function analyzeTechnical(crawl: CrawlResult): AnalyzerResult {
  const findings: Finding[] = [];
  const $ = parseHTML(crawl.html);

  // --- SSL / HTTPS ---
  checkSSL(crawl, findings);

  // --- HTTP Status ---
  checkHTTPStatus(crawl, findings);

  // --- Redirect Chain ---
  checkRedirects(crawl, findings);

  // --- Robots.txt ---
  checkRobotsTxt(crawl, findings);

  // --- Sitemap ---
  checkSitemap(crawl, findings);

  // --- Canonical Tag ---
  checkCanonical($, crawl, findings);

  // --- Meta Robots ---
  checkMetaRobots($, findings);

  // --- Viewport Meta ---
  checkViewport($, findings);

  // --- Language Declaration ---
  checkLanguage($, findings);

  // --- HTTP Headers ---
  checkHeaders(crawl, findings);

  // --- HTTPS Redirect ---
  checkHTTPSRedirect(crawl, findings);

  const score = calculateCategoryScore(findings);

  return {
    category: 'technical',
    categoryLabel: 'Technical SEO',
    score,
    maxScore: 100,
    findings,
    summary: getScoreSummary('Technical SEO', score),
  };
}

function checkSSL(crawl: CrawlResult, findings: Finding[]) {
  if (!crawl.ssl.valid) {
    findings.push({
      id: 'tech-ssl-invalid',
      title: 'SSL Certificate Issue',
      description: 'The SSL certificate is missing, expired, or invalid. This directly impacts search rankings and user trust.',
      severity: 'critical',
      category: 'technical',
      subcategory: 'Security',
      currentValue: 'Invalid or missing SSL',
      recommendedValue: 'Valid SSL certificate',
      howToFix: 'Install a valid SSL certificate. Most hosting providers offer free SSL via Let\'s Encrypt. Ensure all pages load over HTTPS.',
      impact: 'Google uses HTTPS as a ranking signal. Users see security warnings on non-HTTPS sites, dramatically increasing bounce rates.',
      effort: 'low',
    });
  } else {
    // Check if SSL expires soon
    if (crawl.ssl.expiresAt) {
      const expiresDate = new Date(crawl.ssl.expiresAt);
      const daysUntilExpiry = Math.ceil((expiresDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysUntilExpiry < 30) {
        findings.push({
          id: 'tech-ssl-expiring',
          title: 'SSL Certificate Expiring Soon',
          description: `SSL certificate expires in ${daysUntilExpiry} days (${crawl.ssl.expiresAt}).`,
          severity: 'high',
          category: 'technical',
          subcategory: 'Security',
          currentValue: `Expires in ${daysUntilExpiry} days`,
          recommendedValue: 'Auto-renewing SSL certificate',
          howToFix: 'Renew the SSL certificate immediately. Set up auto-renewal to prevent future lapses.',
          impact: 'An expired SSL will trigger browser warnings and can cause the site to become inaccessible, directly impacting traffic and rankings.',
          effort: 'low',
        });
      }
    }
  }

  if (!crawl.url.startsWith('https://')) {
    findings.push({
      id: 'tech-no-https',
      title: 'Site Not Using HTTPS',
      description: 'The site is accessed over HTTP instead of HTTPS.',
      severity: 'critical',
      category: 'technical',
      subcategory: 'Security',
      currentValue: 'HTTP',
      recommendedValue: 'HTTPS',
      howToFix: 'Install an SSL certificate and configure the server to redirect all HTTP requests to HTTPS. Update internal links to use HTTPS.',
      impact: 'HTTPS is a confirmed Google ranking factor. Non-HTTPS sites are flagged as "Not Secure" in browsers.',
      effort: 'medium',
    });
  }
}

function checkHTTPStatus(crawl: CrawlResult, findings: Finding[]) {
  if (crawl.statusCode >= 400) {
    findings.push({
      id: 'tech-http-error',
      title: `Page Returns HTTP ${crawl.statusCode} Error`,
      description: `The target URL returned a ${crawl.statusCode} status code instead of 200 OK.`,
      severity: 'critical',
      category: 'technical',
      subcategory: 'Accessibility',
      currentValue: `HTTP ${crawl.statusCode}`,
      recommendedValue: 'HTTP 200',
      howToFix: crawl.statusCode === 404
        ? 'The page does not exist. Verify the URL is correct, or set up a redirect to the correct page.'
        : 'Investigate the server error. Check server logs, hosting configuration, and ensure the page is properly deployed.',
      impact: 'Pages returning error codes cannot be indexed by search engines and provide a poor user experience.',
      effort: 'medium',
    });
  } else if (crawl.statusCode >= 300 && crawl.statusCode < 400) {
    // The page itself is a redirect -- note this as info
    findings.push({
      id: 'tech-is-redirect',
      title: 'URL Redirects to Another Page',
      description: `The audited URL (${crawl.url}) redirects to ${crawl.finalUrl}.`,
      severity: 'info',
      category: 'technical',
      subcategory: 'Redirects',
      currentValue: `Redirects to ${crawl.finalUrl}`,
      howToFix: 'Ensure this is intentional. Update any links pointing to the old URL to use the final destination URL instead.',
      impact: 'Redirect chains can slow down crawling and dilute link equity.',
      effort: 'low',
    });
  }
}

function checkRedirects(crawl: CrawlResult, findings: Finding[]) {
  if (crawl.redirectChain.length > 2) {
    findings.push({
      id: 'tech-redirect-chain',
      title: 'Long Redirect Chain Detected',
      description: `The URL goes through ${crawl.redirectChain.length} redirects before reaching the final page. Each redirect adds latency and can lose link equity.`,
      severity: 'medium',
      category: 'technical',
      subcategory: 'Redirects',
      currentValue: `${crawl.redirectChain.length} redirects`,
      recommendedValue: '0-1 redirects',
      howToFix: 'Update redirects to point directly to the final destination. Remove intermediate redirects. Redirect chain: ' +
        crawl.redirectChain.map(r => `${r.from} → ${r.to} (${r.statusCode})`).join(' → '),
      impact: 'Long redirect chains slow page loading, waste crawl budget, and can cause Googlebot to stop following the chain.',
      effort: 'medium',
    });
  }
}

function checkRobotsTxt(crawl: CrawlResult, findings: Finding[]) {
  if (!crawl.robotsTxt || !crawl.robotsTxt.exists) {
    findings.push({
      id: 'tech-no-robots',
      title: 'Missing robots.txt File',
      description: 'No robots.txt file was found at the root of the domain.',
      severity: 'medium',
      category: 'technical',
      subcategory: 'Crawlability',
      recommendedValue: 'A properly configured robots.txt file',
      howToFix: 'Create a robots.txt file at the root of your domain. At minimum, include:\n\nUser-agent: *\nAllow: /\n\nSitemap: https://yourdomain.com/sitemap.xml',
      impact: 'robots.txt helps search engines understand which pages to crawl. Without it, search engines may crawl unnecessary pages, wasting crawl budget.',
      effort: 'low',
    });
  } else {
    // Check if robots.txt blocks important pages
    const blockedImportant = crawl.robotsTxt.disallowedPaths.filter(
      p => p === '/' || p === '/*' || p === '/index'
    );
    if (blockedImportant.length > 0) {
      findings.push({
        id: 'tech-robots-blocking',
        title: 'robots.txt Blocks Critical Pages',
        description: `The robots.txt file blocks access to critical paths: ${blockedImportant.join(', ')}. This prevents search engines from indexing the site.`,
        severity: 'critical',
        category: 'technical',
        subcategory: 'Crawlability',
        currentValue: `Blocking: ${blockedImportant.join(', ')}`,
        recommendedValue: 'Allow crawling of important pages',
        howToFix: 'Review your robots.txt and remove or modify Disallow rules that block important content. Be careful not to block CSS, JS, or image files that search engines need to render pages.',
        impact: 'Blocking search engine access to your site content directly prevents indexing and ranking.',
        effort: 'low',
      });
    }

    // Check if robots.txt references a sitemap
    if (crawl.robotsTxt.sitemapUrls.length === 0) {
      findings.push({
        id: 'tech-robots-no-sitemap',
        title: 'robots.txt Does Not Reference Sitemap',
        description: 'The robots.txt file does not include a Sitemap directive.',
        severity: 'low',
        category: 'technical',
        subcategory: 'Crawlability',
        recommendedValue: 'Sitemap: https://yourdomain.com/sitemap.xml',
        howToFix: 'Add a Sitemap directive to your robots.txt file pointing to your XML sitemap. Example:\n\nSitemap: https://yourdomain.com/sitemap.xml',
        impact: 'Adding the sitemap URL to robots.txt helps search engines discover your sitemap faster.',
        effort: 'low',
      });
    }
  }
}

function checkSitemap(crawl: CrawlResult, findings: Finding[]) {
  if (!crawl.sitemap || !crawl.sitemap.exists) {
    findings.push({
      id: 'tech-no-sitemap',
      title: 'Missing XML Sitemap',
      description: 'No XML sitemap was found at standard locations (/sitemap.xml, /sitemap_index.xml).',
      severity: 'high',
      category: 'technical',
      subcategory: 'Crawlability',
      recommendedValue: 'A valid XML sitemap at /sitemap.xml',
      howToFix: 'Create an XML sitemap listing all important pages on the site. Most CMS platforms (WordPress, Shopify, etc.) can generate this automatically. Submit the sitemap to Google Search Console.',
      impact: 'XML sitemaps help search engines discover and index all your important pages. Sites without sitemaps may have pages that never get crawled.',
      effort: 'medium',
    });
  } else if (crawl.sitemap.urlCount === 0) {
    findings.push({
      id: 'tech-empty-sitemap',
      title: 'XML Sitemap Is Empty',
      description: 'The sitemap was found but contains no URLs.',
      severity: 'high',
      category: 'technical',
      subcategory: 'Crawlability',
      currentValue: '0 URLs in sitemap',
      recommendedValue: 'All indexable pages listed',
      howToFix: 'Populate the sitemap with all pages you want search engines to index. Remove noindexed pages. Ensure the sitemap is being generated correctly by your CMS.',
      impact: 'An empty sitemap provides no value and may signal issues with the site\'s CMS or deployment configuration.',
      effort: 'medium',
    });
  }
}

function checkCanonical($: ReturnType<typeof parseHTML>, crawl: CrawlResult, findings: Finding[]) {
  const canonical = $('link[rel="canonical"]').attr('href');

  if (!canonical) {
    findings.push({
      id: 'tech-no-canonical',
      title: 'Missing Canonical Tag',
      description: 'The page does not have a canonical tag. This can lead to duplicate content issues.',
      severity: 'medium',
      category: 'technical',
      subcategory: 'Indexing',
      recommendedValue: `<link rel="canonical" href="${crawl.finalUrl}" />`,
      howToFix: 'Add a canonical tag in the <head> section of every page. The canonical URL should point to the preferred version of the page. Self-referencing canonicals are recommended.',
      impact: 'Without canonical tags, search engines may index duplicate versions of your pages, diluting ranking signals and wasting crawl budget.',
      effort: 'low',
    });
  } else {
    // Check if canonical is self-referencing or points elsewhere
    try {
      const canonicalUrl = new URL(canonical, crawl.finalUrl).href;
      if (canonicalUrl !== crawl.finalUrl && canonicalUrl !== crawl.finalUrl + '/') {
        findings.push({
          id: 'tech-canonical-mismatch',
          title: 'Canonical Points to Different URL',
          description: `The canonical tag points to ${canonicalUrl}, which is different from the current page URL (${crawl.finalUrl}).`,
          severity: 'info',
          category: 'technical',
          subcategory: 'Indexing',
          currentValue: canonicalUrl,
          recommendedValue: crawl.finalUrl,
          howToFix: 'Verify this is intentional. If this page should be indexed, update the canonical to be self-referencing. If this page is a duplicate, the canonical correctly points to the primary version.',
          impact: 'A non-self-referencing canonical tells search engines to index the canonical URL instead of this page.',
          effort: 'low',
        });
      }
    } catch {
      findings.push({
        id: 'tech-canonical-invalid',
        title: 'Invalid Canonical URL',
        description: `The canonical tag contains an invalid URL: ${canonical}`,
        severity: 'medium',
        category: 'technical',
        subcategory: 'Indexing',
        currentValue: canonical,
        recommendedValue: 'A valid absolute URL',
        howToFix: 'Fix the canonical tag to contain a valid, absolute URL (including https:// prefix).',
        impact: 'An invalid canonical tag is ignored by search engines, defeating its purpose.',
        effort: 'low',
      });
    }
  }
}

function checkMetaRobots($: ReturnType<typeof parseHTML>, findings: Finding[]) {
  const metaRobots = $('meta[name="robots"]').attr('content') || '';
  const metaGooglebot = $('meta[name="googlebot"]').attr('content') || '';

  const combined = `${metaRobots} ${metaGooglebot}`.toLowerCase();

  if (combined.includes('noindex')) {
    findings.push({
      id: 'tech-noindex',
      title: 'Page Is Set to Noindex',
      description: 'The page has a noindex directive, which prevents search engines from indexing it.',
      severity: 'critical',
      category: 'technical',
      subcategory: 'Indexing',
      currentValue: metaRobots || metaGooglebot,
      recommendedValue: 'index, follow',
      howToFix: 'Remove the noindex directive from the meta robots tag if this page should appear in search results. Change to: <meta name="robots" content="index, follow">',
      impact: 'A noindex tag completely prevents the page from appearing in search results. This is correct for admin pages but harmful for content pages.',
      effort: 'low',
    });
  }

  if (combined.includes('nofollow')) {
    findings.push({
      id: 'tech-nofollow',
      title: 'Page Has Nofollow Directive',
      description: 'The page has a nofollow meta tag, preventing search engines from following links on this page.',
      severity: 'medium',
      category: 'technical',
      subcategory: 'Indexing',
      currentValue: metaRobots || metaGooglebot,
      recommendedValue: 'index, follow',
      howToFix: 'Remove the nofollow directive if you want search engines to discover and crawl pages linked from this page.',
      impact: 'Nofollow prevents link equity from flowing to linked pages, which can hurt their ability to rank.',
      effort: 'low',
    });
  }
}

function checkViewport($: ReturnType<typeof parseHTML>, findings: Finding[]) {
  const viewport = $('meta[name="viewport"]').attr('content');

  if (!viewport) {
    findings.push({
      id: 'tech-no-viewport',
      title: 'Missing Viewport Meta Tag',
      description: 'The page does not have a viewport meta tag, which is required for proper mobile rendering.',
      severity: 'high',
      category: 'technical',
      subcategory: 'Mobile',
      recommendedValue: '<meta name="viewport" content="width=device-width, initial-scale=1">',
      howToFix: 'Add a viewport meta tag to the <head> section of every page:\n<meta name="viewport" content="width=device-width, initial-scale=1">',
      impact: 'Without a viewport tag, the site won\'t render correctly on mobile devices. Google uses mobile-first indexing, so this directly impacts rankings.',
      effort: 'low',
    });
  }
}

function checkLanguage($: ReturnType<typeof parseHTML>, findings: Finding[]) {
  const htmlLang = $('html').attr('lang');

  if (!htmlLang) {
    findings.push({
      id: 'tech-no-lang',
      title: 'Missing HTML Language Attribute',
      description: 'The <html> tag does not specify a language attribute.',
      severity: 'low',
      category: 'technical',
      subcategory: 'Accessibility',
      recommendedValue: '<html lang="en">',
      howToFix: 'Add a lang attribute to the <html> tag. Use the appropriate ISO 639-1 language code (e.g., "en" for English, "es" for Spanish).',
      impact: 'The lang attribute helps search engines understand the page language and is important for accessibility (screen readers).',
      effort: 'low',
    });
  }
}

function checkHeaders(crawl: CrawlResult, findings: Finding[]) {
  // Check X-Robots-Tag header
  const xRobotsTag = crawl.headers['x-robots-tag'];
  if (xRobotsTag && xRobotsTag.toLowerCase().includes('noindex')) {
    findings.push({
      id: 'tech-header-noindex',
      title: 'X-Robots-Tag Header Prevents Indexing',
      description: 'The server sends an X-Robots-Tag HTTP header with noindex, preventing search engines from indexing this page.',
      severity: 'critical',
      category: 'technical',
      subcategory: 'Indexing',
      currentValue: xRobotsTag,
      recommendedValue: 'Remove noindex from X-Robots-Tag header',
      howToFix: 'Remove the X-Robots-Tag: noindex header from the server configuration. This is typically set in the web server config (Apache, Nginx) or application code.',
      impact: 'This header-level noindex overrides all other indexing signals and completely prevents the page from appearing in search results.',
      effort: 'medium',
    });
  }

  // Check if server exposes version info
  const server = crawl.headers['server'];
  const xPoweredBy = crawl.headers['x-powered-by'];
  if (xPoweredBy) {
    findings.push({
      id: 'tech-powered-by',
      title: 'Server Exposes Technology Version',
      description: `The X-Powered-By header reveals: "${xPoweredBy}". This is a minor security concern.`,
      severity: 'low',
      category: 'technical',
      subcategory: 'Security',
      currentValue: xPoweredBy,
      recommendedValue: 'Remove X-Powered-By header',
      howToFix: 'Remove or suppress the X-Powered-By header in your server configuration. In Express.js: app.disable("x-powered-by"). In PHP: header_remove("X-Powered-By").',
      impact: 'Exposing server technology can give attackers information about potential vulnerabilities. Minor SEO impact but a security best practice.',
      effort: 'low',
    });
  }

  // Check for content-security-policy
  if (!crawl.headers['content-security-policy']) {
    findings.push({
      id: 'tech-no-csp',
      title: 'Missing Content Security Policy',
      description: 'No Content-Security-Policy header detected.',
      severity: 'low',
      category: 'technical',
      subcategory: 'Security',
      recommendedValue: 'A Content-Security-Policy header',
      howToFix: 'Add a Content-Security-Policy header to your server responses. Start with a report-only mode to identify issues before enforcing.',
      impact: 'CSP helps prevent XSS attacks. While not a direct ranking factor, security issues can lead to site compromise which destroys SEO.',
      effort: 'high',
    });
  }
}

function checkHTTPSRedirect(crawl: CrawlResult, findings: Finding[]) {
  // If the original URL was HTTP but we ended up on HTTPS, that's good
  // If we started with HTTPS but there's no redirect from HTTP, note it
  if (crawl.url.startsWith('https://') && crawl.redirectChain.length === 0) {
    // This is fine - site is on HTTPS and no unnecessary redirects
  }
}
