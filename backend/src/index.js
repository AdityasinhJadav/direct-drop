import dotenv from 'dotenv';
import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

dotenv.config();

const app = express();

// Security headers
app.use(helmet({
	contentSecurityPolicy: {
		directives: {
			defaultSrc: ["'self'"],
			connectSrc: ["'self'", "ws:", "wss:"],
			scriptSrc: ["'self'"],
			styleSrc: ["'self'", "'unsafe-inline'"],
			imgSrc: ["'self'", "data:", "https:"],
			fontSrc: ["'self'"],
			objectSrc: ["'none'"],
			mediaSrc: ["'self'"],
			frameSrc: ["'none'"]
		}
	},
	hsts: {
		maxAge: 31536000,
		includeSubDomains: true,
		preload: true
	}
}));

// Rate limiting
const limiter = rateLimit({
	windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000, // 15 minutes
	max: parseInt(process.env.RATE_LIMIT_MAX) || 100, // limit each IP to 100 requests per windowMs
	message: {
		error: 'Too many requests from this IP, please try again later.',
		retryAfter: '15 minutes'
	},
	standardHeaders: true,
	legacyHeaders: false
});

app.use(limiter);

// CORS configuration - SECURE
const allowedOrigins = process.env.FRONTEND_ORIGIN 
	? process.env.FRONTEND_ORIGIN.split(',').map(origin => origin.trim())
	: [
		'http://localhost:5173', 
		'http://localhost:3000',
		'https://direct-drop-frontend-27m63ajmu-adityas-projects-c8b8f770.vercel.app',
		'https://direct-drop-frontend-at569porz-adityas-projects-c8b8f770.vercel.app'
	];

app.use(cors({ 
	origin: (origin, callback) => {
		// Allow requests with no origin (mobile apps, curl, etc.)
		if (!origin) return callback(null, true);
		
		if (allowedOrigins.includes(origin)) {
			callback(null, true);
		} else {
			callback(new Error('Not allowed by CORS'));
		}
	},
	credentials: true,
	methods: ['GET', 'POST'],
	allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));

const server = http.createServer(app);
const io = new SocketIOServer(server, {
	cors: {
		origin: allowedOrigins,
		methods: ['GET', 'POST'],
		credentials: true
	}
});

// rooms: key -> Set of socket ids
const roomToSockets = new Map();

// Input validation functions
const validateRoomKey = (roomKey) => {
	return typeof roomKey === 'string' && 
		   /^[a-zA-Z0-9]{8}$/.test(roomKey) && 
		   roomKey.length === 8;
};

// Normalize room key to lowercase for consistent comparison
const normalizeRoomKey = (roomKey) => {
	return roomKey.toLowerCase();
};

const validateSignalData = (data) => {
	return data && typeof data === 'object' && 
		   Object.keys(data).length < 50; // Prevent large objects
};

// Rate limiting for socket events
const socketRateLimit = new Map();
const SOCKET_RATE_LIMIT = 10; // 10 events per minute
const SOCKET_RATE_WINDOW = 60 * 1000; // 1 minute

const checkSocketRateLimit = (socketId) => {
	const now = Date.now();
	const userLimits = socketRateLimit.get(socketId) || { count: 0, resetTime: now + SOCKET_RATE_WINDOW };
	
	if (now > userLimits.resetTime) {
		userLimits.count = 0;
		userLimits.resetTime = now + SOCKET_RATE_WINDOW;
	}
	
	if (userLimits.count >= SOCKET_RATE_LIMIT) {
		return false;
	}
	
	userLimits.count++;
	socketRateLimit.set(socketId, userLimits);
	return true;
};

io.on('connection', (socket) => {
	// Track connection for rate limiting
	socketRateLimit.set(socket.id, { count: 0, resetTime: Date.now() + SOCKET_RATE_WINDOW });
	
    // Create a room (sender only)
    socket.on('create-room', (roomKey) => {
		// Rate limiting check
		if (!checkSocketRateLimit(socket.id)) {
			socket.emit('error', 'Rate limit exceeded. Please try again later.');
			return;
		}
		
		// Input validation
		if (!validateRoomKey(roomKey)) {
			socket.emit('error', 'Invalid room key format. Must be exactly 8 alphanumeric characters.');
			return;
		}
		
		// Normalize room key for consistent storage
		const normalizedKey = normalizeRoomKey(roomKey);
		
		// Check if room already exists with 2+ users
		if (roomToSockets.has(normalizedKey) && roomToSockets.get(normalizedKey).size >= 2) {
			socket.emit('error', 'Room is full. Maximum 2 users per room.');
			return;
		}
		
		socket.join(normalizedKey);
		if (!roomToSockets.has(normalizedKey)) roomToSockets.set(normalizedKey, new Set());
		roomToSockets.get(normalizedKey).add(socket.id);
		socket.emit('room-created', { roomKey: normalizedKey });
	});

    // Join an existing room (receiver only)
    socket.on('join-room', (roomKey) => {
		// Rate limiting check
		if (!checkSocketRateLimit(socket.id)) {
			socket.emit('error', 'Rate limit exceeded. Please try again later.');
			return;
		}
		
		// Input validation
		if (!validateRoomKey(roomKey)) {
			socket.emit('error', 'Invalid room key format. Must be exactly 8 alphanumeric characters.');
			return;
		}
		
		// Normalize room key for consistent lookup
		const normalizedKey = normalizeRoomKey(roomKey);
		
		// Check if room exists
		if (!roomToSockets.has(normalizedKey)) {
			socket.emit('room-not-found');
			return;
		}
		
		// Check if room is full
		if (roomToSockets.get(normalizedKey).size >= 2) {
			socket.emit('error', 'Room is full. Maximum 2 users per room.');
			return;
		}
		
		socket.join(normalizedKey);
		roomToSockets.get(normalizedKey).add(socket.id);
		socket.emit('room-joined');
		
		// Notify sender that receiver joined
		socket.to(normalizedKey).emit('peer-joined', socket.id);
	});

	// Relay WebRTC signaling messages in a room
	socket.on('signal', ({ roomKey, to, data }) => {
		// Rate limiting check
		if (!checkSocketRateLimit(socket.id)) {
			socket.emit('error', 'Rate limit exceeded. Please try again later.');
			return;
		}
		
		// Input validation
		if (!validateRoomKey(roomKey) || !validateSignalData(data)) {
			socket.emit('error', 'Invalid signal data format.');
			return;
		}
		
		// Normalize room key for consistent lookup
		const normalizedKey = normalizeRoomKey(roomKey);
		
		// Verify user is in the room
		if (!roomToSockets.has(normalizedKey) || !roomToSockets.get(normalizedKey).has(socket.id)) {
			socket.emit('error', 'You are not authorized to send signals to this room.');
			return;
		}
		
		if (to) {
			// Verify target user exists in room
			if (roomToSockets.get(normalizedKey).has(to)) {
				io.to(to).emit('signal', { from: socket.id, data });
			}
		} else {
			socket.to(normalizedKey).emit('signal', { from: socket.id, data });
		}
	});

	socket.on('disconnect', () => {
		// Clean up rate limiting data
		socketRateLimit.delete(socket.id);
		
		// Clean up room data
		for (const [roomKey, sockets] of roomToSockets.entries()) {
			if (sockets.has(socket.id)) {
				sockets.delete(socket.id);
				socket.to(roomKey).emit('peer-left', socket.id);
				if (sockets.size === 0) {
					roomToSockets.delete(roomKey);
				}
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


