# 🎨 Direct-Drop Frontend

**Modern React Application for Peer-to-Peer File Sharing**

This is the frontend application for Direct-Drop, built with React, Vite, and Tailwind CSS. It provides a modern, responsive interface for secure file sharing using WebRTC technology.

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ and npm
- Modern web browser with WebRTC support

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

The application will start on `http://localhost:5173` by default.

## 🏗️ Project Structure

```
frontend/
├── public/
│   ├── manifest.json     # PWA manifest
│   ├── sw.js            # Service worker
│   └── vite.svg         # App icon
├── src/
│   ├── pages/
│   │   ├── Sender.jsx   # File sender interface
│   │   └── Receiver.jsx # File receiver interface
│   ├── utils/
│   │   ├── crypto.js    # Encryption utilities
│   │   └── multiChannel.js # Parallel transfer logic
│   ├── hooks/
│   │   └── usePWA.js    # PWA functionality
│   ├── App.jsx          # Main application
│   ├── App.css          # Global styles
│   ├── index.css        # Tailwind CSS imports
│   └── main.jsx         # Application entry point
├── package.json
├── vite.config.mjs      # Vite configuration
└── eslint.config.js     # ESLint configuration
```

## 🎯 Features

### Core Functionality
- **File Transfer** - Drag & drop, multiple files, folders
- **Text Messaging** - Send messages alongside files (10,000 char limit)
- **Room Management** - 6-character secure room keys
- **Real-time Progress** - Live transfer speed and ETA

### Security
- **End-to-End Encryption** - AES-256-GCM encryption
- **File Integrity** - SHA-256 verification
- **Secure Keys** - Cryptographically secure room keys

### User Experience
- **Responsive Design** - Works on all devices
- **Progressive Web App** - Install as native app
- **Modern UI** - Clean, intuitive interface
- **Accessibility** - Keyboard navigation and screen reader support

## 🔧 Configuration

### Environment Variables

Create a `.env` file:

```env
VITE_BACKEND_URL=http://localhost:3001
VITE_APP_NAME=Direct-Drop
VITE_APP_VERSION=1.0.0
```

### Vite Configuration

The `vite.config.mjs` includes:
- React plugin
- PWA plugin
- Development server configuration
- Build optimization

## 📱 Progressive Web App

### Features
- **Installable** - Add to home screen
- **Offline Support** - Service worker caching
- **App-like Experience** - Full-screen mode
- **Push Notifications** - (Future feature)

### Manifest Configuration
```json
{
  "name": "Direct-Drop",
  "short_name": "Direct-Drop",
  "description": "Secure P2P file sharing",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#3B82F6",
  "background_color": "#FFFFFF"
}
```

## 🎨 Styling

### Tailwind CSS
- **Utility-first** - Rapid UI development
- **Responsive** - Mobile-first design
- **Customizable** - Easy theme modification
- **Optimized** - Purged unused styles in production

### Design System
- **Colors**: Blue primary, gray neutrals
- **Typography**: Inter font family
- **Spacing**: Consistent 4px grid
- **Components**: Reusable UI patterns

## 🔒 Security Implementation

### Encryption
```javascript
// File encryption before transfer
const encryptedData = await fileEncryption.encryptFile(fileData, key);

// File decryption after receipt
const decryptedData = await fileEncryption.decryptFile(encryptedData, key);
```

### Key Management
```javascript
// Generate secure room keys
const roomKey = fileEncryption.generateSecureRoomKey();

// Derive encryption keys
const encryptionKey = await crypto.subtle.generateKey(
  { name: 'AES-GCM', length: 256 },
  true,
  ['encrypt', 'decrypt']
);
```

## 📊 Performance

### Optimization Features
- **Code Splitting** - Lazy-loaded components
- **Bundle Optimization** - Tree shaking and minification
- **Image Optimization** - WebP format support
- **Caching** - Service worker caching strategy

### Metrics
- **First Contentful Paint**: < 1.5s
- **Largest Contentful Paint**: < 2.5s
- **Cumulative Layout Shift**: < 0.1
- **Bundle Size**: < 500KB gzipped

## 🧪 Testing

### Available Scripts
```bash
npm run lint        # Run ESLint
npm run build       # Build for production
npm run preview     # Preview production build
```

### Testing Strategy
- **Unit Tests** - Component testing (to be added)
- **Integration Tests** - WebRTC functionality (to be added)
- **E2E Tests** - Full user flows (to be added)

## 🚀 Deployment

### Build Process
```bash
# Create production build
npm run build

# Output will be in dist/ directory
# Serve with any static file server
```

### Deployment Options

1. **Vercel** (Recommended)
   ```bash
   # Install Vercel CLI
   npm i -g vercel
   
   # Deploy
   vercel --prod
   ```

2. **Netlify**
   ```bash
   # Build command: npm run build
   # Publish directory: dist
   ```

3. **GitHub Pages**
   ```bash
   # Use GitHub Actions for automatic deployment
   ```

## 🔧 Development

### Adding New Features

1. **New Components**
   ```jsx
   // Create component in src/components/
   const NewComponent = () => {
     return <div>New Feature</div>;
   };
   ```

2. **New Pages**
   ```jsx
   // Add route in App.jsx
   <Route path="/new-page" element={<NewPage />} />
   ```

3. **New Utilities**
   ```javascript
   // Add utility functions in src/utils/
   export const newUtility = () => {
     // Implementation
   };
   ```

### Code Style
- **ESLint** - JavaScript linting
- **Prettier** - Code formatting (to be added)
- **Conventional Commits** - Commit message format

## 🐛 Troubleshooting

### Common Issues

1. **WebRTC Not Working**
   - Check browser compatibility
   - Ensure HTTPS in production
   - Verify firewall settings

2. **Build Errors**
   ```bash
   # Clear cache and reinstall
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **PWA Not Installing**
   - Check manifest.json
   - Verify service worker registration
   - Ensure HTTPS connection

## 📱 Browser Support

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| WebRTC | ✅ | ✅ | ✅ | ✅ |
| PWA | ✅ | ✅ | ✅ | ✅ |
| File API | ✅ | ✅ | ✅ | ✅ |
| Crypto API | ✅ | ✅ | ✅ | ✅ |

## 🔄 Updates

To update the frontend:

1. Pull latest changes
2. Install new dependencies: `npm install`
3. Clear cache: `rm -rf node_modules package-lock.json && npm install`
4. Restart dev server: `npm run dev`

---

**Part of Direct-Drop - Secure, Fast, and Modern File Sharing**