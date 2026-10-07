'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Toaster } from 'sonner';
import { ApiError } from '@/lib/api';
import { useIsDark } from './theme';

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            // Don't hammer the API for rooms that don't exist.
            retry: (count, error) =>
              !(error instanceof ApiError && error.status >= 400 && error.status < 500) &&
              count < 2,
          },
        },
      }),
  );
  const dark = useIsDark();
  return (
    <QueryClientProvider client={client}>
      {children}
      <Toaster
        theme={dark ? 'dark' : 'light'}
        position="top-center"
        offset={76}
        richColors
        closeButton
        toastOptions={{ className: 'font-sans' }}
      />
    </QueryClientProvider>
  );
}
