import { Server as SocketIOServer } from 'socket.io';

let ioInstance: SocketIOServer | null = null;

export function initSocketIO(io: SocketIOServer) {
  ioInstance = io;
  io.on('connection', (socket) => {
    // console.log(`[Socket.IO] Client connected: ${socket.id}`);
    socket.on('disconnect', () => {
      // console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
  });
}

export function emitRealtimeEvent(event: string, payload: any) {
  if (ioInstance) {
    ioInstance.emit(event, payload);
  }
}
