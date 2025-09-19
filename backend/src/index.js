import dotenv from 'dotenv';
import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';

dotenv.config();

const app = express();
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || '*'}));
app.use(express.json());

const server = http.createServer(app);
const io = new SocketIOServer(server, {
	cors: {
		origin: process.env.FRONTEND_ORIGIN || '*',
		methods: ['GET', 'POST']
	}
});

// rooms: key -> Set of socket ids
const roomToSockets = new Map();

io.on('connection', (socket) => {
    // Create a room (sender only)
    socket.on('create-room', (roomKey) => {
		if (!roomKey) return;
		socket.join(roomKey);
		if (!roomToSockets.has(roomKey)) roomToSockets.set(roomKey, new Set());
		roomToSockets.get(roomKey).add(socket.id);
	});

    // Join an existing room (receiver only)
    socket.on('join-room', (roomKey) => {
		if (!roomKey) return;
		
		// Check if room exists
		if (!roomToSockets.has(roomKey)) {
			socket.emit('room-not-found');
			return;
		}
		
		socket.join(roomKey);
		roomToSockets.get(roomKey).add(socket.id);
		socket.emit('room-joined');
		
		// Notify sender that receiver joined
		socket.to(roomKey).emit('peer-joined', socket.id);
	});

	// Relay WebRTC signaling messages in a room
	socket.on('signal', ({ roomKey, to, data }) => {
		if (!roomKey || !data) return;
		if (to) {
			io.to(to).emit('signal', { from: socket.id, data });
		} else {
			socket.to(roomKey).emit('signal', { from: socket.id, data });
		}
	});

	socket.on('disconnect', () => {
		for (const [roomKey, sockets] of roomToSockets.entries()) {
			if (sockets.has(socket.id)) {
				sockets.delete(socket.id);
				socket.to(roomKey).emit('peer-left', socket.id);
				if (sockets.size === 0) roomToSockets.delete(roomKey);
			}
		}
	});
});

app.get('/health', (_req, res) => {
	res.json({ ok: true });
});

const PORT = Number(process.env.PORT || 3001);
server.listen(PORT, () => {
});


