// src/app/supplier/login/page.tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/firebaseConfig';

export default function SupplierLogin() {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const router = useRouter();

  const onLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErr('');
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      router.push('/supplier/dashboard');
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Login failed';
      setErr(message);
    }
  };

  return (
    <main className="p-6 max-w-sm mx-auto">
      <h1 className="text-xl font-semibold mb-4">Supplier Login</h1>
      <form onSubmit={onLogin} className="flex flex-col gap-3">
        <input
          className="border p-2 rounded"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          required
        />
        <input
          className="border p-2 rounded"
          type="password"
          placeholder="Password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          autoComplete="current-password"
          required
        />
        <button className="border p-2 rounded" type="submit">
          Login
        </button>
      </form>
      {err && <p className="text-red-600 mt-3">{err}</p>}
    </main>
  );
}
