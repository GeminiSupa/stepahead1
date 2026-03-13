"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { friendlySupabaseError } from '@/lib/errorMessages'
import { PageShell } from '../../../components/PageShell'
import { Card } from '../../../components/ui'
import { useToast } from '../../../components/toast'

type StudentDetail = {
  id: string
  full_name: string
  diagnosis: string | null
  class_id: string | null
}

type ClassRow = { id: string; name: string }

export default function AdminStudentDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { showToast } = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [student, setStudent] = useState<StudentDetail | null>(null)
  const [classes, setClasses] = useState<ClassRow[]>([])

  const [fullName, setFullName] = useState('')
  const [diagnosis, setDiagnosis] = useState('')
  const [classId, setClassId] = useState<string | ''>('')

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

      const [{ data: studentData, error: studentError }, { data: classData, error: classError }] =
        await Promise.all([
          supabase
            .from('students')
            .select('id, full_name, diagnosis, class_id')
            .eq('id', params.id)
            .maybeSingle(),
          supabase.from('classes').select('id, name').order('name'),
        ])

      if (studentError || classError) {
        const raw = studentError ?? classError
        setError(friendlySupabaseError('Unable to load student.', raw))
        setLoading(false)
        return
      }

      if (!studentData) {
        setError('Student not found.')
        setLoading(false)
        return
      }

      const detail: StudentDetail = {
        id: studentData.id,
        full_name: studentData.full_name,
        diagnosis: studentData.diagnosis,
        class_id: studentData.class_id,
      }

      setStudent(detail)
      setClasses((classData as ClassRow[]) ?? [])
      setFullName(detail.full_name)
      setDiagnosis(detail.diagnosis ?? '')
      setClassId(detail.class_id ?? '')
      setLoading(false)
    }

    load()
  }, [params.id, router])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!student) return
    setSaving(true)
    setError(null)
    setSuccess(null)

    const { error } = await supabase
      .from('students')
      .update({
        full_name: fullName.trim(),
        diagnosis: diagnosis.trim() || null,
        class_id: classId || null,
      })
      .eq('id', student.id)

    if (error) {
      setError(friendlySupabaseError('Unable to update student.', error))
      showToast('Unable to update student.', 'error')
      setSaving(false)
      return
    }

    setSuccess('Student updated.')
    showToast('Student updated.', 'success')
    setSaving(false)
  }

  return (
    <PageShell
      title="Student detail"
      subtitle="View and update student diagnosis and class."
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
        <p className="text-sm app-muted">Loading student…</p>
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

          {student ? (
            <Card title={student.full_name} subtitle={student.diagnosis ?? 'No diagnosis set'}>
              <form onSubmit={handleSave} className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">Full name</label>
                  <input
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none ring-sky-100 focus:border-sky-600 focus:ring-2"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">Diagnosis (optional)</label>
                  <input
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none ring-sky-100 focus:border-sky-600 focus:ring-2"
                    value={diagnosis}
                    onChange={(e) => setDiagnosis(e.target.value)}
                    placeholder="e.g. Autism, ADHD"
                  />
                </div>

                <div className="space-y-1">
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

