import { io } from "socket.io-client";
import { API_BASE_URL, getStoredToken } from "./apiClient";

const SOCKET_EVENT_DATA_UPDATED = "uaams:data-updated";

let socketInstance = null;
let activeToken = "";

const resolveSocketBaseUrl = () => API_BASE_URL.replace(/\/api\/?$/, "");

const attachSocketDebugListeners = (socket) => {
  socket.on("connect", () => {
    // eslint-disable-next-line no-console
    console.debug("[socket] connected", socket.id);
  });

  socket.on("disconnect", (reason) => {
    // eslint-disable-next-line no-console
    console.debug("[socket] disconnected", reason);
  });

  socket.on("connect_error", (error) => {
    // eslint-disable-next-line no-console
    console.error("[socket] connect_error", error?.message || error);
  });
};

const ensureSocket = () => {
  const token = getStoredToken();
  if (!token) return null;

  if (socketInstance && activeToken === token) {
    if (!socketInstance.connected) {
      socketInstance.connect();
    }
    return socketInstance;
  }

  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }

  activeToken = token;
  socketInstance = io(resolveSocketBaseUrl(), {
    transports: ["websocket"],
    auth: {
      token,
    },
  });

  attachSocketDebugListeners(socketInstance);
  return socketInstance;
};

const connectRealtimeSocket = () => ensureSocket();

const disconnectRealtimeSocket = () => {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
  activeToken = "";
};

const refreshRealtimeSocket = () => {
  disconnectRealtimeSocket();
  return ensureSocket();
};

const onDataUpdated = (handler) => {
  const socket = ensureSocket();
  if (!socket) return () => {};

  socket.on(SOCKET_EVENT_DATA_UPDATED, handler);
  return () => socket.off(SOCKET_EVENT_DATA_UPDATED, handler);
};

export {
  SOCKET_EVENT_DATA_UPDATED,
  connectRealtimeSocket,
  disconnectRealtimeSocket,
  refreshRealtimeSocket,
  onDataUpdated,
};
