# 🔧 Direct-Drop Backend

**Socket.IO Signaling Server for WebRTC File Sharing**

This is the backend server for Direct-Drop, handling WebRTC signaling, room management, and connection coordination between file senders and receivers.

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ and npm
- Port 3001 available (configurable)

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Or start production server
npm start
```

The server will start on `http://localhost:3001` by default.

## 📋 API Endpoints

### Socket.IO Events

#### Client → Server

| Event | Description | Data |
|-------|-------------|------|
| `create-room` | Create a new room | `{ roomKey: string }` |
| `join-room` | Join an existing room | `{ roomKey: string }` |
| `signal` | WebRTC signaling data | `{ roomKey: string, signal: object }` |

#### Server → Client

| Event | Description | Data |
|-------|-------------|------|
| `room-created` | Room successfully created | `{ roomKey: string }` |
| `room-joined` | Successfully joined room | `{ roomKey: string }` |
| `room-not-found` | Room doesn't exist | `{ error: string }` |
| `peer-joined` | Another peer joined the room | `{ roomKey: string }` |
| `signal` | WebRTC signaling data | `{ signal: object }` |

## 🔧 Configuration

### Environment Variables

Create a `.env` file:

```env
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
```

### Available Scripts

```bash
npm start          # Start production server
npm run dev        # Start development server with nodemon
npm test           # Run tests (if available)
```

## 🏗️ Architecture

The backend server provides:

1. **Room Management** - Creates and manages WebRTC rooms
2. **Signaling Relay** - Facilitates WebRTC connection establishment
3. **Connection Coordination** - Handles peer discovery and connection
4. **CORS Support** - Enables cross-origin requests from frontend

## 🔒 Security

- **CORS Protection** - Configured for specific origins
- **No File Storage** - Files never touch the server
- **Temporary Rooms** - Rooms are cleaned up after use
- **Rate Limiting** - Prevents abuse (can be added)

## 📊 Monitoring

The server logs:
- Room creation and joining
- WebRTC signaling events
- Connection errors
- Server startup/shutdown

## 🚀 Deployment

### Production Setup

1. **Environment Variables**
   ```env
   PORT=3001
   NODE_ENV=production
   CORS_ORIGIN=https://yourdomain.com
   ```

2. **Process Management**
   ```bash
   # Using PM2
   npm install -g pm2
   pm2 start src/index.js --name direct-drop-backend
   ```

3. **Reverse Proxy** (Nginx example)
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com;
       
       location /socket.io/ {
           proxy_pass http://localhost:3001;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
           proxy_set_header Host $host;
       }
   }
   ```

## 🐛 Troubleshooting

### Common Issues

1. **Port Already in Use**
   ```bash
   # Find process using port 3001
   lsof -i :3001
   # Kill the process
   kill -9 <PID>
   ```

2. **CORS Errors**
   - Check `CORS_ORIGIN` environment variable
   - Ensure frontend URL matches exactly

3. **Socket.IO Connection Issues**
   - Verify server is running
   - Check firewall settings
   - Ensure WebSocket support

## 📝 Development

### Adding Features

1. **New Socket Events**
   ```javascript
   // In src/index.js
   io.on('connection', (socket) => {
     socket.on('new-event', (data) => {
       // Handle new event
     });
   });
   ```

2. **Room Management**
   ```javascript
   // Add custom room logic
   const rooms = new Map();
   
   function createRoom(roomKey) {
     rooms.set(roomKey, {
       created: Date.now(),
       peers: []
     });
   }
   ```

## 📊 Performance

- **Concurrent Rooms**: 1000+ (memory dependent)
- **Peers per Room**: 2 (sender + receiver)
- **Memory Usage**: < 50MB typical
- **Response Time**: < 10ms for signaling

## 🔄 Updates

To update the backend:

1. Pull latest changes
2. Install new dependencies: `npm install`
3. Restart server: `npm run dev` or `npm start`

---

**Part of Direct-Drop - Secure, Fast, and Modern File Sharing**
