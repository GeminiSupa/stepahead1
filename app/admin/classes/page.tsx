"use client"

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { friendlySupabaseError } from '@/lib/errorMessages'
import { PageShell } from '../../components/PageShell'
import { Card, PrimaryButton, SecondaryButton, StatCard } from '../../components/ui'
import { useToast } from '../../components/toast'

type ClassRow = {
  id: string
  name: string
  grade_level: string | null
  room: string | null
}

export default function AdminClassesPage() {
  const { showToast } = useToast()
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [gradeLevel, setGradeLevel] = useState('')
  const [room, setRoom] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const loadClasses = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    const { data, error } = await supabase
      .from('classes')
      .select('id, name, grade_level, room')
      .order('name')

    if (error) {
      setError(friendlySupabaseError('Could not load classes.', error))
      showToast('Could not load classes.', 'error')
      setIsLoading(false)
      return
    }

    setClasses(data ?? [])
    setIsLoading(false)
  }, [showToast])

  useEffect(() => {
    loadClasses()
  }, [loadClasses])

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setIsSaving(true)
    setError(null)

    const { error } = await supabase.from('classes').insert({
      name: name.trim(),
      grade_level: gradeLevel.trim() || null,
      room: room.trim() || null,
    })

    if (error) {
      setError(friendlySupabaseError('Could not save class.', error))
      showToast('Could not save class.', 'error')
      setIsSaving(false)
      return
    }

    setName('')
    setGradeLevel('')
    setRoom('')
    await loadClasses()
    showToast('Class added.', 'success')
    setIsSaving(false)
  }

  const handleDeleteClass = async (id: string) => {
    if (!window.confirm('Delete this class? This cannot be undone.')) return
    setError(null)
    const { error } = await supabase.from('classes').delete().eq('id', id)
    if (error) {
      setError(friendlySupabaseError('Could not delete class.', error))
      showToast('Could not delete class.', 'error')
      return
    }
    showToast('Class deleted.', 'success')
    await loadClasses()
  }

  return (
    <PageShell
      title="Classes"
      subtitle="Define mixed-ability classes and rooms. Link teachers and therapists to calm, structured timetables."
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
        <Card
          title="Quick actions"
          subtitle="Create sections like KG-A / KG-B and keep mixed-ability groups organised."
          actions={<SecondaryButton href="/admin">Back to admin</SecondaryButton>}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <PrimaryButton href="/admin/students">Go to students</PrimaryButton>
            <SecondaryButton href="/admin/parent-links">Parent links</SecondaryButton>
            <SecondaryButton href="/teacher">Teacher view</SecondaryButton>
          </div>
        </Card>

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Total classes" value={isLoading ? '…' : String(classes.length)} hint="From Supabase" />
          <StatCard label="Saving" value={isSaving ? 'Saving…' : 'Ready'} hint="Form status" />
          <StatCard
            label="Rooms filled"
            value={
              isLoading
                ? '…'
                : String(classes.filter((c) => !!(c.room && c.room.trim())).length)
            }
            hint="Have a room name"
          />
        </div>

        <Card title="Add new class" subtitle="Name, grade level, and room (optional – like an iOS card studio for your sections).">
          <form onSubmit={handleCreateClass} className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700">Name</label>
              <input
                type="text"
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none ring-sky-100 focus:border-sky-600 focus:ring-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="e.g. KG-A"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700">Grade level</label>
              <input
                type="text"
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none ring-sky-100 focus:border-sky-600 focus:ring-2"
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value)}
                placeholder="e.g. KG, Grade 2"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700">Room</label>
              <input
                type="text"
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none ring-sky-100 focus:border-sky-600 focus:ring-2"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                placeholder="e.g. Room 3"
              />
            </div>
            <div className="md:col-span-3 flex justify-end pt-1">
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-2xl bg-sky-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-sky-400"
              >
                {isSaving ? 'Saving…' : 'Save class'}
              </button>
            </div>
          </form>
          {error ? (
            <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
        </Card>

        <Card title="Class list" subtitle="View, edit, or remove classes as needed.">
          {isLoading ? (
            <p className="text-sm app-muted">Loading classes…</p>
          ) : classes.length === 0 ? (
            <p className="text-sm app-muted">No classes yet. Add your first class above.</p>
          ) : (
            <div className="space-y-2">
              {classes.map((c) => (
                <div key={c.id} className="rounded-2xl border app-border bg-white px-4 py-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-semibold text-slate-900">{c.name}</p>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-slate-50 px-3 py-1 font-semibold text-slate-700">
                        {c.grade_level || 'No grade'}
                      </span>
                      <span className="rounded-full bg-sky-50 px-3 py-1 font-semibold text-sky-800">
                        {c.room || 'No room'}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <Link
                      href={`/admin/classes/${c.id}`}
                      className="rounded-full border app-border bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      View
                    </Link>
                    <Link
                      href={`/admin/classes/${c.id}`}
                      className="rounded-full border app-border bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Edit
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDeleteClass(c.id)}
                      className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 font-semibold text-rose-700 hover:bg-rose-100"
                    >
                      Delete
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

