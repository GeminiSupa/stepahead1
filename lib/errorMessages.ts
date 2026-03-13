export function friendlySupabaseError(defaultMessage: string, error: any): string {
  const raw = typeof error === 'string' ? error : error?.message ?? ''
  if (!raw) return defaultMessage

  const lower = raw.toLowerCase()

  if (lower.includes('permission denied') || lower.includes('row-level security')) {
    return (
      'Your account is not allowed to perform this action. ' +
      'Check your role in public.users (e.g. admin/teacher/parent) and the school permissions.'
    )
  }

  if (lower.includes('invalid input') || lower.includes('violates')) {
    return 'The data you entered is not valid for this field. Please review the values and try again.'
  }

  return raw || defaultMessage
}

