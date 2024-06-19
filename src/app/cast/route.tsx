import { kv } from "@vercel/kv";
import { NextRequest } from "next/server";
import { HUB_URL, POPULATE_NETWORK_JOB_NAME } from "../../lib/const";
import { redis } from "../../lib/redis";
import {
  deserializeNetwork,
  getAllLikersByCast,
  getFidCount,
  getGraphIntersection,
  getNetworkByFidKey,
  getPopulateNetworkJobId,
} from "../../lib/utils";
import { getQueue } from "../../lib/worker";

export async function GET(req: NextRequest) {
  const hash = req.nextUrl.searchParams.get("hash");
  const fid = req.nextUrl.searchParams.get("fid");
  const viewerFidRaw = req.nextUrl.searchParams.get("viewerFid");

  if (!hash || !fid || !viewerFidRaw) {
    return new Response("Missing hash or fid or viewerFid", { status: 400 });
  }

  const queue = getQueue(redis);

  const viewerFid = parseInt(viewerFidRaw);

  const networkCacheKey = getNetworkByFidKey(viewerFid);
  const networkJobId = getPopulateNetworkJobId(viewerFid);

  const [viewerNetworkSerialized, networkJob] = await Promise.all([
    kv.get<{
      linksByDepth: Record<number, number[]>;
    }>(networkCacheKey),
    queue.getJob(networkJobId),
  ]);

  // Add jobs to queue
  await Promise.all([
    queue.add(
      POPULATE_NETWORK_JOB_NAME,
      {
        fid: viewerFid,
      },
      {
        jobId: networkJobId,
        priority: 100, // not important
      }
    ),
  ]);

  if (!viewerNetworkSerialized) {
    return Response.json({
      jobs: {
        networkJob: {
          status: networkJob?.progress || "Not started",
        },
      },
      status: networkJob?.progress ? "In progress" : "Not started",
    });
  }

  const viewerNetwork = deserializeNetwork(
    viewerNetworkSerialized.linksByDepth
  );

  const fidCount = await getFidCount();

  // Get all reactions to the cast
  const likedFids = await getAllLikersByCast(
    { fid: parseInt(fid), hash },
    { hubUrl: HUB_URL }
  );

  const {
    allLinks,
    intersectionFids,
    linksByDepth,
    ...graphIntersectionReturn
  } = await getGraphIntersection(viewerNetwork, likedFids);

  const returnValue = { ...graphIntersectionReturn, fidCount };

  console.log("Done", returnValue);

  return Response.json(returnValue);
}
