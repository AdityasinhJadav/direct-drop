# 🚀 Direct-Drop Deployment Guide

## Quick Deploy with Vercel (Recommended)

### 1. Deploy Backend First

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy backend
cd backend
vercel

# Note the backend URL (e.g., https://direct-drop-backend.vercel.app)
```

### 2. Update Frontend Configuration

1. Copy the backend URL from step 1
2. Update `frontend/src/pages/Sender.jsx` and `frontend/src/pages/Receiver.jsx`:
   - Replace `https://your-backend-url.vercel.app` with your actual backend URL

### 3. Deploy Frontend

```bash
# Deploy frontend
cd frontend
vercel
```

## Alternative: Netlify + Railway

### Frontend (Netlify)
1. Go to [netlify.com](https://netlify.com)
2. Connect GitHub repository
3. Set build settings:
   - Build command: `npm run build`
   - Publish directory: `frontend/dist`
   - Base directory: `frontend`

### Backend (Railway)
1. Go to [railway.app](https://railway.app)
2. Connect GitHub repository
3. Select `backend` folder
4. Railway auto-detects Node.js

## Environment Variables

### Backend (.env)
```env
NODE_ENV=production
PORT=3001
FRONTEND_ORIGIN=https://your-frontend-url.netlify.app
```

### Frontend (.env)
```env
VITE_SIGNAL_SERVER=https://your-backend-url.railway.app
```

## Post-Deployment Checklist

- [ ] Backend deployed and accessible
- [ ] Frontend deployed and accessible
- [ ] Environment variables configured
- [ ] CORS settings updated
- [ ] HTTPS enabled (required for WebRTC)
- [ ] Test file transfer between devices

## Troubleshooting

### WebRTC Issues
- Ensure both frontend and backend use HTTPS
- Check CORS configuration
- Verify STUN/TURN servers if needed

### Connection Issues
- Check environment variables
- Verify backend URL in frontend
- Check browser console for errors

## Custom Domain (Optional)

1. Buy domain from Namecheap, GoDaddy, etc.
2. Configure DNS:
   - Frontend: CNAME to your hosting provider
   - Backend: CNAME to your backend provider
3. Update environment variables with custom domain
