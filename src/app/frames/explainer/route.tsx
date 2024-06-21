import { NextRequest } from "next/server";
import { frames } from "../frames";
import { IntersectionPillView } from "../components/IntersectionPillView";

export const POST = frames(async (ctx) => {
  const backTarget = ctx.searchParams.backTarget;

  return {
    image: (
      <div tw="flex flex-col bg-[#17101F] text-white w-full h-full text-[48px] text-[#A0A3AF] items-center justify-center">
        <IntersectionPillView
          count1="Unfiltered"
          count2="Wider network"
          count3="Following"
        />
        <div tw="flex flex-col mt-10 text-[36px]">
          <div tw="flex mb-5">
            <div style={{ fontWeight: 700 }} tw="flex">
              Unfiltered:
            </div>
            <div tw="ml-2">Raw number of messages on the network</div>
          </div>
          <div tw="flex mb-5">
            <div style={{ fontWeight: 700 }} tw="flex">
              Wider network:
            </div>
            <div tw="ml-2">Accounts followed by accounts that you follow</div>
          </div>
          <div tw="flex mb-5">
            <div style={{ fontWeight: 700 }} tw="flex">
              Following:
            </div>
            <div tw="ml-2">Accounts followed by you</div>
          </div>
        </div>
      </div>
    ),
    buttons: [
      {
        action: "post",
        label: "← Back",
        target: backTarget,
      },
    ],
  };
});
