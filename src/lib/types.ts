import { getGraphIntersection } from "./utils";

export type GetGraphIntersectionResponse = Awaited<
  ReturnType<typeof getGraphIntersection>
> & {
  fidCount: number;
};
