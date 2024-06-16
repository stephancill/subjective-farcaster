import { createFrames } from "frames.js/next";
import { APP_URL } from "../../lib/const";

export const frames = createFrames({
  baseUrl: APP_URL,
  basePath: "/frames",
  imagesRoute: "/",
});
