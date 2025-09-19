import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import Sender from './pages/Sender.jsx'
import Receiver from './pages/Receiver.jsx'
import { registerServiceWorker } from './hooks/usePWA.js'

// Register service worker
registerServiceWorker()

const router = createBrowserRouter([
	{ path: '/', element: <App /> },
	{ path: '/send', element: <Sender /> },
	{ path: '/receive', element: <Receiver /> },
])

createRoot(document.getElementById('root')).render(
	<StrictMode>
		<RouterProvider router={router} />
	</StrictMode>,
)
