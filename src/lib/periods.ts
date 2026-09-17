export function periodTitle(period: number, halves: number): string {
  if (period <= halves) {
    if (halves === 2) return period === 1 ? "1st Half" : period === 2 ? "2nd Half" : `Half ${period}`;
    const ordinal = ["1st", "2nd", "3rd", "4th"][period - 1] ?? `${period}th`;
    return `${ordinal} Quarter`;
  }
  return `Extra Time ${period - halves}`;
}
