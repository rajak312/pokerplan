import type { Metadata } from 'next';
import { RoomPage } from '@/components/room/room-page';

export const metadata: Metadata = {
  title: 'Planning room',
  robots: { index: false },
};

export default async function Page({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  return <RoomPage roomId={roomId} />;
}
