import { kv } from "@vercel/kv";
import { NextRequest } from "next/server";
import {
  POPULATE_FOLLOWERS_JOB_NAME,
  POPULATE_NETWORK_JOB_NAME,
} from "../../lib/const";
import { redis } from "../../lib/redis";
import { SerializedNetwork } from "../../lib/types";
import {
  deserializeNetwork,
  getAllLinksByTargetKey,
  getFidCount,
  getGraphIntersection,
  getNetworkByFidKey,
  getPopulateFollowersJobId,
  getPopulateNetworkJobId,
} from "../../lib/utils";
import { getQueue } from "../../lib/worker";

export async function GET(req: NextRequest) {
  const fidRaw = req.nextUrl.searchParams.get("fid");
  const viewerFidRaw = req.nextUrl.searchParams.get("viewerFid");

  if (!fidRaw || !viewerFidRaw) {
    return new Response("Missing fid or viewerFid", { status: 400 });
  }

  const viewerFid = parseInt(viewerFidRaw);
  const fid = parseInt(fidRaw);

  const queue = getQueue(redis);

  const linksByTargetCacheKey = getAllLinksByTargetKey(fid);
  const followersJobId = getPopulateFollowersJobId(fid);
  const networkCacheKey = getNetworkByFidKey(viewerFid);
  const networkJobId = getPopulateNetworkJobId(viewerFid);

  const [followers, followerFidsJob, viewerNetworkSerialized, networkJob] =
    await Promise.all([
      kv.get<number[]>(linksByTargetCacheKey),
      queue.getJob(followersJobId),
      kv.get<SerializedNetwork>(networkCacheKey),
      queue.getJob(networkJobId),
    ]);

  // Add jobs to queue
  await Promise.all([
    queue.add(
      POPULATE_FOLLOWERS_JOB_NAME,
      {
        fid,
      },
      {
        jobId: followersJobId,
        priority: followers ? 100 : 1, // not important if already found
      }
    ),
    queue.add(
      POPULATE_NETWORK_JOB_NAME,
      {
        fid: viewerFid,
      },
      {
        jobId: networkJobId,
        priority: viewerNetworkSerialized ? 100 : 1, // not important if already found
      }
    ),
  ]);

  if (!followers || !viewerNetworkSerialized) {
    return Response.json({
      jobs: {
        [`Followers for !${fid}`]: {
          status: followerFidsJob?.progress || "Not started",
        },
        [`Wider network of !${viewerFid}`]: {
          status: networkJob?.progress || "Not started",
        },
      },
      status:
        followerFidsJob?.progress || networkJob?.progress
          ? "In progress"
          : "Not started",
    });
  }

  const viewerNetwork = deserializeNetwork(viewerNetworkSerialized);

  const fidCount = await getFidCount();

  const { allLinks, intersectionFids, linksByDepth, ...returnValue } = {
    ...(await getGraphIntersection(viewerNetwork, followers)),
    fidCount,
  };

  console.log("Done", returnValue);

  return Response.json(returnValue);
}
