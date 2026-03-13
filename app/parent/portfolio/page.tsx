"use client"

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { PageShell } from '../../components/PageShell'
import { Card, StatCard } from '../../components/ui'

type ParentChild = {
  student_id: string
  student_name: string
}

type PortfolioRow = {
  id: string
  student_id: string
  type: string
  title: string
  description: string | null
  file_url: string | null
  created_at: string
}

export default function ParentPortfolioPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [children, setChildren] = useState<ParentChild[]>([])
  const [items, setItems] = useState<PortfolioRow[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError || !user) {
      router.push('/login')
      return
    }

    const { data: links, error: linksError } = await supabase
      .from('parents_students')
      .select('student_id, students(full_name)')
      .eq('parent_id', user.id)

    if (linksError) {
      setError(linksError.message)
      setLoading(false)
      return
    }

    const mapped: ParentChild[] =
      links?.map((row: any) => ({
        student_id: row.student_id,
        student_name: row.students?.full_name ?? 'Your child',
      })) ?? []
    setChildren(mapped)

    const ids = mapped.map((c) => c.student_id)
    const { data: itemData, error: itemError } = ids.length
      ? await supabase
          .from('portfolio_items')
          .select('id, student_id, type, title, description, file_url, created_at')
          .in('student_id', ids)
          .eq('is_visible_to_parent', true)
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

  const countByChild = useMemo(() => {
    const m: Record<string, number> = {}
    items.forEach((it) => {
      m[it.student_id] = (m[it.student_id] ?? 0) + 1
    })
    return m
  }, [items])

  return (
    <PageShell
      title="Portfolio"
      subtitle="Photos, videos, and milestones shared by school."
      navItems={[
        { href: '/parent', label: 'Dashboard' },
        { href: '/parent/timetable', label: 'Timetable' },
        { href: '/parent/fees', label: 'Fees' },
        { href: '/parent/leave', label: 'Leave' },
        { href: '/parent/portfolio', label: 'Portfolio' },
      ]}
    >
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Children" value={loading ? '…' : String(children.length)} hint="Linked" />
          <StatCard label="Items" value={loading ? '…' : String(items.length)} hint="Visible to you" />
          <StatCard label="Latest" value={loading || items.length === 0 ? '—' : new Date(items[0].created_at).toLocaleDateString()} hint="Most recent" />
        </div>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        {!loading && children.length === 0 ? (
          <Card title="No child linked" subtitle="Ask admin to link your account to your child.">
            <p className="text-sm app-muted">Once linked, portfolio items will appear here.</p>
          </Card>
        ) : null}

        {!loading && children.length > 0 ? (
          <Card title="By child" subtitle="Quick overview of items available.">
            <div className="grid gap-3 sm:grid-cols-2">
              {children.map((c) => (
                <div key={c.student_id} className="rounded-2xl border app-border bg-slate-50 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-900">{c.student_name}</p>
                  <p className="text-xs app-muted">{countByChild[c.student_id] ?? 0} item(s)</p>
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        <Card title="Gallery" subtitle="Newest first. Tap Open to view media.">
          {loading ? (
            <p className="text-sm app-muted">Loading…</p>
          ) : items.length === 0 ? (
            <p className="text-sm app-muted">No portfolio items yet.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.slice(0, 60).map((it) => {
                const childName =
                  children.find((c) => c.student_id === it.student_id)?.student_name ?? 'Child'
                const isImage = it.file_url?.match(/\.(png|jpe?g|webp|gif)(\?.*)?$/i)
                return (
                  <div key={it.id} className="overflow-hidden rounded-3xl border app-border bg-white shadow-sm">
                    {it.file_url && isImage ? (
                      <img
                        src={it.file_url}
                        alt={it.title}
                        className="h-40 w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-40 items-center justify-center bg-slate-50 text-xs font-semibold text-slate-600">
                        {it.type.toUpperCase()}
                      </div>
                    )}
                    <div className="p-4">
                      <p className="text-sm font-semibold text-slate-900">{it.title}</p>
                      <p className="mt-1 text-xs app-muted">
                        {childName} · {new Date(it.created_at).toLocaleDateString()}
                      </p>
                      {it.description ? (
                        <p className="mt-2 line-clamp-2 text-sm app-muted">{it.description}</p>
                      ) : null}
                      {it.file_url ? (
                        <a
                          href={it.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-flex w-full items-center justify-center rounded-2xl border app-border bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
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

