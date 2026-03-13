"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { friendlySupabaseError } from '@/lib/errorMessages'
import { PageShell } from '../../../components/PageShell'
import { Card } from '../../../components/ui'
import { useToast } from '../../../components/toast'

type Role = 'admin' | 'teacher' | 'therapist' | 'parent' | null

type StaffDetail = {
  id: string
  full_name: string | null
  email: string | null
  role: Role
  is_super_admin: boolean
}

export default function AdminStaffDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { showToast } = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [staff, setStaff] = useState<StaffDetail | null>(null)

  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<Role>(null)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)

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

      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email, role, is_super_admin')
        .eq('id', params.id)
        .maybeSingle()

      if (error) {
        setError(friendlySupabaseError('Unable to load user.', error))
        setLoading(false)
        return
      }

      if (!data) {
        setError('User not found.')
        setLoading(false)
        return
      }

      const detail: StaffDetail = {
        id: data.id,
        full_name: data.full_name ?? null,
        email: data.email ?? null,
        role: (data.role as Role) ?? null,
        is_super_admin: !!data.is_super_admin,
      }

      setStaff(detail)
      setFullName(detail.full_name ?? '')
      setRole(detail.role)
      setIsSuperAdmin(detail.is_super_admin)
      setLoading(false)
    }

    load()
  }, [params.id, router])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!staff) return
    setSaving(true)
    setError(null)
    setSuccess(null)

    const { error } = await supabase
      .from('users')
      .update({
        full_name: fullName.trim() || null,
        role,
        is_super_admin: isSuperAdmin,
      })
      .eq('id', staff.id)

    if (error) {
      setError(friendlySupabaseError('Unable to update user.', error))
      showToast('Unable to update user.', 'error')
      setSaving(false)
      return
    }

    setSuccess('User updated.')
    showToast('User updated.', 'success')
    setSaving(false)
  }

  return (
    <PageShell
      title="Staff profile"
      subtitle="View and update role and super admin status for this team member."
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
      {loading ? (
        <p className="text-sm app-muted">Loading user…</p>
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

          {staff ? (
            <Card
              title={staff.full_name || 'Staff member'}
              subtitle={staff.email ?? 'No email set'}
            >
              <form onSubmit={handleSave} className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">Full name</label>
                  <input
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none ring-sky-100 focus:border-sky-600 focus:ring-2"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Full name"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">Role</label>
                  <select
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none ring-sky-100 focus:border-sky-600 focus:ring-2"
                    value={role ?? ''}
                    onChange={(e) =>
                      setRole((e.target.value || null) as Role)
                    }
                  >
                    <option value="">None / disabled</option>
                    <option value="admin">Admin</option>
                    <option value="teacher">Teacher</option>
                    <option value="therapist">Therapist</option>
                    <option value="parent">Parent</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">
                    Super admin
                  </label>
                  <div className="flex items-center gap-2 rounded-2xl border border-slate-300 px-4 py-3 text-sm">
                    <input
                      id="super-admin"
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-sky-700 focus:ring-sky-600"
                      checked={isSuperAdmin}
                      onChange={(e) => setIsSuperAdmin(e.target.checked)}
                    />
                    <label htmlFor="super-admin" className="text-xs text-slate-700">
                      Can manage all data and create users
                    </label>
                  </div>
                </div>

                <div className="md:col-span-2 flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-2xl bg-sky-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-sky-400"
                  >
                    {saving ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              </form>
            </Card>
          ) : null}
        </div>
      )}
    </PageShell>
  )
}

