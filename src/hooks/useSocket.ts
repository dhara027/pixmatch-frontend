import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketState {
  socket: Socket | null;
  connected: boolean;
}

export const useSocket = () => {
  const [state, setState] = useState<SocketState>({
    socket: null,
    connected: false,
  });

  useEffect(() => {
    const socketUrl = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || 'http://34.239.150.203:5000';
    
    const newSocket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    newSocket.on('connect', () => {
      setState((prev) => ({ ...prev, connected: true }));
    });

    newSocket.on('disconnect', () => {
      setState((prev) => ({ ...prev, connected: false }));
    });

    setState({ socket: newSocket, connected: newSocket.connected });

    return () => {
      newSocket.close();
    };
  }, []);

  return state;
};
