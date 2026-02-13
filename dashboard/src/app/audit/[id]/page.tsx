'use client';

import { useState, useEffect, use } from 'react';

interface AuditDetail {
  id: number;
  url: string;
  final_url: string | null;
  overall_score: number | null;
  status: string;
  created_at: string;
  completed_at: string | null;
  error: string | null;
  report?: any;
}

export default function AuditDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [audit, setAudit] = useState<AuditDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/audits/${id}`);
      if (res.ok) {
        setAudit(await res.json());
      }
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) return <div className="card"><p>Loading...</p></div>;
  if (!audit) return <div className="card"><p>Audit not found.</p></div>;
  if (audit.status === 'running') return <RunningState audit={audit} id={id} />;
  if (audit.status === 'error') return <ErrorState audit={audit} />;

  const report = audit.report;
  if (!report) return <div className="card"><p>Report data not available.</p></div>;

  return (
    <>
      {/* Header */}
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Audit: {audit.url}</h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
            {report.finalUrl} &middot; {new Date(audit.created_at).toLocaleDateString()}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div className={`score-badge ${scoreClass(report.overallScore)}`} style={{ width: 64, height: 64, fontSize: 24 }}>
            {report.overallScore}
          </div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{getGrade(report.overallScore)}</div>
          <a href={`/api/audits/${id}/report`} target="_blank" className="btn btn-primary">
            View Full Report
          </a>
        </div>
      </div>

      {/* Category Scores */}
      <div className="card">
        <h3 style={{ fontSize: 17, marginBottom: 16 }}>Category Scores</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          {report.categories.map((cat: any) => (
            <div
              key={cat.category}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: 16,
                borderRadius: 10, background: '#f8f9fa', border: '1px solid var(--border)',
              }}
            >
              <span className={`score-badge ${scoreClass(cat.score)}`} style={{ width: 48, height: 48, fontSize: 16 }}>
                {cat.score}
              </span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{cat.categoryLabel}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {cat.findings.length} findings
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Findings Summary */}
      <div className="card">
        <h3 style={{ fontSize: 17, marginBottom: 16 }}>Key Findings</h3>
        {report.categories.map((cat: any) => (
          <div key={cat.category} style={{ marginBottom: 20 }}>
            <h4 style={{ fontSize: 15, color: 'var(--text)', marginBottom: 8 }}>
              {cat.categoryLabel}
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 400, marginLeft: 8 }}>
                Score: {cat.score}/100
              </span>
            </h4>
            {cat.findings.length === 0 ? (
              <p style={{ color: 'var(--success)', fontSize: 13, fontStyle: 'italic' }}>No issues found.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {cat.findings.map((f: any) => (
                  <div
                    key={f.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                      borderRadius: 6, border: '1px solid #f3f4f6', fontSize: 14,
                    }}
                  >
                    <span style={{
                      padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                      color: 'white', textTransform: 'uppercase',
                      background: sevColor(f.severity),
                    }}>
                      {f.severity}
                    </span>
                    <span style={{ flex: 1 }}>{f.title}</span>
                    <span style={{
                      padding: '2px 8px', borderRadius: 10, fontSize: 11,
                      background: f.effort === 'low' ? '#dcfce7' : f.effort === 'medium' ? '#fef9c3' : '#fee2e2',
                      color: f.effort === 'low' ? '#16a34a' : f.effort === 'medium' ? '#a16207' : '#dc2626',
                    }}>
                      {f.effort} effort
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* GSC Data */}
      {report.gscData && (
        <div className="card">
          <h3 style={{ fontSize: 17, marginBottom: 16 }}>Search Console (Last 90 Days)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
            <MetricCard label="Total Clicks" value={report.gscData.searchAnalytics.totalClicks.toLocaleString()} />
            <MetricCard label="Impressions" value={report.gscData.searchAnalytics.totalImpressions.toLocaleString()} />
            <MetricCard label="Average CTR" value={`${report.gscData.searchAnalytics.averageCtr}%`} />
            <MetricCard label="Avg Position" value={report.gscData.searchAnalytics.averagePosition.toString()} />
          </div>
          <h4 style={{ fontSize: 14, marginBottom: 8 }}>Top Queries</h4>
          <table className="data-table">
            <thead>
              <tr><th>Query</th><th>Clicks</th><th>Impressions</th><th>CTR</th><th>Position</th></tr>
            </thead>
            <tbody>
              {report.gscData.searchAnalytics.topQueries.slice(0, 15).map((q: any) => (
                <tr key={q.query}>
                  <td>{q.query}</td>
                  <td className="num">{q.clicks}</td>
                  <td className="num">{q.impressions}</td>
                  <td className="num">{q.ctr}%</td>
                  <td className="num">{q.position}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Backlink Data */}
      {report.backlinkData && (
        <div className="card">
          <h3 style={{ fontSize: 17, marginBottom: 16 }}>Backlink Profile</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
            <MetricCard label="Total Backlinks" value={report.backlinkData.totalBacklinks.toLocaleString()} />
            <MetricCard label="Referring Domains" value={report.backlinkData.referringDomains.toLocaleString()} />
            <MetricCard label="Domain Rank" value={`${report.backlinkData.domainRank}/100`} />
            <MetricCard label="Broken Links" value={report.backlinkData.brokenBacklinks.toLocaleString()} />
          </div>
          {report.backlinkData.topReferringDomains.length > 0 && (
            <>
              <h4 style={{ fontSize: 14, marginBottom: 8 }}>Top Referring Domains</h4>
              <table className="data-table">
                <thead><tr><th>Domain</th><th>Backlinks</th><th>Rank</th></tr></thead>
                <tbody>
                  {report.backlinkData.topReferringDomains.slice(0, 10).map((d: any) => (
                    <tr key={d.domain}><td>{d.domain}</td><td className="num">{d.backlinks}</td><td className="num">{d.rank}</td></tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {/* Competitor Comparison */}
      {report.comparison && (
        <div className="card">
          <h3 style={{ fontSize: 17, marginBottom: 16 }}>Competitor Comparison</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>You</th>
                {report.comparison.competitors.map((c: any) => (
                  <th key={c.url}>{new URL(c.url).hostname}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.comparison.categoryComparison.map((cat: any) => (
                <tr key={cat.category}>
                  <td>{cat.categoryLabel}</td>
                  <td className="num" style={{ fontWeight: 700, color: scoreColorHex(cat.clientScore) }}>{cat.clientScore}</td>
                  {cat.competitorScores.map((cs: any) => (
                    <td key={cs.url} className="num" style={{ color: scoreColorHex(cs.score) }}>{cs.score}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Task Plan */}
      {report.taskPlan && (
        <div className="card">
          <h3 style={{ fontSize: 17, marginBottom: 8 }}>Task Plan</h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
            {report.taskPlan.summary} &middot; ~{report.taskPlan.totalEstimatedHours}h total
          </p>
          {(['starting-point', 'month-2', 'month-3', 'month-4', 'month-5', 'month-6'] as const).map((phase) => {
            const tasks = report.taskPlan.monthlyTasks[phase] || [];
            if (tasks.length === 0) return null;
            const labels: Record<string, string> = {
              'starting-point': 'Month 1: Starting Point',
              'month-2': 'Month 2', 'month-3': 'Month 3',
              'month-4': 'Month 4', 'month-5': 'Month 5', 'month-6': 'Month 6',
            };
            return (
              <div key={phase} style={{ marginBottom: 16 }}>
                <h4 style={{ fontSize: 14, marginBottom: 8, borderBottom: '2px solid var(--text)', paddingBottom: 4 }}>
                  {labels[phase]}
                  <span style={{ fontWeight: 400, color: 'var(--text-secondary)', marginLeft: 8, fontSize: 12 }}>
                    {tasks.length} tasks &middot; ~{tasks.reduce((s: number, t: any) => s + t.estimatedHours, 0)}h
                  </span>
                </h4>
                {tasks.map((t: any) => (
                  <div key={t.id} style={{ padding: '8px 0', borderBottom: '1px solid #f3f4f6', fontSize: 14 }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, color: 'white', marginRight: 8,
                      background: t.priority > 70 ? '#dc2626' : t.priority > 40 ? '#ca8a04' : '#2563eb',
                    }}>
                      P{t.priority > 70 ? '1' : t.priority > 40 ? '2' : '3'}
                    </span>
                    {t.title}
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 8 }}>
                      {t.effort} &middot; ~{t.estimatedHours}h
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// Helper components
function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ textAlign: 'center', padding: 16, borderRadius: 10, background: '#f0f9ff', border: '1px solid #bae6fd' }}>
      <div style={{ fontSize: 24, fontWeight: 800, color: '#0369a1' }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{label}</div>
    </div>
  );
}

function RunningState({ audit, id }: { audit: AuditDetail; id: string }) {
  const [progress, setProgress] = useState('Starting audit...');

  useEffect(() => {
    const eventSource = new EventSource(`/api/audits/${id}/stream`);
    eventSource.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      setProgress(msg.detail || msg.step);
      if (msg.step === 'complete' || msg.step === 'error') {
        eventSource.close();
        window.location.reload();
      }
    };
    eventSource.onerror = () => {
      eventSource.close();
      setTimeout(() => window.location.reload(), 2000);
    };
    return () => eventSource.close();
  }, [id]);

  return (
    <div className="card" style={{ textAlign: 'center', padding: 48 }}>
      <div className="progress-dot active" style={{ width: 16, height: 16, margin: '0 auto 16px' }} />
      <h2 style={{ fontSize: 20, marginBottom: 8 }}>Audit Running</h2>
      <p style={{ color: 'var(--text-secondary)' }}>{audit.url}</p>
      <p style={{ marginTop: 16, fontSize: 14 }}>{progress}</p>
    </div>
  );
}

function ErrorState({ audit }: { audit: AuditDetail }) {
  return (
    <div className="card" style={{ borderColor: 'var(--danger)' }}>
      <h2 style={{ fontSize: 20, color: 'var(--danger)', marginBottom: 8 }}>Audit Failed</h2>
      <p style={{ color: 'var(--text-secondary)' }}>{audit.url}</p>
      <p style={{ marginTop: 12, color: 'var(--danger)', fontSize: 14 }}>{audit.error}</p>
      <a href="/" className="btn btn-secondary" style={{ marginTop: 16 }}>Back to Dashboard</a>
    </div>
  );
}

// Utility functions
function scoreClass(score: number): string {
  if (score >= 80) return 'score-green';
  if (score >= 60) return 'score-yellow';
  return 'score-red';
}

function scoreColorHex(score: number): string {
  if (score >= 80) return '#16a34a';
  if (score >= 60) return '#ca8a04';
  return '#dc2626';
}

function getGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

function sevColor(severity: string): string {
  switch (severity) {
    case 'critical': return '#dc2626';
    case 'high': return '#ea580c';
    case 'medium': return '#ca8a04';
    case 'low': return '#2563eb';
    default: return '#6b7280';
  }
}
