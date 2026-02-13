import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'IDP SEO Dashboard',
  description: 'Agency-level SEO audit dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="container">
            <h1>IDP SEO Tool</h1>
            <nav>
              <a href="/">Dashboard</a>
              <a href="/settings">Settings</a>
            </nav>
          </div>
        </header>
        <main style={{ padding: '24px 0' }}>
          <div className="container">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
