'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Loader2, ArrowRight } from 'lucide-react';
import { BrandMark, Wordmark } from '@/components/brand/BrandMark';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Sign in failed');
        return;
      }

      toast.success('Welcome back');
      router.push('/');
      router.refresh();
    } catch (err) {
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[100dvh] grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] bg-ink-900">
      {/* ─────── Editorial pane (hidden on mobile) ─────── */}
      <aside className="hidden lg:flex relative overflow-hidden grain hero-gradient flex-col justify-between p-12 xl:p-16">
        {/* top: wordmark */}
        <div className="relative z-10">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <BrandMark size={32} />
            <Wordmark size={20} />
          </Link>
        </div>

        {/* center: editorial pull-quote */}
        <div className="relative z-10 max-w-lg">
          <p className="eyebrow text-coral-500 mb-6">Issue No. 01</p>
          <h2 className="font-serif text-display-sm xl:text-display text-cream-50 leading-[0.98] tracking-tight text-balance">
            <span className="italic font-light">A library</span>
            <br />
            for the music
            <br />
            you actually love.
          </h2>
          <p className="mt-8 text-cream-300 leading-relaxed max-w-sm">
            Curate playlists. Share them as a single stream URL. Works in IMVU rooms,
            VLC, mobile, browsers — anywhere a player can read MP3.
          </p>
        </div>

        {/* bottom: meta line */}
        <div className="relative z-10 flex items-end justify-between text-xs text-cream-500 tracking-wider uppercase">
          <span>EgMax / Stream anywhere</span>
          <span>v1.0</span>
        </div>
      </aside>

      {/* ─────── Form pane ─────── */}
      <main className="flex items-center justify-center px-6 sm:px-12 py-12">
        <div className="w-full max-w-sm animate-fade-in-up">
          {/* Mobile-only brand */}
          <div className="lg:hidden flex flex-col items-center mb-12">
            <BrandMark size={40} />
            <Wordmark size={20} className="mt-3" />
          </div>

          <p className="eyebrow text-coral-500 mb-3">Sign in</p>
          <h1 className="font-serif text-3xl sm:text-4xl text-cream-50 tracking-tight leading-[1.05] mb-2">
            Welcome back.
          </h1>
          <p className="text-cream-300 text-sm mb-10">
            Enter your credentials to continue.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="eyebrow text-cream-500 mb-2 block">Username</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="your_username"
                autoComplete="username"
                className="input"
              />
            </div>

            <div>
              <label className="eyebrow text-cream-500 mb-2 block">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="input"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-accent w-full mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing in
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight className="w-4 h-4" strokeWidth={2} />
                </>
              )}
            </button>
          </form>

          <div className="rule mt-10 mb-6" />
          <p className="text-cream-300 text-sm text-center">
            New to EgMax?{' '}
            <Link
              href="/signup"
              className="text-coral-500 hover:text-coral-400 transition-colors font-medium"
            >
              Create an account
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
