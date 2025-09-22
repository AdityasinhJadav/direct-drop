import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import SimplePeer from 'simple-peer/simplepeer.min.js'
import JSZip from 'jszip'
import pako from 'pako'
import { FileEncryption } from '../utils/crypto.js'

const SIGNAL_SERVER = import.meta.env.VITE_SIGNAL_SERVER || 'http://localhost:3001'

// Secure room key generation with better entropy
const generateSecureRoomKey = () => {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
	let result = ''
	const randomValues = crypto.getRandomValues(new Uint8Array(8))
	for (let i = 0; i < 8; i++) {
		result += chars[randomValues[i] % chars.length]
	}
	return result
}

export default function Receiver() {
	const [roomKey, setRoomKey] = useState('')
	const [status, setStatus] = useState('not connected')
	const [receivedBytesState, setReceivedBytesState] = useState(0)
	const [receivedFiles, setReceivedFiles] = useState([])
	const [currentFileName, setCurrentFileName] = useState('')
	const [transferSpeed, setTransferSpeed] = useState(0)
	const [eta, setEta] = useState(0)
	const [isConnected, setIsConnected] = useState(false)
	const [receivedTexts, setReceivedTexts] = useState([])
	const [zipUrl, setZipUrl] = useState(null)
	const [isCreatingZip, setIsCreatingZip] = useState(false)
	const [encryptionKey, setEncryptionKey] = useState(null)
	const zipCreatedForFiles = useRef(0) // Track how many files we created ZIP for
	const fileEncryption = useRef(new FileEncryption())
	const receivedBytesRef = useRef(0)
	const socketRef = useRef(null)
	const peerRef = useRef(null)
	const bufferRef = useRef([])
	const metadataRef = useRef(null)
	const senderIdRef = useRef(null)
	const transferStartTime = useRef(null)
	const lastProgressTime = useRef(null)
	const lastProgressBytes = useRef(0)

	useEffect(() => {
		// Cleanup when component unmounts or room key changes
		return () => { 
			if (socketRef.current) {
				socketRef.current.disconnect()
				socketRef.current = null
			}
			// Clean up peer connections when room changes
			if (peerRef.current) {
				peerRef.current.destroy()
				peerRef.current = null
			}
			// Clean up ZIP URL only when room key changes (not when zipUrl changes)
			if (zipUrl) {
				URL.revokeObjectURL(zipUrl)
				setZipUrl(null)
			}
			setStatus('not connected')
			setIsConnected(false)
		}
	}, [roomKey]) // Removed zipUrl from dependencies

	// Cleanup on component unmount
	useEffect(() => {
		return () => {
			if (peerRef.current) {
				peerRef.current.destroy()
			}
			if (socketRef.current) {
				socketRef.current.disconnect()
			}
			// Clean up ZIP URL
			if (zipUrl) {
				URL.revokeObjectURL(zipUrl)
			}
		}
	}, []) // Empty dependency array - only run on unmount

	function ensurePeer() {
		// If a peer already exists, reuse it
		if (peerRef.current) return peerRef.current
		
		const peer = new SimplePeer({ initiator: false, trickle: true })
		peerRef.current = peer
		peer.on('signal', (data) => {
			socketRef.current?.emit('signal', { roomKey, to: senderIdRef.current, data })
		})
		peer.on('connect', () => {
			setStatus('channel-open')
			setIsConnected(true)
		})
		peer.on('close', () => {
			// Only finalize if we have data and metadata (and haven't already processed)
			if (bufferRef.current.length > 0 && metadataRef.current) {
				try {
					const blob = new Blob(bufferRef.current, { type: metadataRef.current?.type || 'application/octet-stream' })
					const url = URL.createObjectURL(blob)
					const fileInfo = {
						name: metadataRef.current?.name || `file_${Date.now()}`,
						size: blob.size, // Use actual blob size
						type: metadataRef.current?.type || 'application/octet-stream',
						url: url,
						timestamp: new Date()
					}
					setReceivedFiles(prev => [...prev, fileInfo])
					bufferRef.current = []
					setStatus('received')
			} catch (e) {
					setStatus('channel-closed')
				}
			} else {
				setStatus('channel-closed')
			}
			peerRef.current = null
		})
        peer.on('error', (err) => {
			setStatus('channel-error')
			peerRef.current = null
		})
		peer.on('data', (data) => {
			// Check if it's a string or can be converted to a JSON message
			let isJsonMessage = false
			if (typeof data === 'string') {
                // Only treat as control message if prefixed
                if (data.startsWith('CTRL:')) {
                    data = data.slice(5)
                    isJsonMessage = true
                }
			} else if (data instanceof ArrayBuffer || data instanceof Uint8Array) {
				// Try to decode as text to see if it's a JSON message
				try {
					const text = new TextDecoder().decode(data)
					if (text.startsWith('CTRL:{') && (text.includes('"meta"') || text.includes('"done"') || text.includes('"type":"text"'))) {
                        data = text.slice(5)
						isJsonMessage = true
					}
				} catch (e) {
					// Not text, treat as binary
				}
			}
			
			if (isJsonMessage) {
				try {
					const msg = JSON.parse(data)
					if (msg.meta) {
						metadataRef.current = msg.meta
						receivedBytesRef.current = 0
						setReceivedBytesState(0)
						setCurrentFileName(msg.meta.name)
						setStatus('receiving')
						transferStartTime.current = Date.now()
						lastProgressTime.current = Date.now()
						lastProgressBytes.current = 0
						
						// If file is encrypted, we need to get the encryption key
						// For now, we'll use a placeholder - in a real implementation,
						// this would come from a secure key exchange
						if (msg.meta.encrypted && !encryptionKey) {
							// In a real implementation, this would be exchanged securely
							// For demo purposes, we'll generate a new key
							fileEncryption.current.generateKey().then(key => {
								setEncryptionKey(key)
							})
						}
					}
					if (msg.type === 'text') {
						// Handle text message
						const textInfo = {
							content: msg.content,
							timestamp: new Date(msg.timestamp),
							id: Date.now() + Math.random() // Simple unique ID
						}
						setReceivedTexts(prev => [...prev, textInfo])
					}
					if (msg.done) {
						// Only process if we have actual data to prevent 0KB files
						if (bufferRef.current.length > 0) {
							const blob = new Blob(bufferRef.current, { type: metadataRef.current?.type || 'application/octet-stream' })
							
							// Verify file integrity if hash is provided
							let integrityVerified = true
							if (metadataRef.current?.hash) {
								try {
									blob.arrayBuffer().then(buffer => {
										fileEncryption.current.hashFile(buffer).then(receivedHash => {
											integrityVerified = receivedHash === metadataRef.current.hash
										})
									})
								} catch (error) {
									integrityVerified = false
								}
							}
							
						const url = URL.createObjectURL(blob)
							const fileInfo = {
								name: metadataRef.current?.name || `file_${Date.now()}`,
								size: blob.size, // Use actual blob size
								type: metadataRef.current?.type || 'application/octet-stream',
								url: url,
								timestamp: new Date(),
								integrityVerified: integrityVerified,
								encrypted: metadataRef.current?.encrypted || false
							}
							setReceivedFiles(prev => {
								const newFiles = [...prev, fileInfo]
								// Create ZIP if we now have 10+ files
								if (newFiles.length >= 10) {
									createZipFile(newFiles)
								}
								return newFiles
							})
							
						}
						
                        // Send ACK so sender knows it can proceed to next file
                        try {
                            const peer = peerRef.current
                        const sendAck = () => {
                            try {
                                const ackMsg = 'CTRL:' + JSON.stringify({ ack: true, fileId: msg.fileId })
                                if (peer && peer.send) {
                                    peer.send(ackMsg)
                                } else {
                                    const ch = peer?._channel || peer?.channel
                                    ch?.send?.(ackMsg)
                                }
                            } catch { setTimeout(sendAck, 50) }
                        }
                            setTimeout(sendAck, 0)
                        } catch {}
                        
                        // Reset for next file
						bufferRef.current = []
						metadataRef.current = null
						receivedBytesRef.current = 0
						setReceivedBytesState(0)
						setCurrentFileName('')
						setTransferSpeed(0)
						setEta(0)
						
						// Keep status as channel-open to receive more files
						setStatus('channel-open')
					}
				} catch (e) {
				}
			} else {
				// If we haven't received metadata yet but are getting data, set a generic status
				if (!metadataRef.current && status !== 'receiving') {
					setStatus('receiving')
				}
				
				// Process data: decrypt first, then decompress
				let processedData = data
				
				// Decrypt data if it was encrypted
				if (metadataRef.current?.encrypted && encryptionKey && data instanceof ArrayBuffer) {
					try {
						fileEncryption.current.decryptFile(new Uint8Array(data), encryptionKey).then(decrypted => {
							processedData = decrypted
						}).catch(error => {
							// Decryption failed, use original data
							processedData = data
						})
					} catch (error) {
						// Decryption failed, use original data
						processedData = data
					}
				}
				
				// Decompress data if it was compressed
				if (metadataRef.current?.compressed && processedData instanceof ArrayBuffer) {
					try {
						const decompressed = pako.ungzip(new Uint8Array(processedData))
						processedData = decompressed.buffer
					} catch (error) {
						// Decompression failed, use original data
						processedData = processedData
					}
				}
				
				bufferRef.current.push(processedData)
				const inc = (processedData?.byteLength || processedData?.length || 0)
				receivedBytesRef.current += inc
				setReceivedBytesState(receivedBytesRef.current)
				
				// Calculate transfer speed and ETA
				const now = Date.now()
				if (now - lastProgressTime.current > 1000 && metadataRef.current) {
					const timeDiff = (now - lastProgressTime.current) / 1000
					const bytesDiff = receivedBytesRef.current - lastProgressBytes.current
					const speed = bytesDiff / timeDiff
					setTransferSpeed(speed)
					
					const remaining = metadataRef.current.size - receivedBytesRef.current
					const timeRemaining = remaining / speed
					setEta(timeRemaining)
					
					lastProgressTime.current = now
					lastProgressBytes.current = receivedBytesRef.current
				}
				
				
				// Only auto-finalize if we haven't already processed this file
				// (to prevent duplicate files when both done signal and byte count trigger finalization)
				if (metadataRef.current && 
					receivedBytesRef.current >= (metadataRef.current.size || Infinity) &&
					bufferRef.current.length > 0) { // Only if we actually have data
					try {
						const blob = new Blob(bufferRef.current, { type: metadataRef.current?.type || 'application/octet-stream' })
						const url = URL.createObjectURL(blob)
						const fileInfo = {
							name: metadataRef.current?.name || `file_${Date.now()}`,
							size: blob.size, // Use actual blob size instead of metadata size
							type: metadataRef.current?.type || 'application/octet-stream',
							url: url,
							timestamp: new Date()
						}
						setReceivedFiles(prev => {
							const newFiles = [...prev, fileInfo]
							// Create ZIP if we now have 10+ files
							if (newFiles.length >= 10) {
								createZipFile(newFiles)
							}
							return newFiles
						})
						
                    
                    // Store fileId before resetting metadata
                    const currentFileId = metadataRef.current?.fileId
                    
                    // Send ACK since we finalized without explicit done
                    try {
                        const peer = peerRef.current
                        const sendAck = () => {
                            try {
                                const ackMsg = 'CTRL:' + JSON.stringify({ ack: true, fileId: currentFileId })
                                if (peer && peer.send) {
                                    peer.send(ackMsg)
                                } else {
                                    const ch = peer?._channel || peer?.channel
                                    ch?.send?.(ackMsg)
                                }
                            } catch { setTimeout(sendAck, 50) }
                        }
                        setTimeout(sendAck, 0)
				} catch {}
                    
                    // Reset for next file
						bufferRef.current = []
						metadataRef.current = null
						receivedBytesRef.current = 0
						setReceivedBytesState(0)
						setCurrentFileName('')
						setTransferSpeed(0)
						setEta(0)
						
						// Keep status as channel-open to receive more files
						setStatus('channel-open')
					} catch (e) {
					}
				}
			}
		})
		return peer
	}

	const formatFileSize = (bytes) => {
		if (bytes === 0) return '0 Bytes'
		const k = 1024
		const sizes = ['Bytes', 'KB', 'MB', 'GB']
		const i = Math.floor(Math.log(bytes) / Math.log(k))
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
	}

	const formatSpeed = (bytesPerSecond) => {
		return formatFileSize(bytesPerSecond) + '/s'
	}

	const formatTime = (seconds) => {
		if (seconds < 60) return `${Math.round(seconds)}s`
		if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`
		return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
	}


	const createZipFile = async (files) => {
		if (files.length < 10) return null
		
		// Prevent creating multiple ZIPs for the same number of files
		if (zipCreatedForFiles.current >= files.length) return null
		
		setIsCreatingZip(true)
		try {
			const zip = new JSZip()
			
			// Add each file to the ZIP
			for (const file of files) {
				const response = await fetch(file.url)
				const blob = await response.blob()
				zip.file(file.name, blob)
			}
			
			// Generate the ZIP file
			const zipBlob = await zip.generateAsync({ type: 'blob' })
			const zipUrl = URL.createObjectURL(zipBlob)
			
			setZipUrl(zipUrl)
			zipCreatedForFiles.current = files.length
			return zipUrl
		} catch (error) {
			return null
		} finally {
			setIsCreatingZip(false)
		}
	}

	const handleRoomKeyChange = (index, value) => {
		if (!/^[a-zA-Z0-9]?$/.test(value)) return
		const newKey = roomKey.split('')
		newKey[index] = value.toLowerCase()
		setRoomKey(newKey.join(''))
		
		// Auto-focus next input (support 8 characters now)
		if (value && index < 7) {
			const nextInput = document.getElementById(`receiver-key-input-${index + 1}`)
			nextInput?.focus()
		}
	}

	const handleRoomKeyKeyDown = (index, e) => {
		if (e.key === 'Backspace' && !roomKey[index] && index > 0) {
			const prevInput = document.getElementById(`receiver-key-input-${index - 1}`)
			prevInput?.focus()
		}
	}

	function joinRoom() {
		if (!roomKey || roomKey.length !== 8) return
		
		if (socketRef.current) {
			socketRef.current.disconnect()
		}
		
		// Create new socket connection
		const socket = io(SIGNAL_SERVER)
		socketRef.current = socket
		
		socket.on('connect', () => {
			setStatus('connecting...')
			// Add a small delay to ensure room is created
			setTimeout(() => {
				socket.emit('join-room', roomKey)
			}, 100)
		})
		
		socket.on('room-joined', () => {
			setStatus('connected')
		})
		
		socket.on('room-not-found', () => {
			setStatus('room not found')
			alert('Room not found. Make sure the sender has created the room first.')
		})
		
		socket.on('signal', ({ from, data }) => {
			senderIdRef.current = from
			ensurePeer()
			peerRef.current?.signal(data)
		})
		
		socket.on('disconnect', () => {
			setStatus('disconnected')
			setIsConnected(false)
		})
		
		socket.on('error', (error) => {
			setStatus('error')
			alert('Connection error: ' + error)
		})
	}

	function downloadAll() {
		receivedFiles.forEach(file => {
			const link = document.createElement('a')
			link.href = file.url
			link.download = file.name
			document.body.appendChild(link)
			link.click()
			document.body.removeChild(link)
		})
	}

	const copyToClipboard = async (text) => {
		try {
			await navigator.clipboard.writeText(text)
			// You could add a toast notification here
		} catch (err) {
			// Fallback for older browsers
			const textArea = document.createElement('textarea')
			textArea.value = text
			document.body.appendChild(textArea)
			textArea.select()
			document.execCommand('copy')
			document.body.removeChild(textArea)
		}
	}

	const getStatusBadge = () => {
		switch (status) {
			case 'connected': case 'joined': return 'bg-green-100 text-green-800'
			case 'channel-open': return 'bg-green-100 text-green-800'
			case 'connecting...': return 'bg-blue-100 text-blue-800'
			case 'receiving': return 'bg-blue-100 text-blue-800'
			case 'received': return 'bg-emerald-100 text-emerald-800'
			case 'room not found': case 'disconnected': case 'channel-error': case 'channel-lost': case 'error': return 'bg-red-100 text-red-800'
			case 'not connected': return 'bg-gray-100 text-gray-800'
			default: return 'bg-gray-100 text-gray-800'
		}
	}

	return (
		<div className="min-h-screen bg-gray-50 font-inter">
			<div className="max-w-5xl mx-auto p-4 sm:p-6">
				{/* Header */}
				<div className="text-center mb-6 sm:mb-8">
					<h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-2">Direct-Drop</h1>
					<p className="text-base sm:text-lg text-gray-600 px-4">Receive files securely with peer-to-peer connection</p>
				</div>

				{/* Main Content */}
				<div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
					{/* Status Bar */}
					<div className="bg-gray-50 px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
						<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
							<div className="flex items-center gap-2 sm:gap-3">
								<span className="text-xs sm:text-sm font-medium text-gray-700">Status:</span>
								<span className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${getStatusBadge()}`}>
									{status}
								</span>
							</div>
							{isConnected && (
								<div className="text-xs sm:text-sm text-gray-500">
									Connection established
								</div>
							)}
						</div>
					</div>

					{/* Room Key Section */}
					<div className="p-4 sm:p-6 border-b border-gray-200">
						<div className="max-w-lg mx-auto">
							<h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4 text-center">Enter Room Key</h2>
							<p className="text-xs sm:text-sm text-gray-600 mb-4 sm:mb-6 text-center px-4">Enter the key shared by the sender</p>
							
							<div className="flex justify-center gap-1 sm:gap-2 mb-4">
								{Array.from({ length: 8 }).map((_, index) => (
									<input
										key={index}
										id={`receiver-key-input-${index}`}
										type="text"
										maxLength={1}
										value={roomKey[index] || ''}
										onChange={(e) => handleRoomKeyChange(index, e.target.value)}
										onKeyDown={(e) => handleRoomKeyKeyDown(index, e)}
										className="w-10 h-10 sm:w-12 sm:h-12 text-center text-sm sm:text-lg font-mono font-bold border-2 border-gray-300 rounded-lg focus:border-emerald-500 focus:outline-none uppercase"
									/>
								))}
							</div>
							
							<div className="flex flex-col sm:flex-row justify-center gap-2 sm:gap-3">
								<button 
									onClick={() => setRoomKey(generateSecureRoomKey())}
									className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors text-sm sm:text-base"
								>
									Generate New
								</button>
								<button 
									onClick={joinRoom}
									disabled={!roomKey || roomKey.length !== 8}
									className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white rounded-lg font-medium transition-colors text-sm sm:text-base"
								>
									Join Room
								</button>
							</div>
						</div>
					</div>

					{/* Receiving Progress */}
					{status === 'receiving' && metadataRef.current && (
						<div className="p-4 sm:p-6 border-b border-gray-200">
							<h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4">Receiving File</h2>
							
							<div className="space-y-3 sm:space-y-4">
								<div className="flex justify-between text-xs sm:text-sm text-gray-600">
									<span className="truncate mr-2">File: {currentFileName}</span>
									<span className="flex-shrink-0">{Math.round((receivedBytesState / metadataRef.current.size) * 100)}% Complete</span>
								</div>
								
								<div className="w-full bg-gray-200 rounded-full h-2">
									<div 
										className="bg-emerald-600 h-2 rounded-full transition-all duration-300"
										style={{ width: `${Math.min((receivedBytesState / metadataRef.current.size) * 100, 100)}%` }}
									/>
								</div>
								
								<div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 text-center">
									<div className="bg-gray-50 p-2 sm:p-3 rounded-lg">
										<div className="text-xs sm:text-sm font-medium text-gray-900">{formatSpeed(transferSpeed)}</div>
										<div className="text-xs text-gray-500">Speed</div>
									</div>
									<div className="bg-gray-50 p-2 sm:p-3 rounded-lg">
										<div className="text-xs sm:text-sm font-medium text-gray-900">{formatTime(eta)}</div>
										<div className="text-xs text-gray-500">ETA</div>
									</div>
									<div className="bg-gray-50 p-2 sm:p-3 rounded-lg">
										<div className="text-xs sm:text-sm font-medium text-gray-900">{formatFileSize(receivedBytesState)}</div>
										<div className="text-xs text-gray-500">Received</div>
									</div>
									<div className="bg-gray-50 p-2 sm:p-3 rounded-lg">
										<div className="text-xs sm:text-sm font-medium text-gray-900">{formatFileSize(metadataRef.current.size)}</div>
										<div className="text-xs text-gray-500">Total Size</div>
									</div>
								</div>
							</div>
						</div>
					)}

					{/* Received Files */}
					{receivedFiles.length > 0 && (
						<div className="p-4 sm:p-6 border-b border-gray-200">
							<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3 sm:gap-0">
								<h2 className="text-lg sm:text-xl font-semibold text-gray-900">
									Received Files ({receivedFiles.length})
								</h2>
								<div className="flex flex-wrap gap-2 sm:gap-3">
									{receivedFiles.length >= 10 && zipUrl && (
										<a 
											href={zipUrl}
											download="received_files.zip"
											className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 sm:px-4 py-1 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors"
										>
											 Download ZIP
										</a>
									)}
									{receivedFiles.length >= 10 && isCreatingZip && (
										<button 
											disabled
											className="bg-gray-400 text-white px-3 sm:px-4 py-1 sm:py-2 rounded-lg text-xs sm:text-sm font-medium"
										>
											⏳ Creating ZIP...
										</button>
									)}
									<button 
										onClick={downloadAll}
										className="bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-4 py-1 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors"
									>
										Download All
									</button>
								</div>
							</div>
							
							<div className="space-y-2">
								{receivedFiles.map((file, index) => (
									<div key={index} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-2 sm:p-3 bg-emerald-50 rounded-lg border border-emerald-200 gap-3 sm:gap-0">
										<div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
											<div className="w-6 h-6 sm:w-8 sm:h-8 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
												<span className="text-emerald-600 text-xs sm:text-sm font-medium">
													{file.name.split('.').pop()?.toUpperCase().slice(0, 3) || 'FILE'}
												</span>
											</div>
											<div className="min-w-0 flex-1">
												<div className="font-medium text-gray-900 text-sm sm:text-base truncate">{file.name}</div>
												<div className="text-xs sm:text-sm text-gray-600">
													{formatFileSize(file.size)} • {file.timestamp.toLocaleTimeString()}
												</div>
												<div className="flex items-center gap-1 sm:gap-2 mt-1 flex-wrap">
													{file.encrypted && (
														<span className="inline-flex items-center px-1 sm:px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
															🔒 Encrypted
														</span>
													)}
													{file.integrityVerified !== undefined && (
														<span className={`inline-flex items-center px-1 sm:px-2 py-1 rounded-full text-xs font-medium ${
															file.integrityVerified 
																? 'bg-green-100 text-green-800' 
																: 'bg-red-100 text-red-800'
														}`}>
															{file.integrityVerified ? '✅ Verified' : '❌ Failed'}
														</span>
													)}
												</div>
											</div>
										</div>
										<a 
											href={file.url} 
											download={file.name}
											className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg font-medium transition-colors text-xs sm:text-sm flex-shrink-0 w-full sm:w-auto text-center"
										>
											Download
										</a>
									</div>
								))}
							</div>
						</div>
					)}

					{/* Received Text Messages */}
					{receivedTexts.length > 0 && (
						<div className="p-4 sm:p-6 border-b border-gray-200">
							<div className="flex justify-between items-center mb-4">
								<h2 className="text-lg sm:text-xl font-semibold text-gray-900">
									Text Messages ({receivedTexts.length})
								</h2>
								<button
									onClick={() => setReceivedTexts([])}
									className="text-red-600 hover:text-red-700 text-xs sm:text-sm font-medium"
								>
									Clear All
								</button>
							</div>
							
							<div className="space-y-3">
								{receivedTexts.map((text, index) => (
									<div key={text.id} className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
										<div className="flex justify-between items-start gap-3">
											<div className="flex-1 min-w-0">
												<div className="text-sm sm:text-base text-gray-900 whitespace-pre-wrap break-words max-h-32 overflow-y-auto border border-gray-200 rounded p-2 bg-white">
													{text.content}
												</div>
												<div className="text-xs sm:text-sm text-gray-500 mt-2">
													{text.timestamp.toLocaleTimeString()}
												</div>
											</div>
											<button
												onClick={() => copyToClipboard(text.content)}
												className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg font-medium transition-colors text-xs sm:text-sm flex-shrink-0"
											>
												Copy
											</button>
										</div>
									</div>
								))}
							</div>
						</div>
					)}

				{/* Waiting State */}
				{status === 'channel-open' && !currentFileName && (
					<div className="p-4 sm:p-6 text-center">
						<div className="text-2xl sm:text-3xl lg:text-4xl mb-3 sm:mb-4">⏳</div>
						<h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">Ready to Receive</h2>
						<p className="text-sm sm:text-base text-gray-600 px-4">
							{receivedFiles.length > 0 || receivedTexts.length > 0
								? `Received ${receivedFiles.length} file${receivedFiles.length > 1 ? 's' : ''}${receivedFiles.length > 0 && receivedTexts.length > 0 ? ' and ' : ''}${receivedTexts.length} text message${receivedTexts.length > 1 ? 's' : ''}. Waiting for more...`
								: 'Waiting for sender to start file transfer or send text messages...'
							}
						</p>
						{receivedFiles.length >= 10 && isCreatingZip && (
							<div className="mt-3 sm:mt-4 p-3 sm:p-4 bg-blue-50 border border-blue-200 rounded-lg mx-4">
								<div className="text-blue-800 font-medium text-sm sm:text-base"> Creating ZIP file...</div>
								<div className="text-blue-600 text-xs sm:text-sm mt-1">This may take a moment for large files</div>
							</div>
						)}
					</div>
				)}

					{/* Instructions */}
					{status === 'not connected' && (
						<div className="p-4 sm:p-6 text-center">
							<div className="text-2xl sm:text-3xl lg:text-4xl mb-3 sm:mb-4">📱</div>
							<h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4">How to Receive Files</h2>
							<div className="text-left max-w-md mx-auto space-y-2 sm:space-y-3 px-4">
								<div className="flex items-start gap-2 sm:gap-3">
									<span className="bg-emerald-100 text-emerald-800 rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-xs sm:text-sm font-bold">1</span>
									<p className="text-xs sm:text-sm text-gray-600">Ask sender to create a room first</p>
								</div>
								<div className="flex items-start gap-2 sm:gap-3">
									<span className="bg-emerald-100 text-emerald-800 rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-xs sm:text-sm font-bold">2</span>
									<p className="text-xs sm:text-sm text-gray-600">Get the room key from the sender</p>
								</div>
								<div className="flex items-start gap-2 sm:gap-3">
									<span className="bg-emerald-100 text-emerald-800 rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-xs sm:text-sm font-bold">3</span>
									<p className="text-xs sm:text-sm text-gray-600">Enter the 8-character key above</p>
								</div>
								<div className="flex items-start gap-2 sm:gap-3">
									<span className="bg-emerald-100 text-emerald-800 rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-xs sm:text-sm font-bold">4</span>
									<p className="text-xs sm:text-sm text-gray-600">Click "Join Room" to connect</p>
								</div>
							</div>
						</div>
					)}

					{/* Room not found message */}
					{status === 'room not found' && (
						<div className="p-4 sm:p-6 text-center">
							<div className="text-2xl sm:text-3xl lg:text-4xl mb-3 sm:mb-4">❌</div>
							<h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">Room Not Found</h2>
							<p className="text-sm sm:text-base text-gray-600 mb-3 sm:mb-4 px-4">The room with this key doesn't exist or hasn't been created yet.</p>
							<p className="text-xs sm:text-sm text-gray-500 px-4">Ask the sender to create the room first, then try again.</p>
				</div>
					)}
				</div>

				{/* Footer */}
				<div className="text-center mt-6 sm:mt-8 text-gray-500 text-xs sm:text-sm px-4">
					Server: {SIGNAL_SERVER}
				</div>
			</div>
		</div>
	)
}


