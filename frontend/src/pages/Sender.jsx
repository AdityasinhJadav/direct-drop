import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import SimplePeer from 'simple-peer/simplepeer.min.js'
import pako from 'pako'
import { FileEncryption, KeyExchange } from '../utils/crypto.js'
import { MultiChannelManager, ParallelFileTransfer } from '../utils/multiChannel.js'

const SIGNAL_SERVER = import.meta.env.VITE_SIGNAL_SERVER 

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

export default function Sender() {
	const [roomKey, setRoomKey] = useState(generateSecureRoomKey())
	const [status, setStatus] = useState('not connected')
	const [selectedFiles, setSelectedFiles] = useState([])
	const [currentFileIndex, setCurrentFileIndex] = useState(0)
	const [transferProgress, setTransferProgress] = useState(0)
	const [transferSpeed, setTransferSpeed] = useState(0)
	const [eta, setEta] = useState(0)
	const [currentSpeed, setCurrentSpeed] = useState(0)
    const [isConnected, setIsConnected] = useState(false)
    const [encryptionEnabled, setEncryptionEnabled] = useState(true)
    const [encryptionKey, setEncryptionKey] = useState(null)
    const [useMultipleChannels, setUseMultipleChannels] = useState(true)
    const [textMessage, setTextMessage] = useState('')
    const [sentFiles, setSentFiles] = useState([])
	const fileInputRef = useRef(null)
	const folderInputRef = useRef(null)
	const socketRef = useRef(null)
	const pcRef = useRef(null)
	const dcRef = useRef(null)
	const transferStartTime = useRef(null)
	const lastProgressTime = useRef(null)
	const lastProgressBytes = useRef(0)
	const fileEncryption = useRef(new FileEncryption())
	const keyExchange = useRef(new KeyExchange())
	const multiChannelManager = useRef(null)
	const parallelTransfer = useRef(null)

	// Helper to immediately drop any references to selected files
	const clearSelectedFiles = () => {
		setSelectedFiles([])
		try { if (fileInputRef.current) fileInputRef.current.value = '' } catch {}
		try { if (folderInputRef.current) folderInputRef.current.value = '' } catch {}
	}

    const recordFileSent = (file) => {
        setSentFiles(prev => [
            ...prev,
            {
                name: file.name,
                size: file.size,
                type: file.type,
                timestamp: new Date()
            }
        ])
    }

	// Text message sending function - defined early to be available in JSX
	const sendTextMessage = () => {
		if (!isConnected || !textMessage.trim()) return
		
		try {
			const message = {
				type: 'text',
				content: textMessage.trim(),
				timestamp: new Date().toISOString()
			}
			
			const messageString = 'CTRL:' + JSON.stringify(message)
			
			// Use safeSend like other control messages (will be defined later)
			if (typeof safeSend === 'function' && safeSend(messageString)) {
				setTextMessage('')
			} else {
				// Fallback to direct send if safeSend not available yet
				if (dcRef.current && dcRef.current.connected) {
					dcRef.current.send(messageString)
					setTextMessage('')
				}
			}
		} catch (error) {}
	}


	useEffect(() => {
		// Cleanup when component unmounts or room key changes
		return () => { 
			if (socketRef.current) {
				socketRef.current.disconnect()
				socketRef.current = null
			}
			// Clean up peer connections when room changes
			if (pcRef.current) {
				pcRef.current.destroy()
				pcRef.current = null
				dcRef.current = null
			}
			setStatus('not connected')
			setIsConnected(false)
			// Ensure selected files are dropped on connection change
			clearSelectedFiles()
		}
	}, [roomKey])

	// Cleanup on component unmount
	useEffect(() => {
		return () => {
			if (pcRef.current) {
				pcRef.current.destroy()
			}
			if (socketRef.current) {
				socketRef.current.disconnect()
			}
		}
	}, [])

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

	// File validation functions
	const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024 // 5GB
	const MAX_TOTAL_SIZE = 10 * 1024 * 1024 * 1024 // 10GB
	const ALLOWED_TYPES = [
		// Images
		'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
		// Videos
		'video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/flv', 'video/webm',
		// Audio
		'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/aac', 'audio/flac',
		// Documents
		'application/pdf', 'text/plain', 'text/csv', 'application/json',
		'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
		// Archives
		'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
		// Code files
		'text/javascript', 'text/css', 'text/html', 'application/xml',
		// Other
		'application/octet-stream' // Allow unknown types but validate size
	]

	const validateFile = (file) => {
		// Check file size
		if (file.size > MAX_FILE_SIZE) {
			return { valid: false, error: `File "${file.name}" is too large. Maximum size is ${formatFileSize(MAX_FILE_SIZE)}.` }
		}

		// Check file type (allow unknown types but warn)
		if (!ALLOWED_TYPES.includes(file.type) && file.type !== '') {
			return { valid: true, warning: `File "${file.name}" has an unknown type (${file.type}). Proceed with caution.` }
		}

		// Check for potentially dangerous file extensions
		const dangerousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.com', '.vbs', '.js', '.jar']
		const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'))
		if (dangerousExtensions.includes(fileExtension)) {
			return { valid: false, error: `File "${file.name}" has a potentially dangerous extension. For security reasons, executable files are not allowed.` }
		}

		return { valid: true }
	}

	const validateFiles = (files) => {
		const errors = []
		const warnings = []
		let totalSize = 0

		for (const file of files) {
			const validation = validateFile(file)
			if (!validation.valid) {
				errors.push(validation.error)
			} else if (validation.warning) {
				warnings.push(validation.warning)
			}
			totalSize += file.size
		}

		// Check total size
		if (totalSize > MAX_TOTAL_SIZE) {
			errors.push(`Total file size (${formatFileSize(totalSize)}) exceeds the maximum limit of ${formatFileSize(MAX_TOTAL_SIZE)}.`)
		}

		return { valid: errors.length === 0, errors, warnings, totalSize }
	}

	const handleRoomKeyChange = (index, value) => {
		if (!/^[a-zA-Z0-9]?$/.test(value)) return
		const newKey = roomKey.split('')
		newKey[index] = value.toLowerCase()
		setRoomKey(newKey.join(''))
		
		// Auto-focus next input (support 8 characters now)
		if (value && index < 7) {
			const nextInput = document.getElementById(`key-input-${index + 1}`)
			nextInput?.focus()
		}
	}

	const handleRoomKeyKeyDown = (index, e) => {
		if (e.key === 'Backspace' && !roomKey[index] && index > 0) {
			const prevInput = document.getElementById(`key-input-${index - 1}`)
			prevInput?.focus()
		}
	}

	const generateNewRoomKey = () => {
		setRoomKey(generateSecureRoomKey())
	}

	// Initialize encryption when component mounts
	useEffect(() => {
		const initEncryption = async () => {
			if (encryptionEnabled) {
				const key = await fileEncryption.current.generateKey()
				setEncryptionKey(key)
			}
		}
		initEncryption()
	}, [encryptionEnabled])

function createConnection() {
    if (socketRef.current) {
        socketRef.current.disconnect()
    }
    
    // Create new socket connection
    const socket = io(SIGNAL_SERVER)
    socketRef.current = socket
    
    socket.on('connect', () => {
        setStatus('connecting...')
        socket.emit('create-room', roomKey)
    })
    
    socket.on('room-created', () => {
        setStatus('room created')
    })
    
    socket.on('peer-joined', () => {
        setStatus('receiver joined')
    doCreatePeer()
    })
    
    socket.on('signal', ({ from, data }) => {
        pcRef.current?.signal?.(data)
    })
    
    socket.on('disconnect', () => {
        setStatus('disconnected')
        setIsConnected(false)
        // Drop any selected files when connection ends
        clearSelectedFiles()
    })
    
    socket.on('error', (error) => {
        setStatus('error')
        alert('Connection error: ' + error)
    })
}

function doCreatePeer() {
    // Clean up existing peer connection
    if (pcRef.current) {
        pcRef.current.destroy()
        pcRef.current = null
        dcRef.current = null
    }
    
    const peer = new SimplePeer({ 
        initiator: true, 
        trickle: true,
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ],
            // Optimize for data channel performance
            iceCandidatePoolSize: 10,
            bundlePolicy: 'max-bundle',
            rtcpMuxPolicy: 'require'
        }
    })
    pcRef.current = peer
    peer.on('signal', data => {
        socketRef.current?.emit('signal', { roomKey, data })
    })
    peer.on('connect', async () => {
        setStatus('channel-open')
        setIsConnected(true)
        dcRef.current = peer
        
        // Initialize multiple channels if enabled
        if (useMultipleChannels) {
            multiChannelManager.current = new MultiChannelManager(peer, 3)
            await multiChannelManager.current.initialize()
            parallelTransfer.current = new ParallelFileTransfer(
                multiChannelManager.current, 
                encryptionEnabled ? fileEncryption.current : null
            )
        } else {
            // Single channel optimization
            const ch = peer._channel || peer.channel
            if (ch && typeof ch.bufferedAmountLowThreshold === 'number') {
                ch.bufferedAmountLowThreshold = 64_000
            }
            if (ch) {
                if (ch.ordered !== undefined) ch.ordered = true
                if (ch.maxRetransmits !== undefined) ch.maxRetransmits = 0
                if (ch.maxPacketLifeTime !== undefined) ch.maxPacketLifeTime = 0
            }
        }
    })
    peer.on('close', () => { 
        setStatus('channel-closed')
        dcRef.current = null
        pcRef.current = null
        // Drop any selected files when channel closes
        clearSelectedFiles()
    })
    peer.on('error', (err) => { 
        setStatus('channel-error')
        dcRef.current = null
        pcRef.current = null
        // Drop any selected files on error as a safety measure
        clearSelectedFiles()
    })
}

	async function sendFiles() {
		if (!dcRef.current || !dcRef.current.connected) { 
			setStatus('channel-not-open')
			return 
		}
		if (selectedFiles.length === 0) return
		
		transferStartTime.current = Date.now()
		lastProgressTime.current = Date.now()
		lastProgressBytes.current = 0
		setCurrentFileIndex(0)
		
		for (let i = 0; i < selectedFiles.length; i++) {
			setCurrentFileIndex(i)
			const file = selectedFiles[i]
			
			// Use parallel transfer if enabled and available
        if (useMultipleChannels && parallelTransfer.current) {
            await sendFileParallel(file, i, selectedFiles.length)
        } else {
            await sendSingleFile(file, i, selectedFiles.length)
        }
        // Record successfully sent file
        recordFileSent(file)
			
			if (!dcRef.current || !dcRef.current.connected) {
				break
			}
			
			// Minimal delay between files to ensure receiver is ready
			if (i < selectedFiles.length - 1) {
				await new Promise(r => setTimeout(r, 100))
			}
		}
		
		if (dcRef.current) {
			setStatus('all-files-sent')
			// After successful sending of all files, immediately clear any references
			clearSelectedFiles()
		}
	}


	async function sendFileParallel(file, fileIndex, totalFiles) {
		if (!parallelTransfer.current) {
			// Fallback to single file transfer
			await sendSingleFile(file, fileIndex, totalFiles)
			return
		}

        try {
            await parallelTransfer.current.transferFile(file, (progress) => {
				setTransferProgress(progress)
				setStatus(`sending file ${fileIndex + 1}/${totalFiles}: ${file.name} (${Math.round(progress)}%)`)
			})
		} catch (error) {
			// Fallback to single file transfer on error
			await sendSingleFile(file, fileIndex, totalFiles)
		}
	}

	async function sendSingleFile(file, fileIndex, totalFiles) {
    if (!dcRef.current || !dcRef.current.connected) { 
			setStatus('channel-not-open')
			return 
		}
    // Adaptive chunk size based on file size for optimal performance
    const getOptimalChunkSize = (fileSize) => {
        if (fileSize < 1024 * 1024) return 32 * 1024 // 32KB for small files (<1MB)
        if (fileSize < 10 * 1024 * 1024) return 64 * 1024 // 64KB for medium files (<10MB)
        if (fileSize < 100 * 1024 * 1024) return 128 * 1024 // 128KB for large files (<100MB)
        return 256 * 1024 // 256KB for very large files (>=100MB)
    }
    const chunkSize = getOptimalChunkSize(file.size)
    const stream = file.stream()
    const reader = stream.getReader()
    let sent = 0
    
    // Generate fileId first
    const fileId = `${Date.now()}-${fileIndex}-${Math.random().toString(36).slice(2, 10)}`
    
    // Set up ACK waiter early so we don't miss auto-finalization ACKs
    const ackWaiter = new Promise((resolve) => {
        const peer = dcRef.current
        if (!peer) return resolve()
        const detach = () => {
            if (peer.off) peer.off('data', onData)
            else if (peer.removeListener) peer.removeListener('data', onData)
        }
        const onData = (msg) => {
            try {
                if (typeof msg === 'string' && msg.startsWith('CTRL:')) {
                    const payload = JSON.parse(msg.slice(5))
                    if (payload && payload.ack === true && payload.fileId === fileId) { 
                        detach(); 
                        resolve() 
                    }
                } else if (msg instanceof ArrayBuffer || msg instanceof Uint8Array) {
                    try {
                        const text = new TextDecoder().decode(msg)
                        if (text.startsWith('CTRL:')) {
                            const payload = JSON.parse(text.slice(5))
                            if (payload && payload.ack === true && payload.fileId === fileId) { 
                                detach(); 
                                resolve() 
                            }
                        }
                    } catch {}
                }
            } catch {}
        }
        if (peer.on) peer.on('data', onData)
        setTimeout(() => { detach(); resolve() }, 3000)
    })
    
    
    // Helper function to safely send data
    const safeSend = (data) => {
        if (!dcRef.current || !dcRef.current.connected) {
            setStatus('channel-lost')
            return false
        }
        try {
            dcRef.current.send(data)
            return true
        } catch (error) {
            setStatus('channel-error')
            return false
        }
    }

    // Backpressure: wait for drain when buffer is high
    const waitForDrain = () => new Promise((resolve) => {
        const peer = dcRef.current
        if (!peer) return resolve()
        const ch = peer._channel || peer.channel
        // Prefer native RTCDataChannel bufferedamountlow
        if (ch && 'onbufferedamountlow' in ch) {
            // Set a lower threshold for faster drain detection
            ch.bufferedAmountLowThreshold = 64_000 // 64KB threshold
            const handler = () => {
                ch.onbufferedamountlow = null
                resolve()
            }
            ch.onbufferedamountlow = handler
            return
        }
        // Fallback to simple-peer 'drain'
        const onceDrain = () => {
            peer?.off?.('drain', onceDrain)
            resolve()
        }
        peer?.once?.('drain', onceDrain)
    })

    const getBufferedAmount = () => {
        const ch = dcRef.current?._channel || dcRef.current?.channel
        return ch ? ch.bufferedAmount : 0
    }

    const MAX_BUFFERED = 2_000_000 // 2MB threshold (larger buffer)


    // Check if file should be compressed (text-based files)
    const shouldCompress = (fileName, fileType) => {
        const textExtensions = ['.txt', '.json', '.xml', '.html', '.css', '.js', '.md', '.csv', '.log']
        const textTypes = ['text/', 'application/json', 'application/xml']
        const extension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'))
        return textExtensions.includes(extension) || textTypes.some(type => fileType.startsWith(type))
    }
    
    const isCompressed = shouldCompress(file.name, file.type)
    
    // Generate file hash for integrity verification
    const fileHash = await fileEncryption.current.hashFile(await file.arrayBuffer())
    
    // Send file metadata - ensure it's sent first (prefixed as control frame)
    const metadata = { 
        meta: { 
            fileId, 
            name: file.name, 
            size: file.size, 
            type: file.type, 
            compressed: isCompressed,
            encrypted: encryptionEnabled,
            hash: fileHash
        } 
    }
    if (!safeSend('CTRL:' + JSON.stringify(metadata))) {
        return
    }
    
    // Minimal delay to ensure metadata is processed before data chunks
    await new Promise(r => setTimeout(r, 5))
    
    // Parallel chunk processing for better throughput
    const chunkQueue = []
    const maxConcurrentChunks = 3 // Send up to 3 chunks in parallel
    
    while (true) {
        const { done, value } = await reader.read()
        if (done) break
        
        // Slice the stream-provided chunk into smaller RTC-sized chunks
        const buffer = value instanceof Uint8Array ? value : new Uint8Array(value)
        for (let offset = 0; offset < buffer.byteLength; offset += chunkSize) {
            const slice = buffer.subarray(offset, Math.min(offset + chunkSize, buffer.byteLength))
            chunkQueue.push(slice)
            
            // Process chunks in parallel when queue is full or at end
            if (chunkQueue.length >= maxConcurrentChunks || offset + chunkSize >= buffer.byteLength) {
                // Send all chunks in queue (with compression and encryption if applicable)
                const sendPromises = chunkQueue.map(chunk => {
                    return new Promise(async (resolve) => {
                        let dataToSend = chunk
                        let originalSize = chunk.byteLength
                        
                        // Compress text-based files
                        if (isCompressed) {
                            try {
                                const compressed = pako.gzip(chunk)
                                // Only use compression if it actually reduces size
                                if (compressed.length < chunk.length * 0.9) {
                                    dataToSend = compressed
                                }
                            } catch (error) {
                                // Compression failed, use original data
                            }
                        }
                        
                        // Encrypt data if encryption is enabled
                        if (encryptionEnabled && encryptionKey) {
                            try {
                                dataToSend = await fileEncryption.current.encryptFile(dataToSend, encryptionKey)
                            } catch (error) {
                                // Encryption failed, use original data
                            }
                        }
                        
                        if (safeSend(dataToSend)) {
                            sent += originalSize // Count original size for progress
                            resolve()
                        } else {
                            try { reader.cancel() } catch {}
                            resolve()
                        }
                    })
                })
                
                await Promise.all(sendPromises)
                chunkQueue.length = 0 // Clear queue
                
                // Backpressure: wait for drain when buffer is high
                if (getBufferedAmount() > MAX_BUFFERED) {
                    await waitForDrain()
                }
                
                // Calculate transfer speed and ETA
                const now = Date.now()
                if (now - lastProgressTime.current > 500) {
                    const timeDiff = (now - lastProgressTime.current) / 1000
                    const bytesDiff = sent - lastProgressBytes.current
                    const speed = bytesDiff / timeDiff
                    setTransferSpeed(speed)
                    setCurrentSpeed(speed)
                    
                    const remaining = file.size - sent
                    const timeRemaining = remaining / speed
                    setEta(timeRemaining)
                    
                    lastProgressTime.current = now
                    lastProgressBytes.current = sent
                }
                
                const fileProgress = (sent / file.size) * 100
                setTransferProgress(fileProgress)
                setStatus(`sending file ${fileIndex + 1}/${totalFiles}: ${file.name} (${Math.round(fileProgress)}%)`)
            }
        }
    }
    
    // Check if ACK has already been received (receiver auto-finalized)
    try {
        // Use Promise.race to either get the ACK or timeout quickly
        await Promise.race([
            ackWaiter,
            new Promise(resolve => setTimeout(resolve, 50)) // 50ms timeout (faster)
        ])
        return
    } catch {
        // ACK not received yet, proceed with completion signal
    }
    
    // Send completion signal
    // Ensure buffer drained before sending completion
    if (getBufferedAmount() > 0) {
        await waitForDrain()
    }
    
    const success = safeSend('CTRL:' + JSON.stringify({ done: true, fileId }))
    if (!success) {
        return
    }
    
    // Wait until receiver confirms file persisted
    await ackWaiter

    // If we reach here, consider file sent successfully
    recordFileSent(file)
	}

	function onChooseFiles(e) {
		const files = Array.from(e.target.files || [])
		const validation = validateFiles(files)
		
		if (!validation.valid) {
			alert('File validation failed:\n' + validation.errors.join('\n'))
			return
		}
		
		if (validation.warnings.length > 0) {
			const proceed = confirm('File validation warnings:\n' + validation.warnings.join('\n') + '\n\nDo you want to proceed?')
			if (!proceed) return
		}
		
		setSelectedFiles(files)
	}

	function onChooseFolder(e) {
		const files = Array.from(e.target.files || [])
		const validation = validateFiles(files)
		
		if (!validation.valid) {
			alert('File validation failed:\n' + validation.errors.join('\n'))
			return
		}
		
		if (validation.warnings.length > 0) {
			const proceed = confirm('File validation warnings:\n' + validation.warnings.join('\n') + '\n\nDo you want to proceed?')
			if (!proceed) return
		}
		
		setSelectedFiles(files)
	}

	function onDrop(e) {
		e.preventDefault()
		const files = Array.from(e.dataTransfer.files || [])
		const validation = validateFiles(files)
		
		if (!validation.valid) {
			alert('File validation failed:\n' + validation.errors.join('\n'))
			return
		}
		
		if (validation.warnings.length > 0) {
			const proceed = confirm('File validation warnings:\n' + validation.warnings.join('\n') + '\n\nDo you want to proceed?')
			if (!proceed) return
		}
		
		setSelectedFiles(files)
	}

	function removeFile(index) {
		setSelectedFiles(prev => prev.filter((_, i) => i !== index))
	}

	function clearAllFiles() {
		setSelectedFiles([])
		if (fileInputRef.current) fileInputRef.current.value = ''
		if (folderInputRef.current) folderInputRef.current.value = ''
	}

	function onDragOver(e) { e.preventDefault() }

	const getStatusColor = () => {
		switch (status) {
			case 'room created': return 'text-green-700'
			case 'receiver joined': return 'text-green-700'
			case 'channel-open': return 'text-green-700'
			case 'disconnected': case 'channel-error': case 'channel-lost': case 'error': return 'text-red-600'
			case 'not connected': return 'text-gray-600'
			default: return 'text-gray-600'
		}
	}

	const getStatusBadge = () => {
		switch (status) {
			case 'connecting...': return 'bg-blue-100 text-blue-800'
			case 'room created': return 'bg-blue-100 text-blue-800'
			case 'receiver joined': return 'bg-green-100 text-green-800'
			case 'channel-open': return 'bg-green-100 text-green-800'
			case 'disconnected': case 'channel-error': case 'channel-lost': case 'error': return 'bg-red-100 text-red-800'
			case 'not connected': return 'bg-gray-100 text-gray-800'
			default: return 'bg-gray-100 text-gray-800'
		}
	}

	const totalFileSize = selectedFiles.reduce((sum, file) => sum + file.size, 0)

	return (
		<div className="min-h-screen bg-gray-50 font-inter">
			<div className="max-w-5xl mx-auto p-4 sm:p-6">
				{/* Header */}
				<div className="text-center mb-6 sm:mb-8">
					<h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-2">Direct-Drop</h1>
					<p className="text-base sm:text-lg text-gray-600 px-4">Send files securely with peer-to-peer connection</p>
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
							<h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4 text-center">Share Room Key</h2>
							<p className="text-xs sm:text-sm text-gray-600 mb-4 sm:mb-6 text-center px-4">Share this key with the receiver to establish connection</p>
							
							
							<div className="flex justify-center gap-1 sm:gap-2 mb-4">
								{Array.from({ length: 8 }).map((_, index) => (
									<input
										key={index}
										id={`key-input-${index}`}
										type="text"
										maxLength={1}
										value={roomKey[index] || ''}
										onChange={(e) => handleRoomKeyChange(index, e.target.value)}
										onKeyDown={(e) => handleRoomKeyKeyDown(index, e)}
										className="w-10 h-10 sm:w-12 sm:h-12 text-center text-sm sm:text-lg font-mono font-bold border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none uppercase"
									/>
								))}
							</div>
							
							<div className="flex flex-col sm:flex-row justify-center gap-2 sm:gap-3">
								<button 
									onClick={generateNewRoomKey}
									className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors text-sm sm:text-base"
								>
									Generate New
								</button>
								<button 
									onClick={createConnection}
									disabled={!roomKey || roomKey.length !== 8}
									className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg font-medium transition-colors text-sm sm:text-base"
								>
									Create Connection
								</button>
							</div>
						</div>
					</div>

					{/* File Selection */}
					<div className="p-4 sm:p-6 border-b border-gray-200">
						<h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4 sm:mb-6">Select Files</h2>
						
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
							<button 
								className="p-4 sm:p-6 border-2 border-dashed border-gray-300 hover:border-blue-400 rounded-lg transition-colors text-center"
								onClick={() => fileInputRef.current?.click()}
							>
								<div className="font-medium text-gray-700 mb-1 text-sm sm:text-base">Choose Files</div>
								<div className="text-xs sm:text-sm text-gray-500">Select multiple files</div>
							</button>
							
							<button 
								className="p-4 sm:p-6 border-2 border-dashed border-gray-300 hover:border-blue-400 rounded-lg transition-colors text-center"
								onClick={() => folderInputRef.current?.click()}
							>
								<div className="font-medium text-gray-700 mb-1 text-sm sm:text-base">Choose Folder</div>
								<div className="text-xs sm:text-sm text-gray-500">Select entire folder</div>
							</button>
						</div>

						<div 
							onDrop={onDrop} 
							onDragOver={onDragOver} 
							className="border-2 border-dashed border-gray-300 hover:border-blue-400 rounded-lg p-4 sm:p-6 lg:p-8 text-center transition-colors"
						>
							<div className="text-base sm:text-lg font-medium text-gray-700 mb-1 sm:mb-2">Drop files here</div>
							<div className="text-sm text-gray-500">Or use the buttons above</div>
						</div>

						<input 
							ref={fileInputRef} 
							type="file" 
							multiple 
							onChange={onChooseFiles} 
							className="hidden" 
						/>
						<input 
							ref={folderInputRef} 
							type="file" 
							webkitdirectory="" 
							onChange={onChooseFolder} 
							className="hidden" 
						/>
					</div>

					{/* Selected Files */}
					{selectedFiles.length > 0 && (
						<div className="p-4 sm:p-6 border-b border-gray-200">
							<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3 sm:gap-0">
								<h2 className="text-lg sm:text-xl font-semibold text-gray-900">
									Selected Files ({selectedFiles.length})
								</h2>
								<div className="flex gap-2 sm:gap-3">
									<span className="bg-blue-50 text-blue-700 px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm font-medium">
										{formatFileSize(totalFileSize)}
									</span>
									<button 
										onClick={clearAllFiles}
										className="text-red-600 hover:text-red-700 text-xs sm:text-sm font-medium"
									>
										Clear All
									</button>
								</div>
							</div>
							
							<div className="max-h-48 sm:max-h-64 overflow-y-auto space-y-2 mb-4">
								{selectedFiles.map((file, index) => (
									<div key={index} className="flex items-center justify-between p-2 sm:p-3 bg-gray-50 rounded-lg">
										<div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
											<div className="w-6 h-6 sm:w-8 sm:h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
												<span className="text-blue-600 text-xs sm:text-sm font-medium">
													{file.name.split('.').pop()?.toUpperCase().slice(0, 3) || 'FILE'}
												</span>
											</div>
											<div className="min-w-0 flex-1">
												<div className="font-medium text-gray-900 text-sm sm:text-base truncate">{file.name}</div>
												<div className="text-xs sm:text-sm text-gray-500">{formatFileSize(file.size)}</div>
											</div>
										</div>
										<button 
											onClick={() => removeFile(index)}
											className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0 ml-2"
										>
											<svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
											</svg>
										</button>
									</div>
								))}
							</div>

							<button 
								className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium py-2 sm:py-3 rounded-lg transition-colors text-sm sm:text-base"
								onClick={sendFiles}
								disabled={!isConnected || selectedFiles.length === 0}
							>
								Send Files
							</button>
                </div>
            )}

					{/* Text Message Section */}
					{isConnected && (
						<div className="p-4 sm:p-6 border-b border-gray-200">
							<h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4">Send Text Message</h2>
							<div className="space-y-3">
								<textarea
									value={textMessage}
									onChange={(e) => setTextMessage(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === 'Enter' && !e.shiftKey) {
											e.preventDefault()
											sendTextMessage()
										}
									}}
									placeholder="Type your message here... (Press Enter to send, Shift+Enter for new line)"
									className="w-full p-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none resize-none text-sm sm:text-base"
									rows={3}
									maxLength={10000}
								/>
								<div className="flex justify-between items-center">
									<span className="text-xs sm:text-sm text-gray-500">
										{textMessage.length}/10000 characters
									</span>
									<button
										onClick={sendTextMessage}
										disabled={!textMessage.trim()}
										className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm sm:text-base"
									>
										Send Text
									</button>
								</div>
							</div>
						</div>
					)}

            {/* Sent Files History */}
            {sentFiles.length > 0 && (
                <div className="p-4 sm:p-6">
                    <div className="flex items-center justify-between mb-3 sm:mb-4">
                        <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Sent Files ({sentFiles.length})</h2>
                        <button
                            onClick={() => setSentFiles([])}
                            className="text-red-600 hover:text-red-700 text-xs sm:text-sm font-medium"
                        >
                            Clear List
                        </button>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                        {sentFiles.map((file, index) => (
                            <div key={index} className="flex items-center justify-between p-2 sm:p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                                    <div className="w-6 h-6 sm:w-8 sm:h-8 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                        <span className="text-emerald-600 text-xs sm:text-sm font-medium">
                                            {file.name.split('.').pop()?.toUpperCase().slice(0, 3) || 'FILE'}
                                        </span>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="font-medium text-gray-900 text-sm sm:text-base truncate">{file.name}</div>
                                        <div className="text-xs sm:text-sm text-gray-600">
                                            {formatFileSize(file.size)} • {new Date(file.timestamp).toLocaleTimeString()}
                                        </div>
                                    </div>
                                </div>
                                <span className="text-emerald-700 text-xs sm:text-sm font-medium flex-shrink-0">Sent</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

					{/* Transfer Progress */}
					{status.includes('sending') && (
						<div className="p-4 sm:p-6">
							<h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4">Transfer Progress</h2>
							
							<div className="space-y-3 sm:space-y-4">
								<div className="flex justify-between text-xs sm:text-sm text-gray-600">
									<span>File {currentFileIndex + 1} of {selectedFiles.length}</span>
									<span>{Math.round(transferProgress)}% Complete</span>
								</div>
								
								<div className="w-full bg-gray-200 rounded-full h-2">
									<div 
										className="bg-blue-600 h-2 rounded-full transition-all duration-300"
										style={{ width: `${transferProgress}%` }}
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
										<div className="text-xs sm:text-sm font-medium text-gray-900 truncate">{selectedFiles[currentFileIndex]?.name || 'N/A'}</div>
										<div className="text-xs text-gray-500">Current File</div>
									</div>
									<div className="bg-gray-50 p-2 sm:p-3 rounded-lg">
										<div className="text-xs sm:text-sm font-medium text-gray-900">{formatFileSize(selectedFiles[currentFileIndex]?.size || 0)}</div>
										<div className="text-xs text-gray-500">File Size</div>
									</div>
								</div>
							</div>
						</div>
					)}
				</div>

				{/* Footer */}
				<div className="text-center mt-8 text-gray-500 text-sm">
					Server: {SIGNAL_SERVER}
				</div>
			</div>
		</div>
	)
}


