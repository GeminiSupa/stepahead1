"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { friendlySupabaseError } from "@/lib/errorMessages"
import { PageShell } from "../../components/PageShell"
import { Card, PrimaryButton, SecondaryButton, StatCard } from "../../components/ui"
import { useToast } from "../../components/toast"

type ClassRow = { id: string; name: string }

type TimetableEntry = {
  id: string
  class_id: string
  weekday: number
  start_time: string
  end_time: string
  title: string
  is_therapy: boolean
}

const WEEKDAYS: { value: number; label: string }[] = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 0, label: "Sunday" },
]

export default function AdminTimetablePage() {
  const router = useRouter()
  const { showToast } = useToast()

  const [classes, setClasses] = useState<ClassRow[]>([])
  const [entries, setEntries] = useState<TimetableEntry[]>([])

  const [selectedClassId, setSelectedClassId] = useState<string>("")
  const [selectedWeekday, setSelectedWeekday] = useState<number>(() => {
    const jsDay = new Date().getDay()
    return jsDay
  })

  const [title, setTitle] = useState("")
  const [startTime, setStartTime] = useState("")
  const [endTime, setEndTime] = useState("")
  const [isTherapy, setIsTherapy] = useState(false)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      router.push("/login")
      return
    }

    const [{ data: classData, error: classError }, { data: entryData, error: entryError }] =
      await Promise.all([
        supabase.from("classes").select("id, name").order("name"),
        supabase
          .from("class_timetable_entries")
          .select("id, class_id, weekday, start_time, end_time, title, is_therapy"),
      ])

    if (classError || entryError) {
      const raw = classError ?? entryError
      setError(friendlySupabaseError("Unable to load timetable.", raw as any))
      setLoading(false)
      return
    }

    setClasses((classData as ClassRow[]) ?? [])
    setEntries((entryData as TimetableEntry[]) ?? [])
    setLoading(false)
  }, [router])

  useEffect(() => {
    load()
  }, [load])

  const filteredEntries = useMemo(() => {
    return entries
      .filter(
        (e) =>
          (!selectedClassId || e.class_id === selectedClassId) && e.weekday === selectedWeekday,
      )
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
  }, [entries, selectedClassId, selectedWeekday])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedClassId) {
      setError("Select a class first.")
      return
    }
    if (!title.trim() || !startTime || !endTime) {
      setError("Title, start time, and end time are required.")
      return
    }

    setSaving(true)
    setError(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push("/login")
      return
    }

    const { data, error } = await supabase
      .from("class_timetable_entries")
      .insert({
        class_id: selectedClassId,
        weekday: selectedWeekday,
        start_time: startTime,
        end_time: endTime,
        title: title.trim(),
        is_therapy: isTherapy,
        created_by: user.id,
      })
      .select("id, class_id, weekday, start_time, end_time, title, is_therapy")
      .maybeSingle()

    if (error) {
      setError(friendlySupabaseError("Unable to add timetable slot.", error))
      showToast("Unable to add timetable slot.", "error")
      setSaving(false)
      return
    }

    if (data) {
      setEntries((prev) => [...prev, data as TimetableEntry])
    }

    setTitle("")
    setStartTime("")
    setEndTime("")
    setIsTherapy(false)
    setSaving(false)
    showToast("Timetable slot added.", "success")
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm("Remove this slot from the timetable?")) return
    setError(null)
    const { error } = await supabase.from("class_timetable_entries").delete().eq("id", id)
    if (error) {
      setError(friendlySupabaseError("Unable to delete slot.", error))
      showToast("Unable to delete slot.", "error")
      return
    }
    setEntries((prev) => prev.filter((e) => e.id !== id))
    showToast("Slot deleted.", "success")
  }

  const weekdayLabel = useMemo(
    () => WEEKDAYS.find((w) => w.value === selectedWeekday)?.label ?? "Day",
    [selectedWeekday],
  )

  return (
    <PageShell
      title="Timetable"
      subtitle="Build calm, visual timetables for each KG class — with therapy times highlighted."
      navItems={[
        { href: "/admin", label: "Admin" },
        { href: "/admin/staff", label: "Staff" },
        { href: "/admin/students", label: "Students" },
        { href: "/admin/parent-links", label: "Parent links" },
        { href: "/admin/classes", label: "Classes & rooms" },
        { href: "/admin/assignments", label: "Assignments" },
        { href: "/admin/timetable", label: "Timetable" },
        { href: "/admin/fees", label: "Fees" },
        { href: "/admin/leave", label: "Leave" },
        { href: "/admin/portfolio/approvals", label: "Portfolio" },
      ]}
    >
      <div className="space-y-6">
        <Card
          title="Today at a glance"
          subtitle="Pick a class and day to see a kid-friendly schedule."
          actions={<SecondaryButton href="/admin">Back to admin</SecondaryButton>}
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Classes with timetable"
              value={loading ? "…" : String(new Set(entries.map((e) => e.class_id)).size)}
              hint="At least one slot defined"
            />
            <StatCard
              label="Slots today"
              value={loading ? "…" : String(filteredEntries.length)}
              hint={weekdayLabel}
            />
            <StatCard
              label="Therapy slots"
              value={
                loading
                  ? "…"
                  : String(filteredEntries.filter((e) => e.is_therapy).length)
              }
              hint="Highlighted for therapists"
            />
          </div>
        </Card>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <Card
          title="Build timetable"
          subtitle="Choose class + day, then add blocks like Circle time, Snack, Therapy."
        >
          <form onSubmit={handleCreate} className="grid gap-3 md:grid-cols-4">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700">Class</label>
              <select
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none ring-sky-100 focus:border-sky-600 focus:ring-2"
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
              >
                <option value="">Select class…</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700">Day of week</label>
              <select
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none ring-sky-100 focus:border-sky-600 focus:ring-2"
                value={selectedWeekday}
                onChange={(e) => setSelectedWeekday(Number(e.target.value))}
              >
                {WEEKDAYS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700">Start time</label>
              <input
                type="time"
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none ring-sky-100 focus:border-sky-600 focus:ring-2"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700">End time</label>
              <input
                type="time"
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none ring-sky-100 focus:border-sky-600 focus:ring-2"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>

            <div className="md:col-span-2 space-y-1">
              <label className="block text-xs font-medium text-slate-700">Title</label>
              <input
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none ring-sky-100 focus:border-sky-600 focus:ring-2"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Circle time, OT session, Snack"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700">Is therapy slot?</label>
              <div className="flex items-center gap-2 rounded-2xl border border-slate-300 px-4 py-3 text-sm">
                <input
                  id="is-therapy"
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-sky-700 focus:ring-sky-600"
                  checked={isTherapy}
                  onChange={(e) => setIsTherapy(e.target.checked)}
                />
                <label htmlFor="is-therapy" className="text-xs text-slate-700">
                  Highlight as therapy / special support
                </label>
              </div>
            </div>

            <div className="md:col-span-4 flex justify-end pt-1">
              <button
                type="submit"
                disabled={saving}
                className="rounded-2xl bg-sky-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-sky-400"
              >
                {saving ? "Saving…" : "Add slot"}
              </button>
            </div>
          </form>
        </Card>

        <Card
          title="Timetable preview"
          subtitle="Slots for the selected class and day, ordered by time."
        >
          {loading ? (
            <p className="text-sm app-muted">Loading timetable…</p>
          ) : !selectedClassId ? (
            <p className="text-sm app-muted">Choose a class above to see its timetable.</p>
          ) : filteredEntries.length === 0 ? (
            <p className="text-sm app-muted">
              No slots yet for {weekdayLabel}. Add your first activity above.
            </p>
          ) : (
            <div className="space-y-2">
              {filteredEntries.map((e) => (
                <div
                  key={e.id}
                  className="rounded-2xl border app-border bg-white px-4 py-3 text-sm"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{e.title}</p>
                      <p className="text-xs app-muted">
                        {e.start_time.slice(0, 5)} – {e.end_time.slice(0, 5)} · {weekdayLabel}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {e.is_therapy ? (
                        <span className="rounded-full bg-indigo-50 px-3 py-1 font-semibold text-indigo-700">
                          Therapy
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-50 px-3 py-1 font-semibold text-slate-700">
                          Class
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDelete(e.id)}
                        className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 font-semibold text-rose-700 hover:bg-rose-100"
                      >
                        Delete
                      </button>
                    </div>
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

