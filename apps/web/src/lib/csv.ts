import type { RoomSummary } from '@pokerplan/shared';

/** RFC 4180 escaping + neutralises spreadsheet formula injection (`=`, `+`, `-`, `@`). */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  let s = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}

/** One row per story with its final estimate and the stats of the last revealed round. */
export function summaryToCsv(summary: RoomSummary): string {
  const header = [
    '#',
    'Story',
    'Link',
    'Status',
    'Final estimate',
    'Rounds',
    'Average',
    'Median',
    'Agreement %',
    'Votes (last round)',
    'Estimated at',
  ];
  const rows = summary.stories.map((story, i) => {
    const last = story.rounds.at(-1);
    return [
      i + 1,
      story.title,
      story.link,
      story.status === 'ESTIMATED' ? 'Estimated' : 'Not estimated',
      story.finalEstimate,
      story.rounds.length,
      last?.stats?.average ?? null,
      last?.stats?.median ?? null,
      last?.stats ? Math.round(last.stats.agreement * 100) : null,
      last?.votes.map((v) => `${v.participantName}: ${v.value}`).join('; ') ?? '',
      story.estimatedAt,
    ];
  });
  return toCsv([header, ...rows]);
}

export function csvFileName(summary: RoomSummary): string {
  const slug = summary.room.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `pokerplan-${slug || summary.room.id}-${summary.room.createdAt.slice(0, 10)}.csv`;
}

export function downloadCsv(filename: string, csv: string): void {
  // BOM so Excel opens UTF-8 (☕, ½, names with accents) correctly.
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
