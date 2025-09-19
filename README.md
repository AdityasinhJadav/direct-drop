# 🚀 Direct-Drop

**Secure, Fast, and Modern Peer-to-Peer File Sharing**

Direct-Drop is a cutting-edge file sharing application that enables secure, direct file transfers between devices using WebRTC technology. No file size limits, no cloud storage required - just fast, encrypted, peer-to-peer transfers.

![Direct-Drop](https://img.shields.io/badge/Direct--Drop-v1.0.0-blue?style=for-the-badge&logo=react)
![React](https://img.shields.io/badge/React-18.2.0-61DAFB?style=for-the-badge&logo=react)
![WebRTC](https://img.shields.io/badge/WebRTC-P2P-FF6B6B?style=for-the-badge&logo=webrtc)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

## ✨ Features

### 🔒 **Security First**
- **End-to-End Encryption** - AES-256-GCM encryption by default
- **Secure Room Keys** - 6-character alphanumeric room codes
- **No Cloud Storage** - Files never touch external servers
- **Integrity Verification** - SHA-256 file integrity checking

### ⚡ **Lightning Fast**
- **WebRTC P2P** - Direct device-to-device connections
- **Adaptive Chunking** - Optimized for different file sizes
- **Parallel Channels** - Multiple data streams for maximum speed
- **Compression** - Automatic GZIP compression for supported files

### 📱 **Modern & Responsive**
- **Mobile-First Design** - Works perfectly on all devices
- **Progressive Web App** - Install as a native app
- **Dark/Light Mode** - Automatic theme detection
- **Real-time Progress** - Live transfer speed and ETA

### 🎯 **User-Friendly**
- **Drag & Drop** - Intuitive file selection
- **Text Messaging** - Send messages alongside files (10,000 char limit)
- **Multiple Files** - Transfer entire folders at once
- **ZIP Compression** - Automatic ZIP for 10+ files
- **One-Click Sharing** - Generate and share room keys instantly

## 🏗️ Architecture

```
Direct-Drop
├── Frontend (React + Vite)
│   ├── Modern UI with Tailwind CSS
│   ├── WebRTC file transfer logic
│   ├── End-to-end encryption
│   └── Progressive Web App features
└── Backend (Node.js + Express)
    ├── Socket.IO signaling server
    ├── Room management
    └── WebRTC connection coordination
```

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ and npm
- Modern web browser with WebRTC support

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/AdityasinhJadav/direct-drop.git
   cd direct-drop
   ```

2. **Install dependencies**
   ```bash
   # Install backend dependencies
   cd backend
   npm install
   
   # Install frontend dependencies
   cd ../frontend
   npm install
   ```

3. **Start the application**
   ```bash
   # Terminal 1: Start backend server
   cd backend
   npm start
   
   # Terminal 2: Start frontend development server
   cd frontend
   npm run dev
   ```

4. **Open your browser**
   - Navigate to `http://localhost:5173`
   - Start sharing files instantly!

## 📖 How to Use

### For Senders
1. **Create a Room** - Click "Create Room" to generate a unique room key
2. **Share the Key** - Send the 6-character room key to your recipient
3. **Select Files** - Drag & drop files or click to browse
4. **Send Messages** - Optionally add text messages (up to 10,000 characters)
5. **Start Transfer** - Click "Send Files" to begin the transfer

### For Receivers
1. **Enter Room Key** - Input the 6-character room key from the sender
2. **Join Room** - Click "Join Room" to connect
3. **Receive Files** - Files will download automatically as they arrive
4. **View Messages** - Read any text messages sent by the sender
5. **Download All** - Use "Download All" for multiple files or "Download ZIP" for 10+ files

## 🔧 Configuration

### Environment Variables
Create a `.env` file in the backend directory:

```env
PORT=3001
NODE_ENV=development
```

### Customization
- **Room Key Length**: Modify in `frontend/src/pages/Sender.jsx`
- **File Size Limits**: Adjust in WebRTC configuration
- **Encryption Settings**: Configure in `frontend/src/utils/crypto.js`

## 🛠️ Development

### Project Structure
```
direct-drop/
├── backend/
│   ├── src/
│   │   └── index.js          # Socket.IO server
│   ├── package.json
│   └── README.md
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Sender.jsx    # File sender interface
│   │   │   └── Receiver.jsx  # File receiver interface
│   │   ├── utils/
│   │   │   ├── crypto.js     # Encryption utilities
│   │   │   └── multiChannel.js # Parallel transfer logic
│   │   ├── hooks/
│   │   │   └── usePWA.js     # PWA functionality
│   │   └── App.jsx           # Main application
│   ├── public/
│   │   ├── manifest.json     # PWA manifest
│   │   └── sw.js            # Service worker
│   └── package.json
└── README.md
```

### Available Scripts

**Backend:**
```bash
npm start          # Start production server
npm run dev        # Start development server with nodemon
```

**Frontend:**
```bash
npm run dev        # Start development server
npm run build      # Build for production
npm run preview    # Preview production build
npm run lint       # Run ESLint
```

## 🔒 Security Features

### Encryption
- **AES-256-GCM** encryption for all file transfers
- **SHA-256** hashing for file integrity verification
- **Secure key generation** using Web Crypto API
- **No server-side file storage** - files never touch external servers

### Privacy
- **Peer-to-peer connections** - direct device communication
- **Temporary room keys** - expire after use
- **No user data collection** - completely anonymous
- **Local processing** - all encryption/decryption happens client-side

## 🌐 Browser Support

| Browser | Version | WebRTC | PWA |
|---------|---------|--------|-----|
| Chrome | 60+ | ✅ | ✅ |
| Firefox | 55+ | ✅ | ✅ |
| Safari | 11+ | ✅ | ✅ |
| Edge | 79+ | ✅ | ✅ |

## 📊 Performance

- **Transfer Speed**: Up to 20-25 Mbps (limited by network)
- **File Size**: No limits (browser memory dependent)
- **Concurrent Files**: Unlimited
- **Connection Time**: < 2 seconds
- **Memory Usage**: < 100MB for typical transfers

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow existing code style
- Add tests for new features
- Update documentation
- Ensure cross-browser compatibility

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **WebRTC** - For peer-to-peer communication
- **React** - For the modern UI framework
- **Socket.IO** - For signaling server
- **Tailwind CSS** - For responsive styling
- **Vite** - For fast development experience

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/AdityasinhJadav/direct-drop/issues)
- **Discussions**: [GitHub Discussions](https://github.com/AdityasinhJadav/direct-drop/discussions)
- **Email**: [Your Email]

## 🚀 Deployment

### Vercel (Recommended)
1. Connect your GitHub repository to Vercel
2. Set build command: `cd frontend && npm run build`
3. Set output directory: `frontend/dist`
4. Deploy!

### Netlify
1. Connect your GitHub repository to Netlify
2. Set build command: `cd frontend && npm run build`
3. Set publish directory: `frontend/dist`
4. Deploy!

### Self-Hosted
1. Build the frontend: `cd frontend && npm run build`
2. Serve the `frontend/dist` directory with your web server
3. Run the backend server on your infrastructure

---

**Made with ❤️ by [Your Name]**

*Direct-Drop - Secure, Fast, and Modern File Sharing*