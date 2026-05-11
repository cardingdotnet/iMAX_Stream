'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Loader2, ArrowRight } from 'lucide-react';
import { BrandMark, Wordmark } from '@/components/brand/BrandMark';

export default function SignupPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const signupRes = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const signupData = await signupRes.json();

      if (!signupRes.ok) {
        toast.error(signupData.error || 'Signup failed');
        return;
      }

      const loginRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!loginRes.ok) {
        toast.success('Account created. Please sign in.');
        router.push('/login');
        return;
      }

      toast.success('Welcome to EgMax');
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
      {/* Editorial pane */}
      <aside className="hidden lg:flex relative overflow-hidden grain hero-gradient flex-col justify-between p-12 xl:p-16">
        <div className="relative z-10">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <BrandMark size={32} />
            <Wordmark size={20} />
          </Link>
        </div>

        <div className="relative z-10 max-w-lg">
          <p className="eyebrow text-coral-500 mb-6">Now joining</p>
          <h2 className="font-serif text-display-sm xl:text-display text-cream-50 leading-[0.98] tracking-tight text-balance">
            Build your<br />
            <span className="italic font-light">first playlist</span><br />
            in under a minute.
          </h2>
          <p className="mt-8 text-cream-300 leading-relaxed max-w-sm">
            One account. Unlimited playlists. A single share URL that works in any
            player — IMVU rooms, VLC, browsers, mobile.
          </p>
        </div>

        <div className="relative z-10 flex items-end justify-between text-xs text-cream-500 tracking-wider uppercase">
          <span>EgMax / Free forever</span>
          <span>v1.0</span>
        </div>
      </aside>

      {/* Form pane */}
      <main className="flex items-center justify-center px-6 sm:px-12 py-12">
        <div className="w-full max-w-sm animate-fade-in-up">
          <div className="lg:hidden flex flex-col items-center mb-12">
            <BrandMark size={40} />
            <Wordmark size={20} className="mt-3" />
          </div>

          <p className="eyebrow text-coral-500 mb-3">Create account</p>
          <h1 className="font-serif text-3xl sm:text-4xl text-cream-50 tracking-tight leading-[1.05] mb-2">
            Get started.
          </h1>
          <p className="text-cream-300 text-sm mb-10">
            Free, no credit card needed.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="eyebrow text-cream-500 mb-2 block">Username</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="choose_username"
                pattern="[a-zA-Z0-9_]{3,30}"
                title="3-30 characters, letters/numbers/underscore"
                autoComplete="username"
                className="input"
              />
              <p className="text-xs text-cream-500 mt-1.5">
                3-30 characters · letters, numbers, underscore
              </p>
            </div>

            <div>
              <label className="eyebrow text-cream-500 mb-2 block">Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                className="input"
              />
            </div>

            <div>
              <label className="eyebrow text-cream-500 mb-2 block">Confirm password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
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
                  Creating account
                </>
              ) : (
                <>
                  Create account
                  <ArrowRight className="w-4 h-4" strokeWidth={2} />
                </>
              )}
            </button>
          </form>

          <div className="rule mt-10 mb-6" />
          <p className="text-cream-300 text-sm text-center">
            Already have an account?{' '}
            <Link
              href="/login"
              className="text-coral-500 hover:text-coral-400 transition-colors font-medium"
            >
              Sign in
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
