import { NextRequest } from "next/server";
import {
  followingEndpointCacheKey,
  getAllFollowersByFid,
  getFidCount,
  getGraphIntersection,
} from "../../lib/utils";
import { HUB_HOST, HUB_SSL, HUB_URL, STATUS_CACHE_EX } from "../../lib/const";
import { kv } from "@vercel/kv";
import { getHubClient } from "../../lib/hub";

export async function GET(req: NextRequest) {
  const fid = req.nextUrl.searchParams.get("fid");
  const viewerFidRaw = req.nextUrl.searchParams.get("viewerFid");

  if (!fid || !viewerFidRaw) {
    return new Response("Missing fid or viewerFid", { status: 400 });
  }

  const viewerFid = parseInt(viewerFidRaw);

  const cacheKey = followingEndpointCacheKey(parseInt(fid), viewerFid);

  kv.set(
    cacheKey,
    { status: `Getting all followers of ${fid}` },
    { ex: STATUS_CACHE_EX }
  );

  const hubClient = getHubClient(HUB_HOST!, { ssl: HUB_SSL });

  // Get all followers of the fid
  const followerFids = await getAllFollowersByFid(parseInt(fid), {
    hubClient,
    onProgress(message) {
      kv.set(
        cacheKey,
        { status: message },
        {
          ex: STATUS_CACHE_EX,
        }
      );
      console.log("Progress", message);
    },
  });

  const fidCount = await getFidCount();

  const { allLinks, intersectionFids, linksByDepth, ...returnValue } = {
    ...(await getGraphIntersection(
      viewerFid,
      hubClient,
      followerFids,
      (progressMessage) => {
        kv.set(cacheKey, { status: progressMessage }, { ex: STATUS_CACHE_EX });
        console.log("Progress", progressMessage);
      }
    )),
    fidCount,
  };

  console.log("Done", returnValue);

  return Response.json(returnValue);
}
