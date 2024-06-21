export function IntersectionPillView({
  count1,
  count2,
  count3,
}: {
  count1: string;
  count2: string;
  count3: string;
}) {
  return (
    <div
      style={{ border: "dashed 6px #322D3C" }}
      tw="flex rounded-full items-center pl-4 pr-2 py-2"
    >
      <div tw="flex mr-2 p-2">{count1.toLocaleString()}</div>
      <div tw="flex rounded-full bg-[#322D3C] pl-4 pr-2 py-2 items-center">
        <div tw="flex mr-2 p-2">{count2.toLocaleString()}</div>
        <div tw="flex rounded-full bg-[#484553] m-1 min-w-[70px]">
          <div tw="flex mx-auto px-4 py-2">{count3.toLocaleString()}</div>
        </div>
      </div>
    </div>
  );
}
