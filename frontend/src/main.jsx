import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import Sender from './pages/Sender.jsx'
import Receiver from './pages/Receiver.jsx'
// Service worker registration removed to disable install/PWA prompts

const router = createBrowserRouter([
	{ path: '/', element: <App /> },
	{ path: '/send', element: <Sender /> },
	{ path: '/receive', element: <Receiver /> },
], {
	future: {
		v7_startTransition: true
	}
})

createRoot(document.getElementById('root')).render(
	<StrictMode>
		<RouterProvider router={router} />
	</StrictMode>,
)
