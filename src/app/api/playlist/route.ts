import { connection } from "next/server";
import { getPlaylist } from "@/lib/playlist";

export async function GET() {
  await connection();
  try {
    const playlist = await getPlaylist();
    return Response.json(playlist, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch (err) {
    console.error(`[api/playlist] ${(err as Error).message}`);
    return Response.json({ error: (err as Error).message }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
