import { NextRequest } from "next/server";
import { getAllFollowersByFid, getGraphIntersection } from "../../lib/utils";
import { HUB_URL } from "../../lib/const";

export async function GET(req: NextRequest) {
  const fid = req.nextUrl.searchParams.get("fid");
  const viewerFidRaw = req.nextUrl.searchParams.get("viewerFid");

  if (!fid || !viewerFidRaw) {
    return new Response("Missing fid or viewerFid", { status: 400 });
  }

  // Get all followers of the fid
  const followerFids = await getAllFollowersByFid(parseInt(fid), {
    hubUrl: HUB_URL,
  });

  const viewerFid = parseInt(viewerFidRaw);

  const { allLinks, intersectionFids } = await getGraphIntersection(
    viewerFid,
    HUB_URL,
    followerFids
  );

  console.log(`Follower fids: ${followerFids.length}`);
  console.log(`Viewer network fids: ${Array.from(allLinks).length}`);
  console.log(`Intersection: ${intersectionFids.length}`);

  return Response.json({
    targetFids: followerFids.length,
    networkFids: Array.from(allLinks).length,
    intersectionFids: intersectionFids.length,
  });
}
