import { Suspense } from "react";
import type { Metadata } from "next";
import WeatherPreview from "@/components/WeatherPreview";

export const metadata: Metadata = {
  title: "Weather preview",
  robots: { index: false },
};

type Query = Promise<Record<string, string | string[] | undefined>>;
type Props = { searchParams: Query };

/** Developer preview of the weather slide. The signage player itself runs at `/`. */
export default function WeatherPage({ searchParams }: Props) {
  // The query is request-time data, so it is read inside a Suspense boundary.
  return (
    <Suspense fallback={null}>
      <Preview searchParams={searchParams} />
    </Suspense>
  );
}

async function Preview({ searchParams }: Props) {
  const q = await searchParams;
  return <WeatherPreview demo={q.demo !== undefined} />;
}
