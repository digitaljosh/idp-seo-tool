'use client';

import { useState, useEffect } from 'react';

interface SettingField {
  key: string;
  label: string;
  description: string;
  type: 'text' | 'password' | 'filepath';
  placeholder: string;
}

const FIELDS: SettingField[] = [
  {
    key: 'gscKeyFile',
    label: 'Google Search Console Key File',
    description: 'Path to the service account JSON key file for GSC access',
    type: 'filepath',
    placeholder: '/path/to/gsc-service-account.json',
  },
  {
    key: 'pageSpeedApiKey',
    label: 'Google PageSpeed API Key',
    description: 'Optional — improves rate limits for performance analysis',
    type: 'password',
    placeholder: 'AIza...',
  },
  {
    key: 'dataforseoLogin',
    label: 'DataforSEO Login',
    description: 'API login from app.dataforseo.com/api-access',
    type: 'text',
    placeholder: 'your@email.com',
  },
  {
    key: 'dataforseoPassword',
    label: 'DataforSEO Password',
    description: 'API password (different from your dashboard password)',
    type: 'password',
    placeholder: 'API password',
  },
  {
    key: 'keApiKey',
    label: 'Keywords Everywhere API Key',
    description: 'API key from Keywords Everywhere browser extension settings',
    type: 'password',
    placeholder: 'Your API key',
  },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/settings');
      const data = await res.json();
      setSettings(data);
    }
    load();
  }, []);

  async function saveSetting(key: string) {
    const value = values[key];
    if (value === undefined) return;

    setSaving(key);
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value }),
    });

    setSaving(null);
    setSaved(key);
    setSettings(prev => ({ ...prev, [key]: value ? '••••••••' + value.slice(-4) : '' }));
    setValues(prev => ({ ...prev, [key]: '' }));
    setTimeout(() => setSaved(null), 2000);
  }

  return (
    <>
      <div className="card">
        <h2 style={{ fontSize: 20, marginBottom: 8 }}>API Settings</h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24 }}>
          Configure API credentials for enhanced SEO analysis. Credentials are stored locally in the SQLite database.
        </p>

        {FIELDS.map((field) => (
          <div key={field.key} style={{ marginBottom: 24, paddingBottom: 24, borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div>
                <label className="label" style={{ fontSize: 14, marginBottom: 2 }}>{field.label}</label>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{field.description}</p>
              </div>
              {settings[field.key] && (
                <span style={{ fontSize: 12, color: 'var(--success)', fontWeight: 500 }}>
                  Configured: {settings[field.key]}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                className="input"
                type={field.type === 'password' ? 'password' : 'text'}
                placeholder={field.placeholder}
                value={values[field.key] || ''}
                onChange={(e) => setValues(prev => ({ ...prev, [field.key]: e.target.value }))}
              />
              <button
                className="btn btn-primary btn-sm"
                onClick={() => saveSetting(field.key)}
                disabled={saving === field.key || !values[field.key]}
              >
                {saving === field.key ? 'Saving...' : saved === field.key ? 'Saved!' : 'Save'}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h3 style={{ fontSize: 17, marginBottom: 12 }}>How to Get API Keys</h3>

        <div style={{ fontSize: 14, lineHeight: 1.8 }}>
          <p style={{ fontWeight: 600, marginTop: 12 }}>Google Search Console</p>
          <ol style={{ marginLeft: 20, color: 'var(--text-secondary)' }}>
            <li>Go to Google Cloud Console and create a project</li>
            <li>Enable the Search Console API</li>
            <li>Create a Service Account and download the JSON key file</li>
            <li>Add the service account email as a user in Search Console</li>
            <li>Enter the path to the JSON file above</li>
          </ol>

          <p style={{ fontWeight: 600, marginTop: 16 }}>DataforSEO</p>
          <ol style={{ marginLeft: 20, color: 'var(--text-secondary)' }}>
            <li>Sign up at dataforseo.com (includes $1 free credit)</li>
            <li>Go to app.dataforseo.com/api-access</li>
            <li>Copy your API login and password</li>
          </ol>

          <p style={{ fontWeight: 600, marginTop: 16 }}>Keywords Everywhere</p>
          <ol style={{ marginLeft: 20, color: 'var(--text-secondary)' }}>
            <li>Install the Keywords Everywhere browser extension</li>
            <li>Purchase credits ($10 = 100K lookups)</li>
            <li>Find your API key in the extension settings</li>
          </ol>
        </div>
      </div>
    </>
  );
}
