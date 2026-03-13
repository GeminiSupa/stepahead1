"use client"

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { friendlySupabaseError } from '@/lib/errorMessages'
import { PageShell } from '../../components/PageShell'
import { Card, StatCard } from '../../components/ui'
import { useToast } from '../../components/toast'

type Student = {
  id: string
  full_name: string
  diagnosis: string | null
  class_id: string | null
}

type ClassRow = {
  id: string
  name: string
}

export default function AdminStudentsPage() {
  const { showToast } = useToast()
  const [students, setStudents] = useState<Student[]>([])
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [fullName, setFullName] = useState('')
  const [diagnosis, setDiagnosis] = useState('')
  const [classId, setClassId] = useState<string | ''>('')
  const [isSaving, setIsSaving] = useState(false)

  const loadData = async () => {
    setIsLoading(true)
    setError(null)

    const [{ data: studentsData, error: studentsError }, { data: classesData, error: classesError }] =
      await Promise.all([
        supabase.from('students').select('id, full_name, diagnosis, class_id').order('full_name'),
        supabase.from('classes').select('id, name').order('name'),
      ])

    if (studentsError || classesError) {
      const raw = studentsError ?? classesError
      setError(
        friendlySupabaseError('Unable to load students/classes.', raw)
      )
      setIsLoading(false)
      return
    }

    setStudents(studentsData ?? [])
    setClasses(classesData ?? [])
    setIsLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim()) return

    setIsSaving(true)
    setError(null)

    const { error: insertError } = await supabase.from('students').insert({
      full_name: fullName.trim(),
      diagnosis: diagnosis.trim() || null,
      class_id: classId || null,
    })

    if (insertError) {
      setError(friendlySupabaseError('Could not save student.', insertError))
      showToast('Could not save student.', 'error')
      setIsSaving(false)
      return
    }

    setFullName('')
    setDiagnosis('')
    setClassId('')
    await loadData()
    showToast('Student added.', 'success')
    setIsSaving(false)
  }

  const handleDeleteStudent = async (id: string) => {
    if (!window.confirm('Delete this student? This cannot be undone.')) return
    setError(null)
    const { error } = await supabase.from('students').delete().eq('id', id)
    if (error) {
      setError(friendlySupabaseError('Could not delete student.', error))
      showToast('Could not delete student.', 'error')
      return
    }
    showToast('Student deleted.', 'success')
    await loadData()
  }

  return (
    <PageShell
      title="Students"
      subtitle="Inclusive student profiles connected to attendance, IEP progress, therapy logs, and portfolios."
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
          <StatCard label="Students" value={isLoading ? '…' : String(students.length)} hint="Total" />
          <StatCard
            label="With diagnosis"
            value={
              isLoading
                ? '…'
                : String(students.filter((s) => (s.diagnosis ?? '').trim().length > 0).length)
            }
            hint="Neurodiverse count"
          />
          <StatCard label="Classes" value={isLoading ? '…' : String(classes.length)} hint="Available" />
        </div>

        <Card title="Add new student" subtitle="Start with name, diagnosis label, and class assignment.">
          <form onSubmit={handleCreateStudent} className="grid gap-3 md:grid-cols-3">
            <div className="md:col-span-1 space-y-1">
              <label className="block text-xs font-medium text-slate-700">Full name</label>
              <input
                type="text"
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none ring-sky-100 focus:border-sky-600 focus:ring-2"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                placeholder="e.g. Ayesha Khan"
              />
            </div>
            <div className="md:col-span-1 space-y-1">
              <label className="block text-xs font-medium text-slate-700">Diagnosis (optional)</label>
              <input
                type="text"
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none ring-sky-100 focus:border-sky-600 focus:ring-2"
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                placeholder="e.g. Autism, ADHD"
              />
            </div>
            <div className="md:col-span-1 space-y-1">
              <label className="block text-xs font-medium text-slate-700">Class</label>
              <select
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none ring-sky-100 focus:border-sky-600 focus:ring-2"
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
              >
                <option value="">Unassigned</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-3 flex justify-end pt-1">
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-2xl bg-sky-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-sky-400"
              >
                {isSaving ? 'Saving…' : 'Save student'}
              </button>
            </div>
          </form>
          {error ? (
            <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
        </Card>

        <Card title="Student list" subtitle="Tap a row for quick actions like view, edit, or remove.">
          {isLoading ? (
            <p className="text-sm app-muted">Loading students…</p>
          ) : students.length === 0 ? (
            <p className="text-sm app-muted">No students yet. Add your first student above.</p>
          ) : (
            <div className="space-y-2">
              {students.map((s) => {
                const cls = classes.find((c) => c.id === s.class_id)
                return (
                  <div key={s.id} className="rounded-2xl border app-border bg-white px-4 py-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm font-semibold text-slate-900">{s.full_name}</p>
                      <div className="flex flex-wrap gap-2 text-xs">
                        {s.diagnosis ? (
                          <span className="rounded-full bg-sky-50 px-3 py-1 font-semibold text-sky-800">
                            {s.diagnosis}
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-50 px-3 py-1 font-semibold text-slate-600">
                            No diagnosis
                          </span>
                        )}
                        {cls ? (
                          <span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-800">
                            {cls.name}
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-50 px-3 py-1 font-semibold text-slate-600">
                            Unassigned
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <Link
                        href={`/admin/students/${s.id}`}
                        className="rounded-full border app-border bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        View
                      </Link>
                      <Link
                        href={`/admin/students/${s.id}`}
                        className="rounded-full border app-border bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDeleteStudent(s.id)}
                        className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 font-semibold text-rose-700 hover:bg-rose-100"
                      >
                        Delete
                      </button>
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

