import { redis } from "../src/lib/redis";
import { getWorker } from "../src/lib/worker";

async function main() {
  const concurrency = parseInt(process.env.WORKER_CONCURRENCY || "1");

  const worker = getWorker(redis, {
    concurrency,
  });

  worker.run();
}

main();
