import type { Metadata } from 'next';
import { SummaryView } from '@/components/summary/summary-view';

export const metadata: Metadata = { title: 'Session history', robots: { index: false } };

export default async function Page({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  return <SummaryView roomId={roomId} />;
}
