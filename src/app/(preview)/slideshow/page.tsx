import { Suspense } from "react";
import type { Metadata } from "next";
import SlideshowPreview from "@/components/SlideshowPreview";

export const metadata: Metadata = {
  title: "Slideshow preview",
  robots: { index: false },
};

type Query = Promise<Record<string, string | string[] | undefined>>;
type Props = { searchParams: Query };

/** Developer preview of the slideshow in a portrait 9:16 frame. The signage player itself runs at `/`. */
export default function SlideshowPage({ searchParams }: Props) {
  // The query is request-time data, so it is read inside a Suspense boundary.
  return (
    <Suspense fallback={null}>
      <Preview searchParams={searchParams} />
    </Suspense>
  );
}

async function Preview({ searchParams }: Props) {
  const q = await searchParams;
  return <SlideshowPreview demo={q.demo !== undefined} />;
}
