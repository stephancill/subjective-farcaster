import { fetchMetadata } from "frames.js/next";
import { APP_URL } from "../lib/const";

export async function generateMetadata() {
  const frameMetadata = await fetchMetadata(`${APP_URL}/frames`);
  return {
    title: "Subjective Farcaster",
    description:
      "Reaction and follow counts on farcaster based on an FID's wider network.",
    other: {
      ...frameMetadata,
    },
  };
}

export default function Home() {
  return (
    <div>
      <a href="https://github.com/stephancill/subjective-farcaster">GitHub</a>
    </div>
  );
}
