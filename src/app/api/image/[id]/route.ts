import { connection } from "next/server";
import { isValidDriveId, thumbnailUrl } from "@/lib/drive";
import { fitForScreen, imageHeaders, rasterType } from "@/lib/imageResponse";
import { getImageVersions, rereadDriveSoon } from "@/lib/playlist";

const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await ctx.params;
  if (!isValidDriveId(id)) return notFound();
  try {
    const versions = await getImageVersions();
    if (!versions.has(id)) return notFound();
    // Only the current version's URL is served, so a made-up ?v= can't skip the CDN cache and
    // make this re-fetch (and re-shrink) the picture. A screen with an older playlist gets a
    // 404, skips the picture and loads the new playlist.
    const v = new URL(req.url).searchParams.get("v") ?? undefined;
    if (v !== versions.get(id)) return notFound();
    const upstream = await fetch(thumbnailUrl(id), {
      signal: AbortSignal.timeout(20_000),
      redirect: "follow",
      cache: "no-store",
    });
    const raw = upstream.headers.get("content-type") ?? "";
    if (!upstream.ok || !raw.startsWith("image/")) {
      // Listed but not fetchable: the file probably left the folder since the last listing.
      if (rereadDriveSoon()) console.warn(`[api/image] ${id} failed upstream (${upstream.status}); re-reading Drive`);
      return new Response("Bad upstream response", { status: 502, headers: { "Cache-Control": "no-store" } });
    }
    // Only plain raster pictures are passed on (an SVG could run script on this site).
    const type = rasterType(raw);
    if (!type) {
      console.warn(`[api/image] ${id}: refusing upstream type "${raw}"`);
      return new Response("Unsupported image type", { status: 502, headers: { "Cache-Control": "no-store" } });
    }
    // Pictures that already fit are passed on untouched; oversized ones are made smaller.
    const fitted = await fitForScreen(new Uint8Array(await upstream.arrayBuffer()), type);
    if (fitted.shrunkFrom)
      console.warn(`[api/image] ${id}: shrank ${fitted.shrunkFrom} bytes to ${fitted.body.length}`);
    const shrunk = fitted.shrunkFrom ? { from: fitted.shrunkFrom, to: fitted.body.length } : undefined;
    return new Response(fitted.body, { headers: imageHeaders(fitted.type, shrunk) });
  } catch (err) {
    console.error(`[api/image] ${(err as Error).message}`);
    return new Response("Error", { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
