import { Job } from "bullmq";
import { getGraphIntersection, getNetworkByFid } from "./utils";
import { UserDataType } from "@farcaster/hub-nodejs";

export type GetGraphIntersectionResponse = Awaited<
  ReturnType<typeof getGraphIntersection>
> & {
  fidCount: number;
};

export type GetNetworkResponse = Awaited<ReturnType<typeof getNetworkByFid>>;

export type GetSuggestFollowsResponse = {
  usersToFollow: (Record<UserDataType, string> & {
    count: number;
    fid: number;
  })[];
};

export type SerializedNetwork = {
  linksByDepth: Record<number, number[]>;
  popularityByFid: Record<number, number>;
};

export type RefreshNetworkJobData = { fid: number };
