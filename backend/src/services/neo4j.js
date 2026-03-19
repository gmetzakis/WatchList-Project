import neo4j from "neo4j-driver";

let driverInstance = null;

export function isNeo4jConfigured() {
  return Boolean(process.env.NEO4J_URI && process.env.NEO4J_USERNAME && process.env.NEO4J_PASSWORD);
}

export function getNeo4jDriver() {
  if (!isNeo4jConfigured()) {
    return null;
  }

  if (!driverInstance) {
    driverInstance = neo4j.driver(
      process.env.NEO4J_URI,
      neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD),
      {
        disableLosslessIntegers: true,
      }
    );
  }

  return driverInstance;
}

export async function runNeo4jSession(accessMode, callback) {
  const driver = getNeo4jDriver();
  if (!driver) {
    const error = new Error("Neo4j is not configured");
    error.code = "NEO4J_NOT_CONFIGURED";
    throw error;
  }

  const session = driver.session({
    database: process.env.NEO4J_DATABASE || undefined,
    defaultAccessMode:
      accessMode === "write"
        ? neo4j.session.WRITE
        : neo4j.session.READ,
  });

  try {
    return await callback(session);
  } finally {
    await session.close();
  }
}

async function closeNeo4jDriver() {
  if (!driverInstance) {
    return;
  }

  const activeDriver = driverInstance;
  driverInstance = null;
  await activeDriver.close();
}

process.once("SIGINT", () => {
  closeNeo4jDriver().finally(() => process.exit(0));
});

process.once("SIGTERM", () => {
  closeNeo4jDriver().finally(() => process.exit(0));
});
