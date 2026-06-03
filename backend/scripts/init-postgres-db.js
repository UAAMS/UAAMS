/* eslint-disable no-console */
const { Client } = require("pg");
const path = require("path");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, "../.env") });
console.log(__dirname)

const initializeDatabase = async () => {
  const pgUser = process.env.PG_USER || "postgres";
  const pgPassword = process.env.PG_PASSWORD || "";
  const pgHost = process.env.PG_HOST || "127.0.0.1";
  const pgPort = Number(process.env.PG_PORT || 5432);
  const pgDatabase = process.env.PG_DATABASE || "uaams";
  const pgSsl = process.env.PG_SSL === "require" || process.env.PG_SSL === "true";

  console.log("pass:", pgPassword)
  console.log(`Connecting to ${pgHost}:${pgPort}/${pgDatabase}`);
  console.log(`SSL enabled: ${pgSsl}`);

  // SSL configuration
  const sslConfig = pgSsl ? {
    ssl: {
      require: true,
      rejectUnauthorized: false  // For Neon
    }
  } : {};

  // Connect directly to 'uaams' database (already exists)
  const client = new Client({
    user: pgUser,
    password: pgPassword,
    host: pgHost,
    port: pgPort,
    database: pgDatabase,  // Connect to uaams directly
    ...sslConfig
  });

  try {
    await client.connect();
    console.log("✓ Connected to PostgreSQL successfully!");
    
    // Test the connection
    const result = await client.query("SELECT NOW() as time, current_database() as db_name");
    console.log(`✓ Database: ${result.rows[0].db_name}`);
    console.log(`✓ Server time: ${result.rows[0].time}`);
    
    await client.end();
    console.log("\n✓ PostgreSQL connection test complete!");
    console.log("\n💡 Your Sequelize models will create tables via sync()");
    process.exit(0);
  } catch (error) {
    console.error("✗ Error connecting to database:", error.message);
    await client.end();
    process.exit(1);
  }
};

initializeDatabase();