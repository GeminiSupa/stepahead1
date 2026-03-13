export const PORTFOLIO_BUCKET = 'portfolio'

export function portfolioObjectPath(opts: {
  studentId: string
  filename: string
  createdById: string
}) {
  const safeName = opts.filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}`
  return `${opts.studentId}/${yyyy}-${mm}-${dd}/${opts.createdById}/${id}-${safeName}`
}

