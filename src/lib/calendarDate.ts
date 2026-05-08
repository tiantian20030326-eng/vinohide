/** 将「此刻」换算为指定 IANA 时区的日历日 YYYY-MM-DD（用于 plan_date / intent_date） */
export function calendarDateInTimeZone(
  timeZone: string,
  date: Date = new Date(),
): string {
  try {
    const s = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date)
    return s
  } catch {
    return date.toISOString().slice(0, 10)
  }
}
