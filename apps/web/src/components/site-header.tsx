import Link from 'next/link';
import { GithubIcon } from './github-icon';
import { Logo } from './logo';
import { ThemeToggle } from './theme';

export const REPO_URL = 'https://github.com/lalitkumarrajak/pokerplan';

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-bg/75 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Logo />
        <nav className="flex items-center gap-1 text-sm" aria-label="Main">
          <Link
            href="/#how-it-works"
            className="hidden rounded-lg px-3 py-2 text-muted transition hover:text-fg sm:block"
          >
            How it works
          </Link>
          <Link
            href="/#features"
            className="hidden rounded-lg px-3 py-2 text-muted transition hover:text-fg sm:block"
          >
            Features
          </Link>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex size-9 items-center justify-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-fg"
            aria-label="Source code on GitHub"
          >
            <GithubIcon className="size-[18px]" />
          </a>
          <ThemeToggle />
          <Link
            href="/#create"
            className="ml-1 hidden h-9 items-center rounded-lg bg-fg px-3.5 text-[13px] font-medium text-bg transition hover:opacity-90 sm:inline-flex"
          >
            Start a session
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-8 text-sm text-muted sm:flex-row">
        <p>
          Built by{' '}
          <a
            href="https://github.com/lalitkumarrajak"
            className="font-medium text-fg hover:text-primary"
            target="_blank"
            rel="noreferrer"
          >
            Lalit Kumar Rajak
          </a>{' '}
          · Next.js, NestJS, Socket.IO &amp; PostgreSQL
        </p>
        <a
          href={REPO_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 hover:text-fg"
        >
          <GithubIcon className="size-4" /> View source
        </a>
      </div>
    </footer>
  );
}
