import { NextRequest } from "next/server";
import { HUB_URL } from "../../lib/const";
import { redis } from "../../lib/redis";
import {
  deserializeNetwork,
  ensureNetworkViaJob,
  getAllLikersByCast,
  getFidCount,
  getGraphIntersection,
} from "../../lib/utils";
import { getNetworkQueue } from "../../lib/worker";

export async function GET(req: NextRequest) {
  const hash = req.nextUrl.searchParams.get("hash");
  const fid = req.nextUrl.searchParams.get("fid");
  const viewerFidRaw = req.nextUrl.searchParams.get("viewerFid");

  if (!hash || !fid || !viewerFidRaw) {
    return new Response("Missing hash or fid or viewerFid", { status: 400 });
  }

  const queue = getNetworkQueue(redis);

  const viewerFid = parseInt(viewerFidRaw);

  const { viewerNetworkSerialized, networkJob, jobDescriptor } =
    await ensureNetworkViaJob(viewerFid, queue);

  if (!viewerNetworkSerialized) {
    return Response.json({
      jobs: {
        ...jobDescriptor,
      },
      status: networkJob?.progress ? "In progress" : "Not started",
    });
  }

  const viewerNetwork = deserializeNetwork(viewerNetworkSerialized);

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
