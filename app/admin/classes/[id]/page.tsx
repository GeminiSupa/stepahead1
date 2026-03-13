"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { friendlySupabaseError } from '@/lib/errorMessages'
import { PageShell } from '../../../components/PageShell'
import { Card } from '../../../components/ui'
import { useToast } from '../../../components/toast'

type ClassDetail = {
  id: string
  name: string
  grade_level: string | null
  room: string | null
}

export default function AdminClassDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { showToast } = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [klass, setKlass] = useState<ClassDetail | null>(null)

  const [name, setName] = useState('')
  const [gradeLevel, setGradeLevel] = useState('')
  const [room, setRoom] = useState('')

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
        .from('classes')
        .select('id, name, grade_level, room')
        .eq('id', params.id)
        .maybeSingle()

      if (error) {
        setError(friendlySupabaseError('Unable to load class.', error))
        setLoading(false)
        return
      }

      if (!data) {
        setError('Class not found.')
        setLoading(false)
        return
      }

      const detail: ClassDetail = {
        id: data.id,
        name: data.name,
        grade_level: data.grade_level,
        room: data.room,
      }

      setKlass(detail)
      setName(detail.name)
      setGradeLevel(detail.grade_level ?? '')
      setRoom(detail.room ?? '')
      setLoading(false)
    }

    load()
  }, [params.id, router])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!klass) return
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    setSuccess(null)

    const { error } = await supabase
      .from('classes')
      .update({
        name: name.trim(),
        grade_level: gradeLevel.trim() || null,
        room: room.trim() || null,
      })
      .eq('id', klass.id)

    if (error) {
      setError(friendlySupabaseError('Unable to update class.', error))
      showToast('Unable to update class.', 'error')
      setSaving(false)
      return
    }

    setSuccess('Class updated.')
    showToast('Class updated.', 'success')
    setSaving(false)
  }

  return (
    <PageShell
      title="Class detail"
      subtitle="View and update class name, grade, and room."
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
        <p className="text-sm app-muted">Loading class…</p>
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

          {klass ? (
            <Card title={klass.name} subtitle={klass.grade_level ?? 'No grade set'}>
              <form onSubmit={handleSave} className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">Name</label>
                  <input
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none ring-sky-100 focus:border-sky-600 focus:ring-2"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">Grade level</label>
                  <input
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none ring-sky-100 focus:border-sky-600 focus:ring-2"
                    value={gradeLevel}
                    onChange={(e) => setGradeLevel(e.target.value)}
                    placeholder="e.g. KG, Grade 2"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">Room</label>
                  <input
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none ring-sky-100 focus:border-sky-600 focus:ring-2"
                    value={room}
                    onChange={(e) => setRoom(e.target.value)}
                    placeholder="e.g. Room 3"
                  />
                </div>

                <div className="md:col-span-3 flex justify-end pt-1">
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

