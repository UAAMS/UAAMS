const app = require("./app");
const env = require("./config/env");
const connectDb = require("./config/db");
const http = require("http");
const { Server } = require("socket.io");
const User = require("./models/User");
const { verifyAuthToken } = require("./utils/jwt");
const { USER_STATUS } = require("./constants/roles");
const { setSocketServer } = require("./utils/socket");
const { initializeStructuredStore } = require("./structured/store");
const { startStructuredSyncWorker } = require("./structured/worker");

const configuredOrigins = String(env.corsOrigin || "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);
const allowedOrigins = new Set(configuredOrigins);

const isLocalDevOrigin = (origin) =>
  env.nodeEnv !== "production" &&
  /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);

const PSQL_RETRY_INITIAL_DELAY_MS = 15 * 1000;
const PSQL_RETRY_MAX_DELAY_MS = 5 * 60 * 1000;
let psqlRetryTimer = null;
let psqlRetryAttempts = 0;

const schedulePsqlRetry = (delayMs) => {
  if (psqlRetryTimer) return;
  psqlRetryTimer = setTimeout(() => {
    psqlRetryTimer = null;
    void tryInitializePsqlStructuredStore().catch((error) => {
      // eslint-disable-next-line no-console
      console.error(
        "[server] PostgreSQL retry loop failed unexpectedly.",
        error?.message || error
      );
    });
  }, delayMs);
  psqlRetryTimer.unref?.();
};

const tryInitializePsqlStructuredStore = async () => {
  try {
    const structuredStore = await initializeStructuredStore();
    if (structuredStore.ready) {
      startStructuredSyncWorker();
      psqlRetryAttempts = 0;
      // eslint-disable-next-line no-console
      console.log(
        "[server] PostgreSQL structured sync initialized successfully."
      );
      return;
    }

    psqlRetryAttempts += 1;
    const nextDelay = Math.min(
      PSQL_RETRY_MAX_DELAY_MS,
      PSQL_RETRY_INITIAL_DELAY_MS * 2 ** (psqlRetryAttempts - 1)
    );
    // eslint-disable-next-line no-console
    console.warn(
      `[server] PostgreSQL structured sync initialized without ready state. Retrying in ${Math.round(
        nextDelay / 1000
      )}s.`
    );
    schedulePsqlRetry(nextDelay);
  } catch (error) {
    psqlRetryAttempts += 1;
    const nextDelay = Math.min(
      PSQL_RETRY_MAX_DELAY_MS,
      PSQL_RETRY_INITIAL_DELAY_MS * 2 ** (psqlRetryAttempts - 1)
    );
    // eslint-disable-next-line no-console
    console.warn(
      `[server] PostgreSQL structured sync could not be initialized. Retrying in ${Math.round(
        nextDelay / 1000
      )}s.`,
      error?.message || error
    );
    schedulePsqlRetry(nextDelay);
  }
};

const start = async () => {
  try {
    await connectDb();
    if (env.enablePsql) {
      await tryInitializePsqlStructuredStore();
    }
    const server = http.createServer(app);
    const io = new Server(server, {
      cors: {
        origin: (origin, callback) => {
          if (!origin || allowedOrigins.has(origin) || isLocalDevOrigin(origin)) {
            callback(null, true);
            return;
          }
          callback(new Error(`Socket CORS blocked for origin: ${origin}`));
        },
        credentials: true,
      },
    });

    io.use(async (socket, next) => {
      try {
        const authToken = String(socket.handshake.auth?.token || "").trim();
        const header = String(socket.handshake.headers?.authorization || "").trim();
        const headerToken = header.startsWith("Bearer ") ? header.slice(7) : "";
        const token = authToken || headerToken;

        if (!token) {
          return next(new Error("Unauthorized"));
        }

        const decoded = verifyAuthToken(token);
        const user = await User.findById(decoded.userId);

        if (!user || user.status !== USER_STATUS.ACTIVE) {
          return next(new Error("Unauthorized"));
        }

        socket.user = {
          id: String(user._id),
          role: user.role,
        };

        return next();
      } catch {
        return next(new Error("Unauthorized"));
      }
    });

    io.on("connection", (socket) => {
      const userId = socket.user?.id;
      const role = socket.user?.role;

      if (userId) {
        socket.join(`user:${userId}`);
      }

      if (role) {
        socket.join(`role:${role}`);
      }
    });

    setSocketServer(io);

    server.listen(env.port, () => {
      // eslint-disable-next-line no-console
      console.log(`[server] listening on port ${env.port}`);
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[server] failed to start", error);
    process.exit(1);
  }
};

start();
