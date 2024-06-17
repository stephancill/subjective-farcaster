export function IntersectionPillView({
  count1,
  count2,
  count3,
}: {
  count1: number;
  count2: number;
  count3: number;
}) {
  return (
    <div
      style={{ border: "dashed 6px #322D3C" }}
      tw="flex rounded-full items-center pl-4 pr-2 py-2"
    >
      <div tw="flex mr-2 p-2">{count1.toLocaleString()}</div>
      <div tw="flex bg-[#322D3C] pl-4 pr-2 py-2 rounded-full">
        <div tw="flex mr-2 p-2">{count2.toLocaleString()}</div>
        <div tw="flex bg-[#484553] px-4 py-2 rounded-full">
          {count3.toLocaleString()}
        </div>
      </div>
    </div>
  );
}
