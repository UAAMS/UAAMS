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

  // Connect to default 'postgres' database to create the target database
  console.log("pass:",pgPassword)
  const adminClient = new Client({
    user: pgUser,
    password: pgPassword,
    host: pgHost,
    port: pgPort,
    database: "postgres", // Connect to default database
  });

  try {
    console.log(`Connecting to PostgreSQL at ${pgHost}:${pgPort}...`);
    await adminClient.connect();
    console.log("✓ Connected to PostgreSQL");

    // Check if database exists
    const result = await adminClient.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [pgDatabase]
    );

    if (result.rows.length > 0) {
      console.log(`✓ Database '${pgDatabase}' already exists`);
    } else {
      console.log(`Creating database '${pgDatabase}'...`);
      await adminClient.query(`CREATE DATABASE "${pgDatabase}"`);
      console.log(`✓ Database '${pgDatabase}' created successfully`);
    }

    await adminClient.end();
    console.log("\n✓ PostgreSQL database initialization complete!");
    console.log(`You can now start your application.`);
    process.exit(0);
  } catch (error) {
    console.error("✗ Error initializing database:", error.message);
    await adminClient.end();
    process.exit(1);
  }
};

initializeDatabase();
