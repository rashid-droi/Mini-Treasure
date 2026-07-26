"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { io as ClientIO, Socket } from "socket.io-client";

type SocketContextType = {
  socket: Socket | null;
  isConnected: boolean;
};

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
});

export const useSocket = () => useContext(SocketContext);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Connect to the same origin (custom server). Use the library's own
    // defaults for the path — they already resolve to "/socket.io/" on both
    // client and server. Overriding addTrailingSlash here previously made
    // the client request "/socket.io" (no slash), which the server never
    // matches, so every connection 404'd before the handshake could start.
    const socketInstance = ClientIO(window.location.origin);

    socketInstance.on("connect", () => {
      setIsConnected(true);
      console.log("Connected to Socket.io server", socketInstance.id);
    });

    socketInstance.on("disconnect", () => {
      setIsConnected(false);
      console.log("Disconnected from Socket.io server");
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
}
