import { Job } from "bullmq";
import { getGraphIntersection } from "./utils";

export type GetGraphIntersectionResponse = Awaited<
  ReturnType<typeof getGraphIntersection>
> & {
  fidCount: number;
};

export type RefreshNetworkJobData = { fid: number };
