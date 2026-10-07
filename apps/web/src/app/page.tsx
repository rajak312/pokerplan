import {
  BarChart3,
  Clock3,
  Crown,
  Eye,
  FileSpreadsheet,
  Keyboard,
  Link2,
  ListChecks,
  MousePointerClick,
  RefreshCcw,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react';
import { HeroCards } from '@/components/landing/hero-cards';
import { CreateRoomForm } from '@/components/landing/create-room-form';
import { SiteFooter, SiteHeader } from '@/components/site-header';

const steps = [
  {
    icon: MousePointerClick,
    title: 'Create a room',
    body: 'Name it, pick a deck — Fibonacci, modified Fibonacci, T-shirt sizes or powers of 2.',
  },
  {
    icon: Link2,
    title: 'Share the link',
    body: 'Teammates join with just a display name. No accounts, no installs, no friction.',
  },
  {
    icon: Eye,
    title: 'Vote, reveal, agree',
    body: 'Cards stay hidden until the facilitator reveals them, so nobody anchors on the loudest voice.',
  },
];

const features = [
  {
    icon: Zap,
    title: 'Real-time by default',
    body: 'Votes, presence and story changes sync instantly over WebSockets.',
  },
  {
    icon: BarChart3,
    title: 'Results that start the conversation',
    body: 'Average, median, agreement score, distribution and outliers at a glance.',
  },
  {
    icon: ListChecks,
    title: 'Story queue',
    body: 'Add, edit, reorder and link stories. Final estimates are saved to each one.',
  },
  {
    icon: Crown,
    title: 'Facilitator controls',
    body: 'Reveal, re-vote, move on, remove a ghost seat or hand over the role.',
  },
  {
    icon: Clock3,
    title: 'Synced round timer',
    body: 'Time-box discussions. Cards flip automatically when time runs out.',
  },
  {
    icon: RefreshCcw,
    title: 'Survives bad Wi-Fi',
    body: 'Refresh or reconnect and you keep your seat and your vote. The server is the source of truth.',
  },
  {
    icon: FileSpreadsheet,
    title: 'History & CSV export',
    body: 'Every round is stored. Export the session summary straight into your backlog tool.',
  },
  {
    icon: Keyboard,
    title: 'Keyboard first',
    body: 'Type 5, 13 or XL to vote. Accessible, responsive and dark-mode ready.',
  },
];

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="hero-glow pointer-events-none absolute inset-0" />
          <div className="bg-grid pointer-events-none absolute inset-0 opacity-60" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pt-14 pb-20 lg:grid-cols-[1.1fr_1fr] lg:pt-20">
            <div className="animate-rise">
              <p className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/70 px-3 py-1 text-xs font-medium text-muted shadow-xs backdrop-blur">
                <Sparkles className="size-3.5 text-primary" /> Free · No sign-up · Real-time
              </p>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
                Estimate together.
                <br />
                <span className="bg-gradient-to-r from-primary to-fuchsia-500 bg-clip-text text-transparent">
                  Agree faster.
                </span>
              </h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-pretty text-muted">
                PokerPlan is planning poker for distributed Scrum teams. Share a link, vote in
                secret, reveal together — and spend your refinement time on the stories that
                actually need discussion.
              </p>
              <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
                <li className="flex items-center gap-2">
                  <Users className="size-4 text-primary" /> Unlimited participants
                </li>
                <li className="flex items-center gap-2">
                  <Eye className="size-4 text-primary" /> Spectator mode
                </li>
                <li className="flex items-center gap-2">
                  <FileSpreadsheet className="size-4 text-primary" /> CSV export
                </li>
              </ul>
              <HeroCards className="mt-12 hidden sm:block lg:justify-start" />
            </div>

            <div id="create" className="animate-rise scroll-mt-24 [animation-delay:120ms]">
              <div className="rounded-3xl border border-border bg-surface/90 p-6 shadow-lift backdrop-blur sm:p-7">
                <h2 className="text-xl font-semibold tracking-tight">Start a planning session</h2>
                <p className="mt-1 mb-6 text-sm text-muted">
                  Takes ten seconds. Invite your team right after.
                </p>
                <CreateRoomForm />
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="scroll-mt-20 border-t border-border bg-surface/50">
          <div className="mx-auto max-w-6xl px-5 py-20">
            <p className="text-sm font-semibold text-primary">How it works</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">
              From backlog to estimates in three steps
            </h2>
            <ol className="mt-10 grid gap-5 md:grid-cols-3">
              {steps.map((s, i) => (
                <li
                  key={s.title}
                  className="relative rounded-2xl border border-border bg-surface p-6 shadow-card"
                >
                  <span className="absolute top-5 right-5 font-mono text-sm text-subtle">
                    0{i + 1}
                  </span>
                  <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <s.icon className="size-5" />
                  </span>
                  <h3 className="mt-4 font-semibold">{s.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-20 border-t border-border">
          <div className="mx-auto max-w-6xl px-5 py-20">
            <p className="text-sm font-semibold text-primary">Features</p>
            <h2 className="mt-2 max-w-xl text-3xl font-semibold tracking-tight">
              Everything a refinement session needs. Nothing it doesn&apos;t.
            </h2>
            <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
              {features.map((f) => (
                <div key={f.title} className="bg-surface p-6 transition hover:bg-surface-2/60">
                  <f.icon className="size-5 text-primary" />
                  <h3 className="mt-4 text-[15px] font-semibold">{f.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-border">
          <div className="mx-auto max-w-6xl px-5 py-20">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#4b3ae0] to-[#7c3aed] px-8 py-14 text-center text-white shadow-lift">
              <div className="card-back pointer-events-none absolute inset-0 opacity-40" />
              <h2 className="relative text-3xl font-semibold tracking-tight">
                Your next refinement starts here
              </h2>
              <p className="relative mx-auto mt-3 max-w-md text-white/80">
                Create a room, drop the link in your team chat and start estimating in under a
                minute.
              </p>
              <a
                href="#create"
                className="relative mt-7 inline-flex h-12 items-center rounded-xl bg-white px-6 font-medium text-[#3b2bd0] shadow-sm transition hover:bg-white/90"
              >
                Create a free room
              </a>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
