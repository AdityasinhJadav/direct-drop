#!/bin/bash

echo "🚀 Deploying Direct-Drop to the Internet..."

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Installing..."
    npm install -g vercel
fi

echo "📦 Deploying Backend..."
cd backend
vercel --prod

echo "📦 Deploying Frontend..."
cd ../frontend
vercel --prod

echo "✅ Deployment Complete!"
echo "🔗 Check your Vercel dashboard for URLs"
echo "📝 Don't forget to update the backend URL in your frontend code!"
