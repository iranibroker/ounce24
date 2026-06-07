function calculateMarketOpenNY(date) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour12: false,
    weekday: 'long',
    hour: 'numeric',
    minute: 'numeric',
  });

  const parts = formatter.formatToParts(date);
  const weekday = parts.find((p) => p.type === 'weekday').value;
  const hour = parseInt(parts.find((p) => p.type === 'hour').value, 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute').value, 10);

  const timeInHours = hour + minute / 60;

  if (weekday === 'Saturday') {
    return false;
  }
  if (weekday === 'Sunday') {
    return timeInHours >= 18;
  }
  if (weekday === 'Friday') {
    return timeInHours < 17;
  }
  return timeInHours < 17 || timeInHours >= 18;
}

function getNYHour(date) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour12: false,
    hour: 'numeric',
  });
  return parseInt(formatter.formatToParts(date).find((p) => p.type === 'hour').value, 10);
}

function isVotingEnabled(now, cutoffHour, isMarketOpen) {
  if (!isMarketOpen) {
    return false;
  }
  const nyHour = getNYHour(now);
  const utcHours = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;

  return utcHours < cutoffHour || nyHour >= 18;
}

const cutoff = 10.5; // 10:30 AM UTC

const testCases = [
  { name: 'Saturday 12:00 UTC', date: new Date('2026-06-13T12:00:00Z'), expected: false },
  { name: 'Sunday 21:30 UTC (summer, before market open)', date: new Date('2026-06-07T21:30:00Z'), expected: false },
  { name: 'Sunday 22:30 UTC (summer, after market open)', date: new Date('2026-06-07T22:30:00Z'), expected: true },
  { name: 'Monday 08:00 UTC (before cutoff)', date: new Date('2026-06-08T08:00:00Z'), expected: true },
  { name: 'Monday 12:00 UTC (after cutoff, before market re-open)', date: new Date('2026-06-08T12:00:00Z'), expected: false },
  { name: 'Monday 22:30 UTC (summer, after market re-open)', date: new Date('2026-06-08T22:30:00Z'), expected: true },
  { name: 'Friday 08:00 UTC (before cutoff)', date: new Date('2026-06-12T08:00:00Z'), expected: true },
  { name: 'Friday 12:00 UTC (after cutoff)', date: new Date('2026-06-12T12:00:00Z'), expected: false },
  { name: 'Friday 22:30 UTC (summer, weekend close)', date: new Date('2026-06-12T22:30:00Z'), expected: false }
];

for (const tc of testCases) {
  const isMarketOpen = calculateMarketOpenNY(tc.date);
  const actual = isVotingEnabled(tc.date, cutoff, isMarketOpen);
  console.log(`${tc.name} -> actual: ${actual}, expected: ${tc.expected}, pass: ${actual === tc.expected}`);
}
