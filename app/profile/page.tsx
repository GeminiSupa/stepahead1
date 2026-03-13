"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { PageShell } from '../components/PageShell'
import { Card } from '../components/ui'

type Role = 'admin' | 'teacher' | 'therapist' | 'parent'

type ProfileRow = {
  full_name: string | null
  phone: string | null
  role: Role | null
}

export default function ProfilePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [email, setEmail] = useState<string | null>(null)
  const [role, setRole] = useState<Role | null>(null)

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  const [newPassword, setNewPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      setSuccess(null)

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        router.push('/login')
        return
      }

      setEmail(user.email ?? null)
      const metaRole = (user.app_metadata as any)?.role as Role | undefined
      setRole(metaRole ?? null)

      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('full_name, phone, role')
        .eq('id', user.id)
        .maybeSingle()

      if (profileError) {
        setError(profileError.message)
        setLoading(false)
        return
      }

      const row = (profile as ProfileRow | null) ?? null
      setFullName(row?.full_name ?? '')
      setPhone(row?.phone ?? '')
      setRole((row?.role as Role | null) ?? metaRole ?? null)

      setLoading(false)
    }

    load()
  }, [router])

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingProfile(true)
    setError(null)
    setSuccess(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { error: upsertError } = await supabase.from('users').upsert({
      id: user.id,
      email: user.email,
      full_name: fullName.trim() || null,
      phone: phone.trim() || null,
    })

    if (upsertError) {
      setError(upsertError.message)
      setSavingProfile(false)
      return
    }

    setSuccess('Profile updated.')
    setSavingProfile(false)
  }

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingPassword(true)
    setError(null)
    setSuccess(null)

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.')
      setSavingPassword(false)
      return
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
    if (updateError) {
      setError(updateError.message)
      setSavingPassword(false)
      return
    }

    setNewPassword('')
    setSuccess('Password updated.')
    setSavingPassword(false)
  }

  return (
    <PageShell title="Profile" subtitle="View your role and manage your account settings.">
      {loading ? (
        <p className="text-sm app-muted">Loading…</p>
      ) : (
        <div className="space-y-6">
          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
          {success ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {success}
            </div>
          ) : null}

          <Card title="Account" subtitle="Your sign-in identity and role.">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border app-border bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{email ?? '—'}</p>
              </div>
              <div className="rounded-2xl border app-border bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Role</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{role ?? '—'}</p>
              </div>
            </div>
          </Card>

          <Card title="Basic settings" subtitle="These fields are saved in public.users for your account.">
            <form onSubmit={saveProfile} className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-700">Full name</label>
                <input
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none ring-sky-100 focus:border-sky-600 focus:ring-2"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your name"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-700">Phone</label>
                <input
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none ring-sky-100 focus:border-sky-600 focus:ring-2"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+92…"
                />
              </div>
              <div className="sm:col-span-2 flex justify-end">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="rounded-2xl bg-sky-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-sky-400"
                >
                  {savingProfile ? 'Saving…' : 'Save settings'}
                </button>
              </div>
            </form>
          </Card>

          <Card title="Change password" subtitle="Use a strong password (min 8 characters).">
            <form onSubmit={changePassword} className="space-y-3">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-700">New password</label>
                <input
                  type="password"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none ring-sky-100 focus:border-sky-600 focus:ring-2"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="********"
                  minLength={8}
                  required
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingPassword}
                  className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {savingPassword ? 'Updating…' : 'Update password'}
                </button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </PageShell>
  )
}

