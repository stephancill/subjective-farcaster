import { NextRequest } from "next/server";
import {
  castEndpointCacheKey,
  getAllLikersByCast,
  getFidCount,
  getGraphIntersection,
} from "../../lib/utils";
import { HUB_HOST, HUB_SSL, HUB_URL } from "../../lib/const";
import { kv } from "@vercel/kv";
import { getHubClient } from "../../lib/hub";

export async function GET(req: NextRequest) {
  const hash = req.nextUrl.searchParams.get("hash");
  const fid = req.nextUrl.searchParams.get("fid");
  const viewerFidRaw = req.nextUrl.searchParams.get("viewerFid");

  if (!hash || !fid || !viewerFidRaw) {
    return new Response("Missing hash or fid or viewerFid", { status: 400 });
  }

  const hubClient = getHubClient(HUB_HOST!, { ssl: HUB_SSL });

  // Get all reactions to the cast
  const likedFids = await getAllLikersByCast(
    { fid: parseInt(fid), hash: hash as `0x${string}` },
    { hubClient }
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
    hubClient,
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
