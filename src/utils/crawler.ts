import axios, { AxiosResponse } from 'axios';
import * as cheerio from 'cheerio';
import { parseStringPromise } from 'xml2js';
import https from 'https';
import { URL } from 'url';
import type {
  CrawlResult,
  RedirectInfo,
  SSLInfo,
  RobotsTxtInfo,
  SitemapInfo,
  ToolConfig,
} from '../types.js';

/**
 * Crawls a URL and gathers all the raw data that analyzers need.
 * This is the single source of truth for fetched data -- analyzers
 * should never make their own HTTP requests.
 */
export async function crawlUrl(
  url: string,
  config: ToolConfig
): Promise<CrawlResult> {
  const normalizedUrl = normalizeUrl(url);
  const baseUrl = getBaseUrl(normalizedUrl);

  // Fetch the main page, robots.txt, and sitemap in parallel
  const startTime = Date.now();
  const redirectChain: RedirectInfo[] = [];

  const mainResponse = await fetchWithRedirects(normalizedUrl, config, redirectChain);
  const responseTime = Date.now() - startTime;

  const finalUrl = redirectChain.length > 0
    ? redirectChain[redirectChain.length - 1].to
    : normalizedUrl;

  // Check SSL
  const ssl = await checkSSL(normalizedUrl);

  // Fetch robots.txt and sitemap in parallel
  const [robotsTxt, sitemap] = await Promise.all([
    fetchRobotsTxt(baseUrl, config),
    fetchSitemap(baseUrl, config),
  ]);

  return {
    url: normalizedUrl,
    finalUrl,
    statusCode: mainResponse.status,
    redirectChain,
    html: mainResponse.data,
    headers: flattenHeaders(mainResponse.headers),
    responseTime,
    contentLength: mainResponse.data.length,
    ssl,
    robotsTxt,
    sitemap,
  };
}

/** Normalize URL to ensure it has a protocol */
function normalizeUrl(url: string): string {
  let normalized = url.trim();
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = 'https://' + normalized;
  }
  // Remove trailing slash for consistency
  return normalized.replace(/\/+$/, '');
}

/** Get base URL (protocol + hostname) */
function getBaseUrl(url: string): string {
  const parsed = new URL(url);
  return `${parsed.protocol}//${parsed.hostname}`;
}

/** Fetch URL tracking redirects */
async function fetchWithRedirects(
  url: string,
  config: ToolConfig,
  redirectChain: RedirectInfo[]
): Promise<AxiosResponse<string>> {
  const response = await axios.get<string>(url, {
    headers: {
      'User-Agent': config.userAgent,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
    timeout: config.timeout,
    maxRedirects: config.maxRedirects,
    validateStatus: () => true, // Don't throw on any status code
    // Track redirects manually
    beforeRedirect: (options: any, responseDetails: any) => {
      redirectChain.push({
        from: responseDetails.headers?.location ? url : options.href || url,
        to: responseDetails.headers?.location || options.href || '',
        statusCode: responseDetails.statusCode || 301,
      });
    },
  });

  return response;
}

/** Check SSL certificate validity */
async function checkSSL(url: string): Promise<SSLInfo> {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') {
      return { valid: false };
    }

    // First try: simple HTTPS HEAD request via axios -- if it succeeds, SSL is valid
    try {
      await axios.head(`https://${parsed.hostname}`, {
        timeout: 10000,
        validateStatus: () => true, // Accept any status
      });
      // If we got here, SSL handshake succeeded
    } catch (err: any) {
      if (err.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
          err.code === 'CERT_HAS_EXPIRED' ||
          err.code === 'ERR_TLS_CERT_ALTNAME_INVALID' ||
          err.code === 'DEPTH_ZERO_SELF_SIGNED_CERT') {
        return { valid: false };
      }
      // Other errors (network, timeout) - don't flag as SSL issue
    }

    // Try to get certificate details
    return new Promise((resolve) => {
      const req = https.request(
        {
          hostname: parsed.hostname,
          port: 443,
          method: 'HEAD',
          rejectUnauthorized: false, // Allow connection to read cert details
          timeout: 10000,
        },
        (res) => {
          const cert = (res.socket as any).getPeerCertificate?.();
          if (cert && cert.valid_to) {
            resolve({
              valid: new Date(cert.valid_to) > new Date(),
              issuer: cert.issuer?.O || cert.issuer?.CN || 'Unknown',
              expiresAt: cert.valid_to,
              protocol: (res.socket as any).getProtocol?.() || 'TLS',
            });
          } else {
            resolve({ valid: true, protocol: 'TLS' });
          }
          req.destroy();
        }
      );

      req.on('error', () => {
        // If we can't connect at all, assume SSL is valid if the URL is HTTPS
        // (the issue might be network, not SSL)
        resolve({ valid: true, protocol: 'TLS' });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ valid: true, protocol: 'TLS' });
      });

      req.end();
    });
  } catch {
    return { valid: true, protocol: 'TLS' }; // Default to valid for HTTPS URLs
  }
}

/** Fetch and parse robots.txt */
async function fetchRobotsTxt(
  baseUrl: string,
  config: ToolConfig
): Promise<RobotsTxtInfo | null> {
  try {
    const response = await axios.get<string>(`${baseUrl}/robots.txt`, {
      headers: { 'User-Agent': config.userAgent },
      timeout: config.timeout,
      validateStatus: () => true,
    });

    if (response.status !== 200) {
      return { exists: false, content: '', sitemapUrls: [], disallowedPaths: [], allowedPaths: [] };
    }

    const content = response.data;
    const lines = content.split('\n').map((l: string) => l.trim());

    const sitemapUrls: string[] = [];
    const disallowedPaths: string[] = [];
    const allowedPaths: string[] = [];
    let crawlDelay: number | undefined;

    for (const line of lines) {
      const lower = line.toLowerCase();
      if (lower.startsWith('sitemap:')) {
        sitemapUrls.push(line.substring(8).trim());
      } else if (lower.startsWith('disallow:')) {
        const path = line.substring(9).trim();
        if (path) disallowedPaths.push(path);
      } else if (lower.startsWith('allow:')) {
        const path = line.substring(6).trim();
        if (path) allowedPaths.push(path);
      } else if (lower.startsWith('crawl-delay:')) {
        crawlDelay = parseInt(line.substring(12).trim(), 10);
      }
    }

    return {
      exists: true,
      content,
      sitemapUrls,
      disallowedPaths,
      allowedPaths,
      crawlDelay: Number.isNaN(crawlDelay) ? undefined : crawlDelay,
    };
  } catch {
    return null;
  }
}

/** Fetch and parse sitemap.xml */
async function fetchSitemap(
  baseUrl: string,
  config: ToolConfig
): Promise<SitemapInfo | null> {
  const sitemapUrls = [
    `${baseUrl}/sitemap.xml`,
    `${baseUrl}/sitemap_index.xml`,
    `${baseUrl}/sitemap/sitemap.xml`,
  ];

  for (const sitemapUrl of sitemapUrls) {
    try {
      const response = await axios.get<string>(sitemapUrl, {
        headers: { 'User-Agent': config.userAgent },
        timeout: config.timeout,
        validateStatus: () => true,
      });

      if (response.status !== 200 || !response.data.includes('<?xml')) {
        continue;
      }

      const parsed = await parseStringPromise(response.data, { explicitArray: false });
      const urls: string[] = [];
      const errors: string[] = [];

      // Handle standard sitemap
      if (parsed.urlset?.url) {
        const urlEntries = Array.isArray(parsed.urlset.url)
          ? parsed.urlset.url
          : [parsed.urlset.url];
        for (const entry of urlEntries) {
          if (entry.loc) urls.push(entry.loc);
        }
      }

      // Handle sitemap index
      if (parsed.sitemapindex?.sitemap) {
        const sitemapEntries = Array.isArray(parsed.sitemapindex.sitemap)
          ? parsed.sitemapindex.sitemap
          : [parsed.sitemapindex.sitemap];
        for (const entry of sitemapEntries) {
          if (entry.loc) urls.push(entry.loc);
        }
      }

      return {
        exists: true,
        url: sitemapUrl,
        urlCount: urls.length,
        urls: urls.slice(0, 500), // Cap at 500 for memory
        errors,
      };
    } catch {
      continue;
    }
  }

  return {
    exists: false,
    url: `${baseUrl}/sitemap.xml`,
    urlCount: 0,
    urls: [],
    errors: ['No sitemap found at standard locations'],
  };
}

/** Flatten axios headers to simple Record */
function flattenHeaders(headers: any): Record<string, string> {
  const flat: Record<string, string> = {};
  if (headers) {
    for (const [key, value] of Object.entries(headers)) {
      flat[key.toLowerCase()] = String(value);
    }
  }
  return flat;
}

/** Helper to parse HTML with cheerio -- used by analyzers */
export function parseHTML(html: string): cheerio.CheerioAPI {
  return cheerio.load(html);
}

export { normalizeUrl, getBaseUrl };
