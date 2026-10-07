'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { MinimalHeader } from '@/components/room/states';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="flex min-h-dvh flex-col">
      <MinimalHeader />
      <main className="flex flex-1 flex-col items-center justify-center px-5 pb-20 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
        <p className="mt-2 max-w-md text-muted">
          An unexpected error occurred. Try again — your room is safe on the server.
        </p>
        <Button className="mt-6" onClick={reset}>
          Try again
        </Button>
      </main>
    </div>
  );
}
