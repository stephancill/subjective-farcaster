import { kv } from "@vercel/kv";
import { FrameDefinition } from "frames.js/types";
import { ResultsView } from "../app/frames/components/ResultsView";
import { RESULT_CACHE_EX, STATUS_CACHE_EX } from "./const";
import { GetGraphIntersectionResponse } from "./types";

export async function graphIntesectionFrame({
  fetchIntersectionUrl,
  intersectionName,
  refreshButtonTarget,
}: {
  refreshButtonTarget: string;
  intersectionName: string;
  fetchIntersectionUrl: string;
}): Promise<FrameDefinition<undefined>> {
  const refreshButton = {
    label: "Refresh ⟳",
    action: "post",
    target: refreshButtonTarget,
  } as const;

  const result:
    | GetGraphIntersectionResponse
    | {
        status: string;
        jobs: Record<string, { status: { message: string } }>;
      } = await fetch(fetchIntersectionUrl).then((res) => res.json());

  if ("status" in result) {
    return {
      image: (
        <div tw="flex flex-col p-10 text-[58px] bg-[#17101F] text-white w-full h-full justify-center items-center">
          <div tw="flex">{result.status}</div>
          <div tw="flex flex-col mt-10 text-[40px]">
            {Object.entries(result.jobs).map(([name, job]) => (
              <div tw="flex" key={name}>
                {name}: {job.status.message}
              </div>
            ))}
          </div>
        </div>
      ),
      buttons: [refreshButton],
    };
  } else {
    return {
      image: <ResultsView results={result}>{intersectionName}</ResultsView>,
    };
  }
}
