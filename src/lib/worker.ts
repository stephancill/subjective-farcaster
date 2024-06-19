import { Redis } from "ioredis";
import { Job, Queue, Worker } from "bullmq";
import { RefreshNetworkJobData as FidJobData } from "./types";
import { getAllLinksByTarget, getNetworkByFid } from "./utils";
import {
  HUB_URL,
  POPULATE_FOLLOWERS_JOB_NAME,
  POPULATE_NETWORK_JOB_NAME,
} from "./const";

const QUEUE_NAME = "default";

export function getWorker(
  redis: Redis,
  { concurrency = 1 }: { concurrency: number }
) {
  console.log(`Creating worker with concurrency ${concurrency}`);

  const worker = new Worker(
    QUEUE_NAME,
    async (job: Job<FidJobData>) => {
      const {
        name,
        data: { fid },
        id: jobId,
      } = job;
      console.log(`Processing job ${name} for ${fid}`);

      if (name === POPULATE_NETWORK_JOB_NAME) {
        const start = Date.now();
        console.log(
          `Populating network for ${fid} at ${new Date().toISOString()}`
        );

        await getNetworkByFid(fid, {
          hubUrl: HUB_URL,
          onProgress(message) {
            console.log(jobId, message);
            job.updateProgress({ message });
          },
        });

        const elapsed = (Date.now() - start) / 1000;
        console.log(
          `Network populated for ${fid} at ${new Date().toISOString()} in ${elapsed} seconds`
        );
      } else if (name === POPULATE_FOLLOWERS_JOB_NAME) {
        const start = Date.now();
        console.log(
          `Populating followers for ${fid} at ${new Date().toISOString()}`
        );

        await getAllLinksByTarget(fid, {
          hubUrl: HUB_URL,
          onProgress(message) {
            console.log(jobId, message);
            job.updateProgress({ message });
          },
        });

        const elapsed = (Date.now() - start) / 1000;
        const completionMessage = `Followers populated for ${fid} at ${new Date().toISOString()} in ${elapsed} seconds`;
        console.log(completionMessage);
        await job.updateProgress({ message: completionMessage });
      }
    },
    {
      autorun: false, // Don't start yet
      useWorkerThreads: concurrency > 1,
      concurrency,
      connection: redis,
      removeOnComplete: { age: 60 * 12 }, // 1 hours
      removeOnFail: { count: 100 }, // Keep at most this many failed jobs
    }
  );

  return worker;
}

export function getQueue(redis: Redis) {
  return new Queue(QUEUE_NAME, {
    connection: redis,
    defaultJobOptions: {
      // attempts: 3,
      backoff: { delay: 1000, type: "exponential" },
    },
  });
}
