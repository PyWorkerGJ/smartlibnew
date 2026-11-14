let ioInstance = null;
export function initSocketIO(io) {
    ioInstance = io;
    io.on('connection', (socket) => {
        // console.log(`[Socket.IO] Client connected: ${socket.id}`);
        socket.on('disconnect', () => {
            // console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
        });
    });
}
export function emitRealtimeEvent(event, payload) {
    if (ioInstance) {
        ioInstance.emit(event, payload);
    }
}
