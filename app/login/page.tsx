"use client"

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type Role = 'admin' | 'teacher' | 'therapist' | 'parent'

const BRAND = {
  name: 'Step Ahead Inclusive',
  logoUrl: '/Logo.png',
  helpEmail: 'stepaheadinclusive@gmail.com',
  helpPhone: '+92 309 1407475',
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError || !data.session) {
      setError(signInError?.message ?? 'Unable to sign in')
      setIsLoading(false)
      return
    }

    const sessionUser = data.session.user
    const metaRole = (sessionUser.app_metadata as any)?.role as Role | undefined

    // Prefer app_metadata for role (RLS-proof), fallback to public.users if missing.
    let role: Role | null = metaRole ?? null

    if (!role) {
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('role')
        .eq('id', sessionUser.id)
        .maybeSingle()

      if (profileError || !profile?.role) {
        setError('No role found for this account. Please ask admin to set it up.')
        setIsLoading(false)
        return
      }

      role = profile.role as Role
    }

    if (role === 'admin') router.push('/admin')
    else if (role === 'teacher') router.push('/teacher')
    else if (role === 'therapist') router.push('/therapist')
    else if (role === 'parent') router.push('/parent')
    else router.push('/')
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-white px-4 py-10">
      <div className="mx-auto w-full max-w-md space-y-6">
        <Link href="/" className="flex items-center justify-center gap-3">
          <span className="relative h-10 w-10 overflow-hidden rounded-2xl border app-border bg-white">
            <Image src={BRAND.logoUrl} alt={BRAND.name} fill sizes="40px" />
          </span>
          <div className="text-left leading-tight">
            <p className="text-sm font-semibold text-slate-900">{BRAND.name}</p>
            <p className="text-xs app-muted">Empowering Every Child</p>
          </div>
        </Link>

        <div className="rounded-3xl border app-border bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">Sign in</h1>
          <p className="mt-1 text-sm app-muted">
            Use the email and temporary password created by the principal/admin.
          </p>

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <div className="space-y-1">
            <label htmlFor="email" className="block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none ring-sky-100 focus:border-sky-600 focus:ring-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">
              Password
            </label>
            <div className="flex items-center gap-2">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none ring-sky-100 focus:border-sky-600 focus:ring-2"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="shrink-0 rounded-full border app-border bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isLoading}
            className="mt-2 w-full rounded-2xl bg-sky-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-sky-400"
          >
            {isLoading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

          <div className="mt-5 rounded-2xl bg-slate-50 px-4 py-3 text-xs app-muted">
            <p className="font-semibold text-slate-700">Need help?</p>
            <p className="mt-1">
              Ask the admin to assign your role, or contact Step Ahead Inclusive at{' '}
              <span className="font-medium text-slate-700">{BRAND.helpEmail}</span> /{' '}
              <span className="font-medium text-slate-700">{BRAND.helpPhone}</span>.
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}

