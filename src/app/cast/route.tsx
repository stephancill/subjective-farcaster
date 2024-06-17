import { NextRequest } from "next/server";
import {
  castEndpointCacheKey,
  getAllLikersByCast,
  getFidCount,
  getGraphIntersection,
} from "../../lib/utils";
import { HUB_URL } from "../../lib/const";
import { kv } from "@vercel/kv";

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

  const fidCount = await getFidCount();

  const {
    allLinks,
    intersectionFids,
    linksByDepth,
    ...graphIntersectionReturn
  } = await getGraphIntersection(
    viewerFid,
    HUB_URL,
    likedFids,
    (progressMessage) => {
      const cacheKey = castEndpointCacheKey(
        { fid: parseInt(fid), hash },
        viewerFid
      );
      kv.set(cacheKey, { status: progressMessage }, { ex: 60 * 60 });
      console.log("Progress", progressMessage);
    }
  );

  const returnValue = { ...graphIntersectionReturn, fidCount };

  console.log("Done", returnValue);

  return Response.json(returnValue);
}
