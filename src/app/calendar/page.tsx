import type { Metadata } from "next";
import CalendarPreview from "@/components/CalendarPreview";

export const metadata: Metadata = { title: "Calendar preview", robots: { index: false } };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Developer preview of the calendar page. The signage player itself runs at `/`. */
export default async function CalendarPage({ searchParams }: Props) {
  const q = await searchParams;
  const requested = Number(q.page);
  const pinnedPage = Number.isInteger(requested) && requested >= 1 ? requested - 1 : null;
  return <CalendarPreview demo={q.demo !== undefined} pinnedPage={pinnedPage} />;
}
