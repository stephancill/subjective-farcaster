import { NextRequest } from "next/server";
import { redis } from "../../lib/redis";
import { deserializeNetwork, ensureNetworkViaJob } from "../../lib/utils";
import { getNetworkQueue } from "../../lib/worker";

export async function GET(req: NextRequest) {
  const viewerFidRaw = req.nextUrl.searchParams.get("viewerFid");
  const forceRefresh = req.nextUrl.searchParams.get("forceRefresh") === "true";

  if (!viewerFidRaw) {
    return new Response("Missing viewerFid", { status: 400 });
  }

  const viewerFid = parseInt(viewerFidRaw);

  const queue = getNetworkQueue(redis);

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

  const network = deserializeNetwork(viewerNetworkSerialized);

  const { allLinks, linksByDepth, popularityByFid, linksByDepthCounts } =
    network;

  return Response.json({
    linksByDepthCounts,
    allLinks: Array.from(allLinks),
    linksByDepth: Object.entries(linksByDepth).reduce((acc, [depth, links]) => {
      acc[depth] = Array.from(links);
      return acc;
    }, {} as Record<string, number[]>),
    popularityByFid,
  });
}
