import { createFrames } from "frames.js/next";
import { APP_URL } from "../../lib/const";
import * as fs from "node:fs/promises";
import * as path from "node:path";

export const frames = createFrames({
  debug: process.env.NODE_ENV === "development",
  baseUrl: APP_URL,
  basePath: "/frames",
  imagesRoute: "/",
  imageRenderingOptions: async () => {
    const interRegularFont = fs.readFile(
      path.join(path.resolve(process.cwd(), "public"), "Inter-Regular.ttf")
    );

    const interBoldFont = fs.readFile(
      path.join(path.resolve(process.cwd(), "public"), "Inter-Bold.ttf")
    );

    const [interRegularFontData, interBoldFontData] = await Promise.all([
      interRegularFont,
      interBoldFont,
    ]);
    return {
      imageOptions: {
        fonts: [
          {
            name: "Inter",
            data: interRegularFontData,
            weight: 400,
          },
          {
            name: "Inter",
            data: interBoldFontData,
            weight: 700,
          },
        ],
      },
    };
  },
});
