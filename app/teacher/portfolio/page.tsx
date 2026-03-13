"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { PageShell } from '../../components/PageShell'
import { Card, StatCard } from '../../components/ui'
import { PORTFOLIO_BUCKET, portfolioObjectPath } from '@/lib/portfolioStorage'

type ClassRow = { id: string; name: string }
type StudentRow = { id: string; full_name: string; class_id: string | null }

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

export default function TeacherPortfolioPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [classes, setClasses] = useState<ClassRow[]>([])
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

    const [{ data: classData, error: classError }, { data: studentData, error: studentError }] =
      await Promise.all([
        supabase.from('classes').select('id, name').eq('primary_teacher_id', user.id).order('name'),
        supabase.from('students').select('id, full_name, class_id').order('full_name'),
      ])

    if (classError || studentError) {
      setError(classError?.message ?? studentError?.message ?? 'Unable to load data')
      setLoading(false)
      return
    }

    const myClassIds = (classData ?? []).map((c) => c.id)
    const myStudents = ((studentData as StudentRow[]) ?? []).filter(
      (s) => s.class_id && myClassIds.includes(s.class_id)
    )

    setClasses((classData as ClassRow[]) ?? [])
    setStudents(myStudents)

    const myStudentIds = myStudents.map((s) => s.id)
    const { data: itemData, error: itemError } = myStudentIds.length
      ? await supabase
          .from('portfolio_items')
          .select('id, student_id, type, title, description, file_url, is_visible_to_parent, created_at')
          .in('student_id', myStudentIds)
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

  const itemCount = items.length

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
        `Upload failed: ${uploadError.message}. Ensure a Supabase Storage bucket named "${PORTFOLIO_BUCKET}" exists and has policies for authenticated uploads.`
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
      created_by_role: 'teacher',
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
      title="Portfolio (Teacher)"
      subtitle="Upload classroom moments and achievements."
      navItems={[
        { href: '/teacher', label: 'Dashboard' },
        { href: '/teacher/timetable', label: 'Timetable' },
        { href: '/teacher/leave', label: 'Leave' },
        { href: '/teacher/portfolio', label: 'Portfolio' },
      ]}
    >
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Classes" value={loading ? '…' : String(classes.length)} hint="Assigned" />
          <StatCard label="Students" value={loading ? '…' : String(students.length)} hint="In your classes" />
          <StatCard label="Items" value={loading ? '…' : String(itemCount)} hint="Total uploaded" />
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
                <option value="artwork">Artwork</option>
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
                placeholder="e.g. Painting activity"
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
                placeholder="What did the child do well today?"
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

        <Card title="Recent items" subtitle="Newest first. Tap to open in a new tab.">
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
                          className="inline-flex items-center justify-center rounded-full border border-indigo-100 bg-white px-4 py-2 text-xs font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-50"
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

