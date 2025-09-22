import { Link } from 'react-router-dom'
// PWA install removed
import './App.css'

function App() {
  

  return (
		<div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-emerald-50">
			{/* Navigation */}
			<nav className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="flex justify-between items-center h-16">
						<div className="flex items-center">
							<div className="flex-shrink-0">
								<h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-emerald-600 bg-clip-text text-transparent">
									Direct-Drop
								</h1>
							</div>
						</div>
						<div className="flex items-center space-x-4">
							<Link 
								to="/send" 
								className="text-gray-600 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
							>
								Send Files
							</Link>
							<Link 
								to="/receive" 
								className="text-gray-600 hover:text-emerald-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
							>
								Receive Files
							</Link>
              
						</div>
					</div>
				</div>
			</nav>

			{/* Hero Section */}
			<div className="relative overflow-hidden">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
					<div className="text-center">
						<h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-4 sm:mb-6">
							Share Files
							<span className="block bg-gradient-to-r from-blue-600 to-emerald-600 bg-clip-text text-transparent">
								Instantly & Securely
							</span>
						</h1>
						<p className="text-base sm:text-lg lg:text-xl text-gray-600 mb-6 sm:mb-8 max-w-3xl mx-auto leading-relaxed px-4">
							Transfer files directly between devices using peer-to-peer technology. 
							No cloud storage, no file size limits, just fast and secure file sharing.
						</p>
						<div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center px-4">
							<Link 
								to="/send" 
								className="group inline-flex items-center gap-2 sm:gap-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-semibold text-base sm:text-lg hover:from-blue-700 hover:to-blue-800 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl w-full sm:w-auto justify-center"
							>
								<svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
								</svg>
								Send Files
							</Link>
							<Link 
								to="/receive" 
								className="group inline-flex items-center gap-2 sm:gap-3 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-semibold text-base sm:text-lg hover:from-emerald-700 hover:to-emerald-800 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl w-full sm:w-auto justify-center"
							>
								<svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
								</svg>
								Receive Files
							</Link>
						</div>
					</div>
				</div>
			</div>

			{/* Features Section */}
			<div className="py-12 sm:py-16 lg:py-20 bg-white/50">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="text-center mb-12 sm:mb-16">
						<h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
							Why Choose Direct-Drop?
						</h2>
						<p className="text-base sm:text-lg lg:text-xl text-gray-600 max-w-2xl mx-auto px-4">
							Experience the future of file sharing with our cutting-edge technology
						</p>
					</div>
					
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
						{/* Feature 1 */}
						<div className="text-center p-6 sm:p-8 bg-white rounded-2xl shadow-lg hover:shadow-xl transition-shadow duration-300">
							<div className="w-12 h-12 sm:w-16 sm:h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
								<svg className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
								</svg>
							</div>
							<h3 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-3 sm:mb-4">Lightning Fast</h3>
							<p className="text-sm sm:text-base text-gray-600 leading-relaxed">
								Advanced parallel processing and compression technology ensures your files transfer at maximum speed.
							</p>
						</div>

						{/* Feature 2 */}
						<div className="text-center p-6 sm:p-8 bg-white rounded-2xl shadow-lg hover:shadow-xl transition-shadow duration-300">
							<div className="w-12 h-12 sm:w-16 sm:h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
								<svg className="w-6 h-6 sm:w-8 sm:h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
								</svg>
							</div>
							<h3 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-3 sm:mb-4">Secure & Private</h3>
							<p className="text-sm sm:text-base text-gray-600 leading-relaxed">
								Direct peer-to-peer connection means your files never touch our servers. Your privacy is guaranteed.
							</p>
						</div>

						{/* Feature 3 */}
						<div className="text-center p-6 sm:p-8 bg-white rounded-2xl shadow-lg hover:shadow-xl transition-shadow duration-300">
							<div className="w-12 h-12 sm:w-16 sm:h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
								<svg className="w-6 h-6 sm:w-8 sm:h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM21 5a2 2 0 00-2-2h-4a2 2 0 00-2 2v12a4 4 0 004 4h4a2 2 0 002-2V5z" />
								</svg>
							</div>
							<h3 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-3 sm:mb-4">No Limits</h3>
							<p className="text-sm sm:text-base text-gray-600 leading-relaxed">
								Send files of any size without restrictions. Automatic ZIP compression for multiple files.
							</p>
						</div>
					</div>
				</div>
			</div>

			{/* How It Works Section */}
			<div className="py-12 sm:py-16 lg:py-20">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="text-center mb-12 sm:mb-16">
						<h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
							How It Works
						</h2>
						<p className="text-base sm:text-lg lg:text-xl text-gray-600 max-w-2xl mx-auto px-4">
							Simple, secure, and fast file sharing in just a few steps
						</p>
					</div>
					
					<div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start">
						{/* Sender Steps */}
						<div className="space-y-4 sm:space-y-6">
							<h3 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-4 sm:mb-6 flex items-center gap-2 sm:gap-3">
								<svg className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
								</svg>
								Send Files
							</h3>
							<div className="space-y-3 sm:space-y-4">
								<div className="flex items-start gap-3 sm:gap-4">
									<div className="w-7 h-7 sm:w-8 sm:h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold text-xs sm:text-sm">1</div>
									<div>
										<h4 className="font-semibold text-gray-900 text-sm sm:text-base">Create Room</h4>
										<p className="text-gray-600 text-xs sm:text-sm">Generate a unique 6-character room key</p>
									</div>
								</div>
								<div className="flex items-start gap-3 sm:gap-4">
									<div className="w-7 h-7 sm:w-8 sm:h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold text-xs sm:text-sm">2</div>
									<div>
										<h4 className="font-semibold text-gray-900 text-sm sm:text-base">Select Files</h4>
										<p className="text-gray-600 text-xs sm:text-sm">Choose files or folders to share</p>
									</div>
								</div>
								<div className="flex items-start gap-3 sm:gap-4">
									<div className="w-7 h-7 sm:w-8 sm:h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold text-xs sm:text-sm">3</div>
									<div>
										<h4 className="font-semibold text-gray-900 text-sm sm:text-base">Share Key</h4>
										<p className="text-gray-600 text-xs sm:text-sm">Give the room key to the receiver</p>
									</div>
								</div>
							</div>
						</div>

						{/* Receiver Steps */}
						<div className="space-y-4 sm:space-y-6">
							<h3 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-4 sm:mb-6 flex items-center gap-2 sm:gap-3">
								<svg className="w-6 h-6 sm:w-8 sm:h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
								</svg>
								Receive Files
							</h3>
							<div className="space-y-3 sm:space-y-4">
								<div className="flex items-start gap-3 sm:gap-4">
									<div className="w-7 h-7 sm:w-8 sm:h-8 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center font-semibold text-xs sm:text-sm">1</div>
									<div>
										<h4 className="font-semibold text-gray-900 text-sm sm:text-base">Enter Room Key</h4>
										<p className="text-gray-600 text-xs sm:text-sm">Input the 6-character key from sender</p>
									</div>
								</div>
								<div className="flex items-start gap-3 sm:gap-4">
									<div className="w-7 h-7 sm:w-8 sm:h-8 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center font-semibold text-xs sm:text-sm">2</div>
									<div>
										<h4 className="font-semibold text-gray-900 text-sm sm:text-base">Connect</h4>
										<p className="text-gray-600 text-xs sm:text-sm">Join the room and establish connection</p>
									</div>
								</div>
								<div className="flex items-start gap-3 sm:gap-4">
									<div className="w-7 h-7 sm:w-8 sm:h-8 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center font-semibold text-xs sm:text-sm">3</div>
									<div>
										<h4 className="font-semibold text-gray-900 text-sm sm:text-base">Download</h4>
										<p className="text-gray-600 text-xs sm:text-sm">Files are automatically downloaded</p>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>

			
		
			
		</div>
  )
}

export default App
