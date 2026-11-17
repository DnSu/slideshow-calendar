import { Suspense } from "react";
import type { Metadata } from "next";
import CalendarPreview from "@/components/CalendarPreview";

export const metadata: Metadata = { title: "Calendar preview", robots: { index: false } };

type Query = Promise<Record<string, string | string[] | undefined>>;
type Props = { searchParams: Query };

/** Developer preview of the calendar page. The signage player itself runs at `/`. */
export default function CalendarPage({ searchParams }: Props) {
  // The query is request-time data, so it is read inside a Suspense boundary.
  return (
    <Suspense fallback={null}>
      <Preview searchParams={searchParams} />
    </Suspense>
  );
}

async function Preview({ searchParams }: Props) {
  const q = await searchParams;
  const requested = Number(q.page);
  const pinnedPage = Number.isInteger(requested) && requested >= 1 ? requested - 1 : null;
  return <CalendarPreview demo={q.demo !== undefined} pinnedPage={pinnedPage} />;
}
