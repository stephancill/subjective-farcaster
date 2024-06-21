import { Job, Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import {
  POPULATE_FOLLOWERS_JOB_NAME,
  POPULATE_NETWORK_JOB_NAME,
} from "./const";
import { hubClient } from "./hub";
import { RefreshNetworkJobData as FidJobData } from "./types";
import { getAllLinksByTarget, getNetworkByFid } from "./utils";

const NETWORK_QUEUE_NAME = "default";
const FOLLOWERS_QUEUE_NAME = "followers";

export function getNetworkWorker(
  redis: Redis,
  { concurrency = 1 }: { concurrency: number }
) {
  console.log(`Creating network worker with concurrency ${concurrency}`);

  const worker = new Worker(
    NETWORK_QUEUE_NAME,
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
          onProgress(message) {
            console.log(jobId, message);
            job.updateProgress({ message });
          },
        });

        const elapsed = (Date.now() - start) / 1000;
        console.log(
          `Network populated for ${fid} at ${new Date().toISOString()} in ${elapsed} seconds`
        );
      }
    },
    {
      autorun: false,
      useWorkerThreads: concurrency > 1,
      concurrency,
      connection: redis,
      removeOnComplete: { age: 60 * 12 }, // 12 hours
    }
  );

  return worker;
}

export function getFollowersWorker(
  redis: Redis,
  { concurrency = 1 }: { concurrency: number }
) {
  console.log(`Creating followers worker with concurrency ${concurrency}`);

  const worker = new Worker(
    FOLLOWERS_QUEUE_NAME,
    async (job: Job<FidJobData>) => {
      const {
        name,
        data: { fid },
        id: jobId,
      } = job;
      console.log(`Processing job ${name} for ${fid}`);

      if (name === POPULATE_FOLLOWERS_JOB_NAME) {
        const start = Date.now();
        console.log(
          `Populating followers for ${fid} at ${new Date().toISOString()}`
        );

        await getAllLinksByTarget(fid, {
          hubClient,
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
      autorun: false,
      useWorkerThreads: concurrency > 1,
      concurrency,
      connection: redis,
      removeOnComplete: { age: 60 * 12 }, // 12 hours
    }
  );

  return worker;
}

export function getNetworkQueue(redis: Redis) {
  return new Queue(NETWORK_QUEUE_NAME, {
    connection: redis,
    defaultJobOptions: {
      // attempts: 3,
      backoff: { delay: 1000, type: "exponential" },
    },
  });
}

export function getFollowersQueue(redis: Redis) {
  return new Queue(FOLLOWERS_QUEUE_NAME, {
    connection: redis,
    defaultJobOptions: {
      // attempts: 3,
      backoff: { delay: 1000, type: "exponential" },
    },
  });
}
