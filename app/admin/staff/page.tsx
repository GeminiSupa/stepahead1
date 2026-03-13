"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { friendlySupabaseError } from '@/lib/errorMessages'
import { PageShell } from '../../components/PageShell'
import { Card, StatCard } from '../../components/ui'
import { useToast } from '../../components/toast'

type Role = 'admin' | 'teacher' | 'therapist' | 'parent'

type StaffRow = {
  id: string
  full_name: string | null
  email: string | null
  role: Role
  is_super_admin: boolean
}

export default function AdminStaffPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [staff, setStaff] = useState<StaffRow[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('teacher')
  const [tempPassword, setTempPassword] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)

  const loadStaff = useCallback(async () => {
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
    setCurrentUserId(user.id)

    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, email, role, is_super_admin')
      .order('role')

    if (error) {
      setError(friendlySupabaseError('Unable to load users.', error))
      showToast('Could not load users.', 'error')
      setLoading(false)
      return
    }

    setStaff((data as StaffRow[]) ?? [])
    setLoading(false)
  }, [router, showToast])

  useEffect(() => {
    loadStaff()
  }, [loadStaff])

  const currentUserIsSuperAdmin = useMemo(() => {
    if (!currentUserId) return false
    return staff.some((s) => s.id === currentUserId && s.is_super_admin)
  }, [currentUserId, staff])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setError(null)
    setSuccess(null)

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError || !session) {
      setError('Please sign in again.')
      showToast('Please sign in again.', 'error')
      setIsSaving(false)
      return
    }

    const res = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        email,
        fullName,
        role,
        tempPassword,
        isSuperAdmin: false,
      }),
    })

    const json = await res.json()
    if (!res.ok) {
      setError(friendlySupabaseError('Unable to create user.', json?.error))
      showToast('Unable to create user.', 'error')
      setIsSaving(false)
      return
    }

    setSuccess(`Created user ${email} successfully.`)
    setFullName('')
    setEmail('')
    setTempPassword('')
    await loadStaff()
    showToast('User created.', 'success')
    setIsSaving(false)
  }

  const handleDisable = async (id: string) => {
    if (!window.confirm('Disable this user? They will no longer be able to sign in.')) return
    setError(null)
    // Soft-disable: clear role so they cannot be routed; you could also add a separate "disabled" flag.
    const { error } = await supabase.from('users').update({ role: null }).eq('id', id)
    if (error) {
      setError(friendlySupabaseError('Could not disable user.', error))
      showToast('Could not disable user.', 'error')
      return
    }
    showToast('User disabled.', 'success')
    await loadStaff()
  }

  return (
    <PageShell
      title="Staff & users"
      subtitle="Super admin can create users, set initial passwords, and assign roles."
      navItems={[
        { href: '/admin', label: 'Admin' },
        { href: '/admin/staff', label: 'Staff' },
        { href: '/admin/students', label: 'Students' },
        { href: '/admin/parent-links', label: 'Parent links' },
        { href: '/admin/classes', label: 'Classes' },
        { href: '/admin/assignments', label: 'Assignments' },
        { href: '/admin/fees', label: 'Fees' },
        { href: '/admin/leave', label: 'Leave' },
        { href: '/admin/portfolio/approvals', label: 'Portfolio' },
      ]}
    >
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Users" value={loading ? '…' : String(staff.length)} hint="In public.users" />
          <StatCard label="Super admin" value={loading ? '…' : currentUserIsSuperAdmin ? 'Yes' : 'No'} hint="Your access level" />
          <StatCard label="Status" value={isSaving ? 'Saving…' : 'Ready'} hint="Create and assign roles" />
        </div>

        <Card
          title="Create user"
          subtitle="Creates Auth user + profile row, with a temporary password."
        >
          <p className="mb-4 text-xs app-muted">
            This uses a secure server endpoint with the Supabase Service Role key. Share temporary
            passwords privately and ask staff/parents to change them after first login.
          </p>

          <form onSubmit={handleCreate} className="grid gap-3 md:grid-cols-4">
            <div className="space-y-1 md:col-span-2">
              <label className="block text-xs font-medium text-slate-700">Full name</label>
              <input
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none ring-sky-100 focus:border-sky-600 focus:ring-2"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Sadia Atif"
                required
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="block text-xs font-medium text-slate-700">Email</label>
              <input
                type="email"
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none ring-sky-100 focus:border-sky-600 focus:ring-2"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. teacher@stepahead.com"
                required
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="block text-xs font-medium text-slate-700">Role</label>
              <select
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none ring-sky-100 focus:border-sky-600 focus:ring-2"
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
              >
                <option value="admin">Admin</option>
                <option value="teacher">Teacher</option>
                <option value="therapist">Therapist</option>
                <option value="parent">Parent</option>
              </select>
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="block text-xs font-medium text-slate-700">Temporary password</label>
              <input
                type="password"
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none ring-sky-100 focus:border-sky-600 focus:ring-2"
                value={tempPassword}
                onChange={(e) => setTempPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
                minLength={8}
              />
            </div>
            <div className="md:col-span-4 flex justify-end pt-1">
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-2xl bg-sky-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-sky-400"
              >
                {isSaving ? 'Creating…' : 'Create user'}
              </button>
            </div>
          </form>

          {success ? <p className="mt-3 text-sm text-emerald-700">{success}</p> : null}
          {error ? (
            <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
          {!currentUserIsSuperAdmin ? (
            <p className="mt-3 text-xs text-amber-700">
              Note: You must be marked as super admin in <code>public.users</code> to create users.
            </p>
          ) : null}
        </Card>

        <Card
          title="All users"
          subtitle="This list comes from the public.users table (RLS protected)."
          actions={
            <button
              onClick={loadStaff}
              className="rounded-full border app-border bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Refresh
            </button>
          }
        >

          {loading ? (
            <p className="text-sm app-muted">Loading users…</p>
          ) : staff.length === 0 ? (
            <p className="text-sm app-muted">No users found.</p>
          ) : (
            <div className="space-y-2">
              {staff.map((u) => (
                <div
                  key={u.id}
                  className="flex flex-col gap-2 rounded-2xl border app-border bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{u.full_name ?? '—'}</p>
                    <p className="text-xs app-muted">{u.email ?? '—'}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {u.role ? (
                      <span className="rounded-full bg-sky-50 px-3 py-1 font-semibold text-sky-700">
                        {u.role}
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-50 px-3 py-1 font-semibold text-slate-600">
                        Disabled
                      </span>
                    )}
                    {u.is_super_admin ? (
                      <span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700">
                        Super admin
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <Link
                      href={`/admin/staff/${u.id}`}
                      className="rounded-full border app-border bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      View
                    </Link>
                    <Link
                      href={`/admin/staff/${u.id}`}
                      className="rounded-full border app-border bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Edit
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDisable(u.id)}
                      className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 font-semibold text-rose-700 hover:bg-rose-100"
                    >
                      Disable
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </PageShell>
  )
}

