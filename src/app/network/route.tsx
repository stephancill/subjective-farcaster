import { kv } from "@vercel/kv";
import { NextRequest } from "next/server";
import { POPULATE_NETWORK_JOB_NAME } from "../../lib/const";
import { redis } from "../../lib/redis";
import { SerializedNetwork } from "../../lib/types";
import {
  deserializeNetwork,
  getNetworkByFidKey,
  getPopulateNetworkJobId,
} from "../../lib/utils";
import { getQueue } from "../../lib/worker";

export async function GET(req: NextRequest) {
  const viewerFidRaw = req.nextUrl.searchParams.get("viewerFid");
  const forceRefresh = req.nextUrl.searchParams.get("forceRefresh") === "true";

  if (!viewerFidRaw) {
    return new Response("Missing viewerFid", { status: 400 });
  }

  const viewerFid = parseInt(viewerFidRaw);

  const queue = getQueue(redis);

  const networkCacheKey = getNetworkByFidKey(viewerFid);
  const networkJobId = getPopulateNetworkJobId(viewerFid);

  const [viewerNetworkSerialized, networkJob] = await Promise.all([
    kv.get<SerializedNetwork>(networkCacheKey),
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
        priority: forceRefresh ? 1 : 100,
      }
    ),
  ]);

  if (!viewerNetworkSerialized) {
    return Response.json({
      jobs: {
        [`Wider network of !${viewerFid}`]: {
          status: networkJob?.progress || "Not started",
        },
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
