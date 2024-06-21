import { fetchMetadata } from "frames.js/next";
import { Metadata } from "next";
import { APP_URL } from "../../lib/const";

export async function generateMetadata(): Promise<Metadata> {
  const frameMetadata = await fetchMetadata(
    `${APP_URL}/frames/suggest-follows`
  );

  return {
    title: "Suggest Follows - Subjective Farcaster",
    description: "Discover new people to follow on Farcaster",
    other: {
      ...frameMetadata,
    },
  };
}

export default function Page() {
  return <div>Subjective Farcaster</div>;
}
