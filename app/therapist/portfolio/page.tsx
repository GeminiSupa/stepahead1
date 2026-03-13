"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { PageShell } from '../../components/PageShell'
import { Card, StatCard } from '../../components/ui'
import { PORTFOLIO_BUCKET, portfolioObjectPath } from '@/lib/portfolioStorage'

type StudentRow = { id: string; full_name: string }

type PortfolioRow = {
  id: string
  student_id: string
  type: string
  title: string
  description: string | null
  file_url: string | null
  is_visible_to_parent: boolean
  created_at: string
}

export default function TherapistPortfolioPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [students, setStudents] = useState<StudentRow[]>([])
  const [items, setItems] = useState<PortfolioRow[]>([])

  const [studentId, setStudentId] = useState('')
  const [type, setType] = useState('photo')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [visibleToParent, setVisibleToParent] = useState(true)
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
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

    // Students in therapist caseload
    const { data: caseload, error: caseloadError } = await supabase
      .from('therapist_students')
      .select('student_id, students(full_name)')
      .eq('therapist_id', user.id)

    if (caseloadError) {
      setError(caseloadError.message)
      setLoading(false)
      return
    }

    const mapped: StudentRow[] =
      caseload?.map((row: any) => ({
        id: row.student_id,
        full_name: row.students?.full_name ?? 'Student',
      })) ?? []

    setStudents(mapped)

    const ids = mapped.map((s) => s.id)
    const { data: itemData, error: itemError } = ids.length
      ? await supabase
          .from('portfolio_items')
          .select('id, student_id, type, title, description, file_url, is_visible_to_parent, created_at')
          .in('student_id', ids)
          .order('created_at', { ascending: false })
      : { data: [], error: null }

    if (itemError) {
      setError(itemError.message)
      setLoading(false)
      return
    }

    setItems((itemData as PortfolioRow[]) ?? [])
    setLoading(false)
  }, [router])

  useEffect(() => {
    load()
  }, [load])

  const uploadAndCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    if (!studentId) {
      setError('Select a student.')
      setSaving(false)
      return
    }
    if (!title.trim()) {
      setError('Title is required.')
      setSaving(false)
      return
    }
    if (!file) {
      setError('Please choose a file (photo/video).')
      setSaving(false)
      return
    }

    const objectPath = portfolioObjectPath({
      studentId,
      filename: file.name,
      createdById: user.id,
    })

    const { error: uploadError } = await supabase.storage
      .from(PORTFOLIO_BUCKET)
      .upload(objectPath, file, { upsert: false })

    if (uploadError) {
      setError(
        `Upload failed: ${uploadError.message}. Ensure the "${PORTFOLIO_BUCKET}" bucket exists and has upload policies.`
      )
      setSaving(false)
      return
    }

    const { data: publicUrl } = supabase.storage.from(PORTFOLIO_BUCKET).getPublicUrl(objectPath)

    const { error: insertError } = await supabase.from('portfolio_items').insert({
      student_id: studentId,
      type,
      title: title.trim(),
      description: description.trim() || null,
      file_url: publicUrl.publicUrl,
      source: 'school',
      created_by: user.id,
      created_by_role: 'therapist',
      is_visible_to_parent: visibleToParent,
      requires_approval: false,
      approved: true,
    })

    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
    }

    setSuccess('Portfolio item added.')
    setTitle('')
    setDescription('')
    setFile(null)
    await load()
    setSaving(false)
  }

  const studentName = useMemo(
    () => students.find((s) => s.id === studentId)?.full_name ?? null,
    [students, studentId]
  )

  return (
    <PageShell
      title="Portfolio (Therapist)"
      subtitle="Upload therapy highlights and progress moments."
      navItems={[
        { href: '/therapist', label: 'Dashboard' },
        { href: '/therapist/portfolio', label: 'Portfolio' },
      ]}
    >
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Caseload" value={loading ? '…' : String(students.length)} hint="Students" />
          <StatCard label="Items" value={loading ? '…' : String(items.length)} hint="Total uploaded" />
          <StatCard label="Status" value={saving ? 'Saving…' : 'Ready'} hint="Uploads" />
        </div>

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

        <Card title="Add portfolio item" subtitle="Upload a photo/video and add a short caption.">
          <form onSubmit={uploadAndCreate} className="grid gap-3 md:grid-cols-4">
            <div className="md:col-span-2 space-y-1">
              <label className="block text-xs font-medium text-slate-700">Student</label>
              <select
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none ring-sky-100 focus:border-sky-600 focus:ring-2"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
              >
                <option value="">Select…</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                  </option>
                ))}
              </select>
              {studentName ? <p className="text-xs app-muted">Selected: {studentName}</p> : null}
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700">Type</label>
              <select
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none ring-sky-100 focus:border-sky-600 focus:ring-2"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="photo">Photo</option>
                <option value="video">Video</option>
                <option value="document">Document</option>
                <option value="note">Note</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700">Visible to parent</label>
              <select
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none ring-sky-100 focus:border-sky-600 focus:ring-2"
                value={visibleToParent ? 'yes' : 'no'}
                onChange={(e) => setVisibleToParent(e.target.value === 'yes')}
              >
                <option value="yes">Yes</option>
                <option value="no">Staff only</option>
              </select>
            </div>

            <div className="md:col-span-2 space-y-1">
              <label className="block text-xs font-medium text-slate-700">Title</label>
              <input
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none ring-sky-100 focus:border-sky-600 focus:ring-2"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Speech milestone"
                required
              />
            </div>

            <div className="md:col-span-2 space-y-1">
              <label className="block text-xs font-medium text-slate-700">File</label>
              <input
                type="file"
                accept="image/*,video/*"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>

            <div className="md:col-span-4 space-y-1">
              <label className="block text-xs font-medium text-slate-700">Description (optional)</label>
              <input
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none ring-sky-100 focus:border-sky-600 focus:ring-2"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Outcome, goals targeted, progress observed…"
              />
            </div>

            <div className="md:col-span-4 flex justify-end">
              <button
                disabled={saving}
                className="rounded-2xl bg-sky-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-sky-400"
                type="submit"
              >
                {saving ? 'Uploading…' : 'Upload'}
              </button>
            </div>
          </form>
        </Card>

        <Card title="Recent items" subtitle="Newest first.">
          {loading ? (
            <p className="text-sm app-muted">Loading…</p>
          ) : items.length === 0 ? (
            <p className="text-sm app-muted">No items yet.</p>
          ) : (
            <div className="space-y-2">
              {items.slice(0, 20).map((it) => {
                const name = students.find((s) => s.id === it.student_id)?.full_name ?? 'Student'
                return (
                  <div key={it.id} className="rounded-2xl border app-border bg-white px-4 py-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {name} · {it.title}
                        </p>
                        <p className="text-xs app-muted">
                          {new Date(it.created_at).toLocaleString()} · {it.type} ·{' '}
                          {it.is_visible_to_parent ? 'Visible to parent' : 'Staff only'}
                        </p>
                      </div>
                      {it.file_url ? (
                        <a
                          href={it.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full border app-border bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Open
                        </a>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>
    </PageShell>
  )
}

