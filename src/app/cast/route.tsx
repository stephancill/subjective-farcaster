import { NextRequest } from "next/server";
import { getAllLikersByCast, getGraphIntersection } from "../../lib/utils";
import { HUB_URL } from "../../lib/const";

export async function GET(req: NextRequest) {
  const hash = req.nextUrl.searchParams.get("hash");
  const fid = req.nextUrl.searchParams.get("fid");
  const viewerFidRaw = req.nextUrl.searchParams.get("viewerFid");

  if (!hash || !fid || !viewerFidRaw) {
    return new Response("Missing hash or fid or viewerFid", { status: 400 });
  }

  // Get all reactions to the cast
  const likedFids = await getAllLikersByCast(
    { fid: parseInt(fid), hash },
    { hubUrl: HUB_URL }
  );

  const viewerFid = parseInt(viewerFidRaw);

  const { allLinks, intersectionFids, linksByDepth, ...returnValue } =
    await getGraphIntersection(viewerFid, HUB_URL, likedFids);

  console.log("Done", returnValue);

  return Response.json(returnValue);
}
