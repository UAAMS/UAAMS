/* eslint-disable no-console */
const { Client } = require("pg");
const path = require("path");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const initializeDatabase = async () => {
  const pgUser = process.env.PG_USER;
  const pgPassword = process.env.PG_PASSWORD;
  const pgHost = process.env.PG_HOST;
  const pgPort = Number(process.env.PG_PORT || 5432);
  const pgDatabase = process.env.PG_DATABASE;

  // Validate required environment variables
  if (!pgUser || !pgPassword || !pgHost || !pgDatabase) {
    console.error("✗ Missing required environment variables:");
    console.error("  PG_USER, PG_PASSWORD, PG_HOST, PG_DATABASE must be set");
    process.exit(1);
  }

  // Connect to default 'postgres' database to create the target database
  const adminClient = new Client({
    user: pgUser,
    password: pgPassword,
    host: pgHost,
    port: pgPort,
    database: "postgres", // Connect to default database
    ssl: {
      require: true, // ✅ This is the key fix for Neon!
      rejectUnauthorized: false, // ✅ Neon uses self-signed certificates
    },
  });

  try {
    console.log(`🔌 Connecting to PostgreSQL at ${pgHost}:${pgPort}...`);
    await adminClient.connect();
    console.log("✅ Connected to PostgreSQL");

    // Check if database exists
    const result = await adminClient.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [pgDatabase]
    );

    if (result.rows.length > 0) {
      console.log(`✅ Database '${pgDatabase}' already exists`);
    } else {
      console.log(`📦 Creating database '${pgDatabase}'...`);
      await adminClient.query(`CREATE DATABASE "${pgDatabase}"`);
      console.log(`✅ Database '${pgDatabase}' created successfully`);
    }

    await adminClient.end();
    console.log("\n✅ PostgreSQL database initialization complete!");
    console.log("You can now start your application.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error initializing database:", error.message);
    try {
      await adminClient.end();
    } catch (e) {
      // Ignore connection close errors
    }
    process.exit(1);
  }
};

initializeDatabase();
