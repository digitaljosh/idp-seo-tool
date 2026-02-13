import type { AuditReport } from '../types.js';
import fs from 'fs';
import path from 'path';

export interface PdfOptions {
  html: string;
  outputPath: string;
  report: AuditReport;
  chromePath?: string;
}

/**
 * Generate a PDF from an HTML report using Puppeteer.
 * Uses puppeteer-core to avoid bundling Chromium.
 * The user must have Chrome/Chromium installed on their system.
 *
 * Set CHROME_PATH env var or pass chromePath option to specify
 * the browser executable location.
 */
export async function generatePdf(options: PdfOptions): Promise<string> {
  const puppeteer = await import('puppeteer-core');

  // Try to find Chrome in common locations
  const chromePath = options.chromePath
    || process.env.CHROME_PATH
    || findChrome();

  if (!chromePath) {
    throw new Error(
      'Chrome/Chromium not found. Install Chrome or set CHROME_PATH environment variable.\n'
      + 'Common paths:\n'
      + '  macOS:  /Applications/Google Chrome.app/Contents/MacOS/Google Chrome\n'
      + '  Linux:  /usr/bin/google-chrome or /usr/bin/chromium-browser\n'
      + '  Windows: C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    );
  }

  const browser = await puppeteer.default.launch({
    headless: true,
    executablePath: chromePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(options.html, { waitUntil: 'networkidle0', timeout: 30000 });

    // Expand all findings and tasks so they appear in the PDF
    await page.evaluate(() => {
      document.querySelectorAll('.finding, .task').forEach(el =>
        el.classList.add('expanded')
      );
    });

    // Ensure output directory exists
    const dir = path.dirname(options.outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const hostname = new URL(options.report.url).hostname;
    const date = new Date(options.report.generatedAt).toLocaleDateString();

    await page.pdf({
      path: options.outputPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '72px', bottom: '72px', left: '48px', right: '48px' },
      displayHeaderFooter: true,
      headerTemplate: `
        <div style="font-size:9px;width:100%;text-align:center;color:#6b7280;padding:0 48px;">
          SEO Audit Report &mdash; ${hostname}
        </div>`,
      footerTemplate: `
        <div style="font-size:9px;width:100%;display:flex;justify-content:space-between;padding:0 48px;color:#6b7280;">
          <span>Generated ${date}</span>
          <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
        </div>`,
    });

    return options.outputPath;
  } finally {
    await browser.close();
  }
}

function findChrome(): string | undefined {
  const paths = [
    // Linux
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/snap/bin/chromium',
    // macOS
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    // WSL
    '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe',
    '/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  ];

  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}
