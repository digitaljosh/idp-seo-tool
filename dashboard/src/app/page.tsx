'use client';

import { useState, useEffect, useCallback } from 'react';

interface AuditRow {
  id: number;
  url: string;
  final_url: string | null;
  overall_score: number | null;
  status: string;
  created_at: string;
  completed_at: string | null;
  error: string | null;
}

export default function DashboardPage() {
  const [audits, setAudits] = useState<AuditRow[]>([]);
  const [url, setUrl] = useState('');
  const [competitors, setCompetitors] = useState('');
  const [loading, setLoading] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [skipPerformance, setSkipPerformance] = useState(false);
  const [skipGsc, setSkipGsc] = useState(false);
  const [skipBacklinks, setSkipBacklinks] = useState(false);
  const [skipKeywords, setSkipKeywords] = useState(false);

  const loadAudits = useCallback(async () => {
    const res = await fetch('/api/audits');
    const data = await res.json();
    setAudits(data);
  }, []);

  useEffect(() => {
    loadAudits();
    // Refresh every 5 seconds while any audit is running
    const interval = setInterval(() => {
      loadAudits();
    }, 5000);
    return () => clearInterval(interval);
  }, [loadAudits]);

  async function startAudit() {
    if (!url.trim()) return;
    setLoading(true);
    setProgressText('Starting audit...');

    const competitorList = competitors
      .split(',')
      .map(c => c.trim())
      .filter(c => c.length > 0);

    const res = await fetch('/api/audits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: url.trim(),
        competitors: competitorList.length > 0 ? competitorList : undefined,
        skipPerformance,
        skipGsc,
        skipBacklinks,
        skipKeywords,
      }),
    });

    const data = await res.json();
    const auditId = data.id;

    // Subscribe to SSE progress
    const eventSource = new EventSource(`/api/audits/${auditId}/stream`);
    eventSource.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      setProgressText(msg.detail || msg.step);

      if (msg.step === 'complete' || msg.step === 'error') {
        eventSource.close();
        setLoading(false);
        setProgressText('');
        loadAudits();
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      setLoading(false);
      setProgressText('');
      loadAudits();
    };

    setUrl('');
    setCompetitors('');
    loadAudits();
  }

  async function deleteAudit(id: number) {
    await fetch(`/api/audits/${id}`, { method: 'DELETE' });
    loadAudits();
  }

  function getScoreClass(score: number | null): string {
    if (score === null) return '';
    if (score >= 80) return 'score-green';
    if (score >= 60) return 'score-yellow';
    return 'score-red';
  }

  function getGrade(score: number): string {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  return (
    <>
      {/* New Audit Form */}
      <div className="card">
        <h2 style={{ fontSize: 18, marginBottom: 16 }}>Run New Audit</h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label className="label">URL to Audit</label>
            <input
              className="input"
              type="url"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && startAudit()}
              disabled={loading}
            />
          </div>
          <button
            className="btn btn-primary"
            onClick={startAudit}
            disabled={loading || !url.trim()}
          >
            {loading ? 'Running...' : 'Start Audit'}
          </button>
        </div>

        <div style={{ marginTop: 12 }}>
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => setShowAdvanced(!showAdvanced)}
            style={{ fontSize: 12 }}
          >
            {showAdvanced ? 'Hide' : 'Show'} Advanced Options
          </button>
        </div>

        {showAdvanced && (
          <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-group">
              <label className="label">Competitor URLs (comma-separated)</label>
              <input
                className="input"
                type="text"
                placeholder="https://competitor1.com, https://competitor2.com"
                value={competitors}
                onChange={(e) => setCompetitors(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 24 }}>
              <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={skipPerformance} onChange={(e) => setSkipPerformance(e.target.checked)} />
                Skip performance analysis (faster)
              </label>
              <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={skipGsc} onChange={(e) => setSkipGsc(e.target.checked)} />
                Skip Google Search Console
              </label>
              <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={skipBacklinks} onChange={(e) => setSkipBacklinks(e.target.checked)} />
                Skip backlink analysis
              </label>
              <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={skipKeywords} onChange={(e) => setSkipKeywords(e.target.checked)} />
                Skip keyword intelligence
              </label>
            </div>
          </div>
        )}

        {loading && progressText && (
          <div className="progress-container">
            <div className="progress-step">
              <span className="progress-dot active" />
              <span>{progressText}</span>
            </div>
          </div>
        )}
      </div>

      {/* Audit History */}
      <div className="card">
        <h2 style={{ fontSize: 18, marginBottom: 16 }}>Audit History</h2>

        {audits.length === 0 ? (
          <div className="empty-state">
            <h3>No audits yet</h3>
            <p>Enter a URL above to run your first SEO audit.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>URL</th>
                <th>Score</th>
                <th>Status</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {audits.map((audit) => (
                <tr key={audit.id}>
                  <td>
                    <a href={`/audit/${audit.id}`} style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 500 }}>
                      {audit.url}
                    </a>
                  </td>
                  <td>
                    {audit.overall_score !== null ? (
                      <span className={`score-badge ${getScoreClass(audit.overall_score)}`} style={{ width: 40, height: 40, fontSize: 15 }}>
                        {audit.overall_score}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>—</span>
                    )}
                  </td>
                  <td>
                    <span className={`status-badge status-${audit.status}`}>
                      {audit.status}
                    </span>
                    {audit.error && (
                      <span style={{ fontSize: 12, color: 'var(--danger)', display: 'block', marginTop: 4 }}>
                        {audit.error.slice(0, 60)}
                      </span>
                    )}
                  </td>
                  <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    {new Date(audit.created_at).toLocaleDateString()}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {audit.status === 'complete' && (
                        <>
                          <a href={`/audit/${audit.id}`} className="btn btn-sm btn-secondary">View</a>
                          <a href={`/api/audits/${audit.id}/report`} target="_blank" className="btn btn-sm btn-secondary">HTML</a>
                        </>
                      )}
                      <button className="btn btn-sm btn-danger" onClick={() => deleteAudit(audit.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
