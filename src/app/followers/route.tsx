import { kv } from "@vercel/kv";
import { Queue } from "bullmq";
import { NextRequest } from "next/server";
import { POPULATE_FOLLOWERS_JOB_NAME } from "../../lib/const";
import { redis } from "../../lib/redis";
import {
  deserializeNetwork,
  ensureNetworkViaJob,
  findJobPosition,
  getAllLinksByTargetKey,
  getFidCount,
  getGraphIntersection,
  getPopulateFollowersJobId,
} from "../../lib/utils";
import { getFollowersQueue, getNetworkQueue } from "../../lib/worker";

async function ensureFollowerFidsViaJob(fid: number, queue: Queue) {
  const linksByTargetCacheKey = getAllLinksByTargetKey(fid);
  const followersJobId = getPopulateFollowersJobId(fid);

  const [followers, followerFidsJob, followerFidsJobPosition] =
    await Promise.all([
      kv.get<number[]>(linksByTargetCacheKey),
      queue.getJob(followersJobId),
      findJobPosition(followersJobId, queue),
    ]);

  queue.add(
    POPULATE_FOLLOWERS_JOB_NAME,
    {
      fid,
    },
    {
      jobId: followersJobId,
    }
  );

  const jobDescriptor = {
    [`Followers for !${fid}`]: {
      status:
        followerFidsJob?.progress ||
        (followerFidsJobPosition
          ? `Position in queue: ${followerFidsJobPosition}`
          : "Not queued"),
    },
  };

  return { followers, jobDescriptor, followerFidsJob };
}

export async function GET(req: NextRequest) {
  const fidRaw = req.nextUrl.searchParams.get("fid");
  const viewerFidRaw = req.nextUrl.searchParams.get("viewerFid");

  if (!fidRaw || !viewerFidRaw) {
    return new Response("Missing fid or viewerFid", { status: 400 });
  }

  const viewerFid = parseInt(viewerFidRaw);
  const fid = parseInt(fidRaw);

  const networkQueue = getNetworkQueue(redis);
  const followersQueue = getFollowersQueue(redis);

  const [
    { followers, followerFidsJob, jobDescriptor: followerFidsJobDescriptor },
    {
      viewerNetworkSerialized,
      networkJob,
      jobDescriptor: networkJobDescriptor,
    },
  ] = await Promise.all([
    ensureFollowerFidsViaJob(fid, followersQueue),
    ensureNetworkViaJob(viewerFid, networkQueue),
  ]);

  if (!followers || !viewerNetworkSerialized) {
    return Response.json({
      jobs: {
        ...followerFidsJobDescriptor,
        ...networkJobDescriptor,
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
