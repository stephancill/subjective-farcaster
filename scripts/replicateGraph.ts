import "dotenv/config";

import neo4j from "neo4j-driver";
import { getAllLinksByFid, getFidCount } from "../src/lib/utils";
import { hubClient } from "../src/lib/hub";
import {
  HUB_URL,
  NEO4J_PASSWORD,
  NEO4J_URI,
  NEO4J_USER,
} from "../src/lib/const";

async function main() {
  const driver = neo4j.driver(
    NEO4J_URI,
    neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD)
  );
  const session = driver.session();
  const maxFid = await getFidCount();

  try {
    for (let fid = 310; fid <= maxFid; fid++) {
      const links = await getAllLinksByFid(fid, { hubUrl: HUB_URL });
      for (const link of links) {
        await session.run(
          "MERGE (a:User {id: $sourceId}) MERGE (b:User {id: $targetId}) MERGE (a)-[:FOLLOWS]->(b)",
          { sourceId: fid, targetId: link }
        );
      }
      console.log(
        `Processed ${links.length.toLocaleString()} links for ${fid} of ${maxFid}`
      );
    }
  } catch (error) {
    console.error("Error occurred:", error);
  } finally {
    await session.close();
    await driver.close();
  }
}

main();
