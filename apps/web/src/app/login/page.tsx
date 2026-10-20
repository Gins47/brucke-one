'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/components/session-provider';

/** Renders the public administrator login form for a new in-memory session. */
export default function LoginPage() {
  const router = useRouter();
  const session = useSession();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (session.accessToken) {
      router.replace('/organizations');
    }
  }, [router, session.accessToken]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    const loginError = await session.login(username, password);
    setIsSubmitting(false);
    if (loginError) {
      setError(loginError);
      return;
    }
    router.replace('/organizations');
  };

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-5 py-10">
      <form className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8" onSubmit={submit}>
        <p className="text-sm font-semibold text-blue-700">Brücke One</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-950">Administrator login</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">Use your configured development administrator account.</p>
        {session.authNotice && <p className="mt-4 text-sm font-medium text-blue-800" role="status">{session.authNotice}</p>}
        <div className="mt-6 grid gap-4">
          <div>
            <label className="text-sm font-semibold text-slate-800" htmlFor="username">Username</label>
            <input autoComplete="username" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" id="username" onChange={(event) => setUsername(event.target.value)} required value={username} />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-800" htmlFor="password">Password</label>
            <input autoComplete="current-password" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" id="password" onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
          </div>
        </div>
        {error && <p className="mt-4 text-sm font-medium text-red-700" role="alert">{error}</p>}
        <button className="mt-6 w-full rounded-md bg-blue-700 px-4 py-2.5 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-400" disabled={isSubmitting} type="submit">
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
