'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminDevLogin() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async () => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/dev-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Login failed');
      }

      const data = await res.json();

      // Store token and redirect to admin
      localStorage.setItem('admin_session', JSON.stringify(data.session));
      window.location.href = '/admin';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="bg-slate-800 rounded-lg shadow-xl border border-slate-700 p-8 space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white">Admin Login</h1>
            <p className="text-sm text-slate-400 mt-2">DEV MODE - Temporary Access</p>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-200">Admin Password</label>
            <Input
              type="password"
              placeholder="Enter admin dev password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleLogin();
              }}
              className="bg-slate-700 border-slate-600 text-white"
            />
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded px-4 py-3">
              <p className="text-red-200 text-sm">{error}</p>
            </div>
          )}

          <Button
            onClick={handleLogin}
            disabled={loading || !password}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            {loading ? 'Logging in...' : 'Login'}
          </Button>

          <p className="text-xs text-slate-400 text-center">
            Password is set in ADMIN_DEV_PASSWORD env var
          </p>
        </div>
      </div>
    </div>
  );
}
