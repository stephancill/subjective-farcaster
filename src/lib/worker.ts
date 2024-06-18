import { Redis } from "ioredis";
import { Job, Queue, Worker } from "bullmq";
import { RefreshNetworkJobData } from "./types";
import { getUserNetwork } from "./utils";
import { HUB_URL, REFRESH_NETWORK_JOB_NAME } from "./const";

const QUEUE_NAME = "default";

export function getWorker(
  redis: Redis,
  { concurrency = 1 }: { concurrency: number }
) {
  const worker = new Worker(
    QUEUE_NAME,
    async ({ name, data, updateProgress }: Job<RefreshNetworkJobData>) => {
      if (name === REFRESH_NETWORK_JOB_NAME) {
        const start = Date.now();

        await getUserNetwork(data.fid, {
          hubUrl: HUB_URL,
          onProgress(message) {
            updateProgress({ message });
          },
        });

        const elapsed = (Date.now() - start) / 1000;
        console.log(
          `Network refreshed for ${
            data.fid
          } at ${new Date().toISOString()} in ${elapsed} seconds`
        );
      }
    },
    {
      autorun: false, // Don't start yet
      useWorkerThreads: concurrency > 1,
      concurrency,
      connection: redis,
      removeOnComplete: { count: 100 }, // Keep at most this many completed jobs
      removeOnFail: { count: 100 }, // Keep at most this many failed jobs
    }
  );

  return worker;
}

export function getQueue(redis: Redis) {
  return new Queue("default", {
    connection: redis,
    defaultJobOptions: {
      attempts: 3,
      backoff: { delay: 1000, type: "exponential" },
    },
  });
}
