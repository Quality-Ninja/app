import { utcIso } from '@/lib/views'

const formats = {
  time: new Intl.DateTimeFormat(undefined, { timeStyle: 'medium' }),
  date: new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }),
}

// Stored times are UTC; they show in the reader's timezone. A value that doesn't parse is shown as stored.
export function LocalTime({
  value,
  kind = 'date',
}: {
  value: string
  kind?: 'date' | 'time'
}) {
  const iso = utcIso(value)
  const date = new Date(iso)
  const text = Number.isNaN(date.getTime())
    ? kind === 'date'
      ? `${value} UTC`
      : value
    : formats[kind].format(date)
  return <time dateTime={iso}>{text}</time>
}
