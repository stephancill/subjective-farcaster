import { NextRequest } from "next/server";
import { getAllLikersByCast, getGraphIntersection } from "../../lib/utils";
import { HUB_URL } from "../../lib/const";

export async function GET(req: NextRequest) {
  const hash = req.nextUrl.searchParams.get("hash");
  const fid = req.nextUrl.searchParams.get("fid");
  const viewerFid = req.nextUrl.searchParams.get("viewerFid");

  if (!hash || !fid || !viewerFid) {
    return new Response("Missing hash or fid or viewerFid", { status: 400 });
  }

  // Get all reactions to the cast
  const likedFids = await getAllLikersByCast(
    { fid: parseInt(fid), hash },
    { hubUrl: HUB_URL }
  );

  const _viewerFid = parseInt(viewerFid);

  const { allLinks, intersectionFids } = await getGraphIntersection(
    _viewerFid,
    HUB_URL,
    likedFids
  );

  console.log(`Liked fids: ${likedFids.length}`);
  console.log(`All links: ${Array.from(allLinks).length}`);
  console.log(`Mutual likes: ${intersectionFids.length}`);

  return Response.json({
    targetFids: likedFids.length,
    networkFids: Array.from(allLinks).length,
    intersectionFids: intersectionFids.length,
  });
}
