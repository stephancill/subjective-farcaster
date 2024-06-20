import "dotenv/config";
import { HUB_URL } from "../src/lib/const";
import { getNetworkByFid } from "../src/lib/utils";

async function main() {
  const network = await getNetworkByFid(3, {
    hubUrl: HUB_URL,
    onProgress(message) {
      console.log(message);
    },
  });
}

main();
