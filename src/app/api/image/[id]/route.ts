import { connection } from "next/server";
import { isValidDriveId, thumbnailUrl } from "@/lib/drive";
import { getImageIds, rereadDriveSoon } from "@/lib/playlist";

const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await ctx.params;
  if (!isValidDriveId(id)) return notFound();
  try {
    if (!(await getImageIds()).has(id)) return notFound();
    const upstream = await fetch(thumbnailUrl(id), {
      signal: AbortSignal.timeout(20_000),
      redirect: "follow",
      cache: "no-store",
    });
    const type = upstream.headers.get("content-type") ?? "";
    if (!upstream.ok || !type.startsWith("image/")) {
      // Listed but not fetchable: the file probably left the folder since the last listing.
      if (rereadDriveSoon()) console.warn(`[api/image] ${id} failed upstream (${upstream.status}); re-reading Drive`);
      return new Response("Bad upstream response", { status: 502, headers: { "Cache-Control": "no-store" } });
    }
    return new Response(await upstream.arrayBuffer(), {
      headers: {
        "Content-Type": type,
        // Safe to cache long: a replaced file gets a new ?v= in its URL (see fileVersion).
        "Cache-Control": "public, max-age=604800, s-maxage=604800",
      },
    });
  } catch (err) {
    console.error(`[api/image] ${(err as Error).message}`);
    return new Response("Error", { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
