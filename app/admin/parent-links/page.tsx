"use client"

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { friendlySupabaseError } from '@/lib/errorMessages'
import { PageShell } from '../../components/PageShell'
import { Card, StatCard } from '../../components/ui'
import { useToast } from '../../components/toast'

type ParentRow = {
  id: string
  full_name: string | null
  email: string | null
}

type StudentRow = {
  id: string
  full_name: string
}

type LinkRow = {
  id: string
  parent_id: string
  student_id: string
  relationship: string | null
  parent_name: string
  parent_email: string | null
  student_name: string
}

export default function ParentLinksPage() {
  const { showToast } = useToast()

  const [parents, setParents] = useState<ParentRow[]>([])
  const [students, setStudents] = useState<StudentRow[]>([])
  const [links, setLinks] = useState<LinkRow[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [parentId, setParentId] = useState('')
  const [studentId, setStudentId] = useState('')
  const [relationship, setRelationship] = useState('Parent')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    setError(null)

    const [{ data: parentData, error: parentError }, { data: studentData, error: studentError }] =
      await Promise.all([
        supabase.from('users').select('id, full_name, email').eq('role', 'parent').order('full_name'),
        supabase.from('students').select('id, full_name').order('full_name'),
      ])

    if (parentError || studentError) {
      const raw = parentError ?? studentError
      setError(friendlySupabaseError('Unable to load parents/students.', raw))
      setLoading(false)
      return
    }

    setParents((parentData as ParentRow[]) ?? [])
    setStudents((studentData as StudentRow[]) ?? [])

    const { data: linkData, error: linkError } = await supabase
      .from('parents_students')
      .select('id, parent_id, student_id, relationship, users(full_name, email), students(full_name)')
      .order('created_at', { ascending: false })

    if (linkError) {
      setError(linkError.message)
      setLoading(false)
      return
    }

    const mapped: LinkRow[] =
      (linkData as any[])?.map((row) => ({
        id: row.id,
        parent_id: row.parent_id,
        student_id: row.student_id,
        relationship: row.relationship,
        parent_name: row.users?.full_name ?? 'Parent',
        parent_email: row.users?.email ?? null,
        student_name: row.students?.full_name ?? 'Student',
      })) ?? []

    setLinks(mapped)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!parentId || !studentId) {
      showToast('Select both parent and student.', 'error')
      return
    }

    setSaving(true)
    setError(null)

    const { error: insertError } = await supabase.from('parents_students').insert({
      parent_id: parentId,
      student_id: studentId,
      relationship: relationship.trim() || null,
    })

    if (insertError) {
      // Unique violation -> already linked
      if ((insertError as any).code === '23505') {
        showToast('This parent is already linked to that student.', 'error')
      } else {
        setError(friendlySupabaseError('Could not create link.', insertError))
        showToast('Could not create link.', 'error')
      }
      setSaving(false)
      return
    }

    showToast('Parent linked to student.', 'success')
    setParentId('')
    setStudentId('')
    setRelationship('Parent')
    await load()
    setSaving(false)
  }

  const handleDeleteLink = async (id: string) => {
    if (!window.confirm('Remove this parent → student link?')) return
    setError(null)
    const { error: deleteError } = await supabase.from('parents_students').delete().eq('id', id)
    if (deleteError) {
      setError(friendlySupabaseError('Could not remove link.', deleteError))
      showToast('Could not remove link.', 'error')
      return
    }
    showToast('Link removed.', 'success')
    await load()
  }

  return (
    <PageShell
      title="Parent ↔ Student links"
      subtitle="Connect parent accounts to children so the Parent Portal shows the right data."
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
          <StatCard label="Parents" value={loading ? '…' : String(parents.length)} hint="With parent role" />
          <StatCard label="Students" value={loading ? '…' : String(students.length)} hint="Total" />
          <StatCard label="Links" value={loading ? '…' : String(links.length)} hint="Parent ↔ child" />
        </div>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <Card
          title="Link parent to student"
          subtitle="Choose a parent user, pick a student, and set the relationship (e.g. Mother, Father, Guardian)."
        >
          <form onSubmit={handleCreateLink} className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700">Parent</label>
              <select
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none ring-sky-100 focus:border-sky-600 focus:ring-2"
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
              >
                <option value="">Select parent…</option>
                {parents.map((p) => (
                  <option key={p.id} value={p.id}>
                    {(p.full_name || 'Parent') + (p.email ? ` — ${p.email}` : '')}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700">Student</label>
              <select
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none ring-sky-100 focus:border-sky-600 focus:ring-2"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
              >
                <option value="">Select student…</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700">Relationship</label>
              <input
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none ring-sky-100 focus:border-sky-600 focus:ring-2"
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                placeholder="Mother, Father, Guardian…"
              />
            </div>

            <div className="md:col-span-3 flex justify-end pt-1">
              <button
                type="submit"
                disabled={saving}
                className="rounded-2xl bg-sky-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-sky-400"
              >
                {saving ? 'Linking…' : 'Create link'}
              </button>
            </div>
          </form>
        </Card>

        <Card
          title="Existing links"
          subtitle="Each row is a parent ↔ child connection used by the Parent Portal."
        >
          {loading ? (
            <p className="text-sm app-muted">Loading links…</p>
          ) : links.length === 0 ? (
            <p className="text-sm app-muted">
              No links yet. Once you connect parents to students, they will see the correct children in
              their portal.
            </p>
          ) : (
            <div className="space-y-2">
              {links.map((link) => (
                <div
                  key={link.id}
                  className="flex flex-col gap-2 rounded-2xl border app-border bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {link.student_name}{' '}
                      <span className="text-xs font-normal text-slate-500">← child</span>
                    </p>
                    <p className="text-xs app-muted">
                      {link.parent_name}
                      {link.parent_email ? ` — ${link.parent_email}` : ''}{' '}
                      {link.relationship ? `(${link.relationship})` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => handleDeleteLink(link.id)}
                      className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 font-semibold text-rose-700 hover:bg-rose-100"
                    >
                      Remove
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

