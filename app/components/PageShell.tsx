/* eslint-disable @next/next/no-img-element */
"use client"

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type NavItem = {
  href: string
  label: string
}

type PageShellProps = {
  title?: string
  subtitle?: string
  navItems?: NavItem[]
  variant?: 'public' | 'app'
  children: React.ReactNode
}

const BRAND = {
  name: 'Step Ahead Inclusive',
  logoUrl: '/Logo.png',
}

type Role = 'admin' | 'teacher' | 'therapist' | 'parent'

const BOTTOM_NAV: { href: string; label: string; role: Role }[] = [
  { href: '/admin', label: 'Admin', role: 'admin' },
  { href: '/teacher', label: 'Teacher', role: 'teacher' },
  { href: '/therapist', label: 'Therapist', role: 'therapist' },
  { href: '/parent', label: 'Parent', role: 'parent' },
]

export function PageShell({ title, subtitle, navItems, children, variant = 'app' }: PageShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<Role | null>(null)
  const [userName, setUserName] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (variant !== 'app') return

    let isMounted = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!isMounted) return
      const session = data.session
      setUserEmail(session?.user.email ?? null)
      const metaRole = (session?.user.app_metadata as any)?.role as Role | undefined
      setUserRole(metaRole ?? null)

      const uid = session?.user.id
      if (uid) {
        const { data: profile } = await supabase
          .from('users')
          .select('full_name')
          .eq('id', uid)
          .maybeSingle()
        if (profile?.full_name) {
          setUserName(profile.full_name)
        }
      }
    })

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUserEmail(session?.user.email ?? null)
      const metaRole = (session?.user.app_metadata as any)?.role as Role | undefined
      setUserRole(metaRole ?? null)
      const uid = session?.user.id
      if (uid) {
        const { data: profile } = await supabase
          .from('users')
          .select('full_name')
          .eq('id', uid)
          .maybeSingle()
        if (profile?.full_name) {
          setUserName(profile.full_name)
        } else {
          setUserName(null)
        }
      } else {
        setUserName(null)
      }
    })

    return () => {
      isMounted = false
      sub.subscription.unsubscribe()
    }
  }, [variant])

  const activeBottomHref = useMemo(() => {
    const found = BOTTOM_NAV.find((n) => pathname === n.href || pathname.startsWith(n.href + '/'))
    return found?.href ?? null
  }, [pathname])

  const canSeeNav = variant === 'app' && !!userEmail
  const hasSectionNav = !!navItems && navItems.length > 0
  const useSidebar = canSeeNav && variant === 'app' && hasSectionNav

  // Click-outside to close profile dropdown
  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: PointerEvent) => {
      const el = menuRef.current
      if (!el) return
      if (e.target instanceof Node && !el.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [menuOpen])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const roleHomeHref = userRole ? BOTTOM_NAV.find((n) => n.role === userRole)?.href ?? null : null

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b app-border bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link
            href={variant === 'app' && roleHomeHref ? roleHomeHref : '/'}
            className="flex items-center gap-3"
          >
            <span className="relative h-9 w-9 overflow-hidden rounded-xl border app-border bg-white">
              <Image src={BRAND.logoUrl} alt={BRAND.name} fill sizes="36px" />
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-slate-900">{BRAND.name}</p>
              <p className="text-xs app-muted">Empowering Every Child</p>
            </div>
          </Link>

          {!useSidebar && hasSectionNav ? (
            <nav className="hidden items-center gap-2 sm:flex">
              {navItems!.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(item.href + '/') || pathname === item.href + '/'
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-full px-3 py-1 text-sm font-medium ${
                      active
                        ? 'bg-sky-100 text-sky-900'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          ) : null}

          {canSeeNav ? (
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="inline-flex items-center gap-2 rounded-full border app-border bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                <span className="hidden sm:inline">
                  {userName?.trim() || userEmail || 'Profile'}
                </span>
                {userRole ? (
                  <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-800">
                    {userRole}
                  </span>
                ) : null}
                <span className="text-xs">▾</span>
              </button>

              {menuOpen ? (
                <div className="absolute right-0 mt-2 w-64 overflow-hidden rounded-2xl border app-border bg-white shadow-lg">
                  <div className="px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Signed in
                    </p>
                    {userName ? (
                      <p className="mt-1 text-sm font-semibold text-slate-900">{userName}</p>
                    ) : null}
                    <p className="mt-1 text-xs app-muted">{userEmail ?? '—'}</p>
                    <p className="mt-1 text-xs app-muted">
                      {userRole ? `Role: ${userRole}` : 'Role not set yet'}
                    </p>
                  </div>
                  <div className="border-t app-border" />
                  <div className="p-2">
                    <Link
                      href="/profile"
                      onClick={() => setMenuOpen(false)}
                      className="block w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Profile
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false)
                        handleLogout()
                      }}
                      className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-rose-700 hover:bg-rose-50"
                    >
                      Log out
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </header>

      <div className={`mx-auto flex max-w-6xl px-4 py-6 ${canSeeNav ? 'pb-24 sm:pb-6' : ''}`}>
        {useSidebar ? (
          <aside className="mr-4 hidden w-56 shrink-0 rounded-3xl border app-border bg-white/95 p-4 shadow-sm sm:flex sm:flex-col">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Navigation
            </p>
            <nav className="flex flex-1 flex-col gap-1">
              {navItems!.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(item.href + '/') || pathname === item.href + '/'
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center justify-between rounded-2xl px-3 py-2 text-sm font-semibold transition ${
                      active
                        ? 'bg-sky-100 text-sky-900'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>{item.label}</span>
                    {active ? <span className="text-xs text-sky-700">●</span> : null}
                  </Link>
                )
              })}
            </nav>
          </aside>
        ) : null}

        <main className="w-full flex-1">
          {title ? (
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
              {subtitle ? <p className="mt-1 text-sm app-muted">{subtitle}</p> : null}
            </div>
          ) : null}

          {children}
        </main>
      </div>

      {canSeeNav ? (
        <nav className="fixed bottom-0 left-0 right-0 z-30 border-t app-border bg-white/90 backdrop-blur sm:hidden">
          <div className="mx-auto grid max-w-5xl grid-cols-2 gap-2 px-2 py-2">
            {roleHomeHref ? (
              <Link
                href={roleHomeHref}
                className={`flex items-center justify-center rounded-2xl px-2 py-2 text-xs font-semibold ${
                  activeBottomHref === roleHomeHref
                    ? 'bg-sky-100 text-sky-900'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                Home
              </Link>
            ) : (
              <Link
                href="/"
                className={`flex items-center justify-center rounded-2xl px-2 py-2 text-xs font-semibold ${
                  pathname === '/' ? 'bg-sky-100 text-sky-900' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                Home
              </Link>
            )}

            {roleHomeHref ? (
              <Link
                href={roleHomeHref}
                className={`flex items-center justify-center rounded-2xl px-2 py-2 text-xs font-semibold ${
                  activeBottomHref === roleHomeHref
                    ? 'bg-sky-100 text-sky-900'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                Dashboard
              </Link>
            ) : (
              <span className="flex items-center justify-center rounded-2xl px-2 py-2 text-xs font-semibold text-slate-400">
                Dashboard
              </span>
            )}
          </div>
        </nav>
      ) : null}
    </div>
  )
}

