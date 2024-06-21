import "dotenv/config";
import { redis } from "../src/lib/redis";
import { getFollowersWorker, getNetworkWorker } from "../src/lib/worker";

async function main() {
  const concurrency = parseInt(process.env.WORKER_CONCURRENCY || "1");

  const networkWorker = getNetworkWorker(redis, {
    concurrency,
  });

  const followersWorker = getFollowersWorker(redis, {
    concurrency,
  });

  followersWorker.run();

  await networkWorker.run();
}

main();
