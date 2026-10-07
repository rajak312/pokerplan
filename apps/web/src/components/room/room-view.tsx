'use client';

import { CardDeck } from './card-deck';
import { CurrentStory } from './current-story';
import { ParticipantsPanel } from './participants-panel';
import { ResultsPanel } from './results-panel';
import { RoomHeader } from './room-header';
import { StoriesPanel } from './stories-panel';
import { VotingTable } from './voting-table';
import { ConnectionBanner } from './connection-banner';

export function RoomView() {
  return (
    <div className="flex min-h-dvh flex-col">
      <RoomHeader />
      <ConnectionBanner />
      <div className="mx-auto grid w-full max-w-[1440px] flex-1 items-start gap-5 px-4 pt-5 pb-48 sm:px-5 lg:grid-cols-[minmax(260px,300px)_1fr] xl:grid-cols-[300px_1fr_280px]">
        <main className="order-1 flex min-w-0 flex-col gap-5 lg:order-2" aria-label="Voting">
          <CurrentStory />
          <VotingTable />
          <ResultsPanel />
        </main>
        <aside
          className="order-3 lg:sticky lg:top-[84px] lg:order-1 lg:row-span-2 xl:row-span-1"
          aria-label="Stories"
        >
          <StoriesPanel />
        </aside>
        <aside
          className="order-2 lg:order-3 lg:col-start-2 xl:sticky xl:top-[84px] xl:col-start-3"
          aria-label="Participants"
        >
          <ParticipantsPanel />
        </aside>
      </div>
      <CardDeck />
    </div>
  );
}
