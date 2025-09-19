// Multiple Data Channels utility for parallel file transfers
export class MultiChannelManager {
    constructor(peer, maxChannels = 3) {
        this.peer = peer
        this.maxChannels = maxChannels
        this.channels = []
        this.channelQueues = []
        this.isInitialized = false
    }

    async initialize() {
        if (this.isInitialized) return

        // SimplePeer doesn't support multiple data channels directly
        // We'll use the existing data channel and implement logical channels
        if (this.peer._channel || this.peer.channel) {
            const channel = this.peer._channel || this.peer.channel
            
            // Optimize channel for high throughput
            channel.bufferedAmountLowThreshold = 64_000

            // Create logical channels (just references to the same physical channel)
            for (let i = 0; i < this.maxChannels; i++) {
                this.channels.push(channel)
                this.channelQueues.push([])
            }

            this.isInitialized = true
        } else {
            throw new Error('No data channel available')
        }
    }

    setupChannelHandlers(channel, index) {
        // Only set up handlers once for the physical channel
        if (index === 0) {
            channel.onopen = () => {
                if (process.env.NODE_ENV === 'development') {
                    console.log('Data channel opened')
                }
            }

            channel.onclose = () => {
                if (process.env.NODE_ENV === 'development') {
                    console.log('Data channel closed')
                }
            }

            channel.onerror = (error) => {
                if (process.env.NODE_ENV === 'development') {
                    console.error('Data channel error:', error)
                }
            }

            channel.onbufferedamountlow = () => {
                // Process queued data when buffer is low for all logical channels
                for (let i = 0; i < this.maxChannels; i++) {
                    this.processChannelQueue(i)
                }
            }
        }
    }

    // Get the least busy channel (since all are the same physical channel, just return the first one)
    getOptimalChannel() {
        if (this.channels.length > 0 && this.channels[0].readyState === 'open') {
            return { channel: this.channels[0], index: 0 }
        }
        throw new Error('No open channels available')
    }

    // Send data through optimal channel
    async sendData(data) {
        const { channel, index } = this.getOptimalChannel()
        
        if (channel.readyState !== 'open') {
            throw new Error(`Channel ${index} is not open`)
        }

        // Check if channel buffer is full
        if (channel.bufferedAmount > 2_000_000) { // 2MB threshold
            // Queue the data for later sending
            this.channelQueues[index].push(data)
            return
        }

        try {
            channel.send(data)
        } catch (error) {
            // If send fails, queue the data
            this.channelQueues[index].push(data)
            throw error
        }
    }

    // Process queued data for a specific channel
    processChannelQueue(channelIndex) {
        const queue = this.channelQueues[channelIndex]
        const channel = this.channels[channelIndex]

        while (queue.length > 0 && channel.bufferedAmount < 1_000_000) { // 1MB threshold
            const data = queue.shift()
            try {
                channel.send(data)
            } catch (error) {
                // Put data back in queue if send fails
                queue.unshift(data)
                break
            }
        }
    }

    // Send data through all channels in parallel (sequentially since we only have one physical channel)
    async sendDataParallel(dataArray) {
        const channel = this.channels[0]
        
        if (!channel || channel.readyState !== 'open') {
            throw new Error('No open channel available')
        }

        // Send data sequentially since we only have one physical channel
        const results = []
        for (const data of dataArray) {
            try {
                channel.send(data)
                results.push({ status: 'fulfilled', value: undefined })
            } catch (error) {
                results.push({ status: 'rejected', reason: error })
            }
        }

        return results
    }

    // Wait for all channels to drain (just wait for the single physical channel)
    async waitForAllChannelsToDrain() {
        if (this.channels.length === 0) return

        const channel = this.channels[0]
        return new Promise((resolve) => {
            if (channel.bufferedAmount === 0) {
                resolve()
                return
            }

            const checkDrain = () => {
                if (channel.bufferedAmount === 0) {
                    resolve()
                } else {
                    setTimeout(checkDrain, 10)
                }
            }

            checkDrain()
        })
    }

    // Get total buffered amount across all channels (just return the single channel's buffered amount)
    getTotalBufferedAmount() {
        if (this.channels.length > 0) {
            return this.channels[0].bufferedAmount
        }
        return 0
    }

    // Close all channels (just clear references since we don't own the physical channel)
    closeAllChannels() {
        // Don't close the physical channel as it's managed by SimplePeer
        this.channels = []
        this.channelQueues = []
        this.isInitialized = false
    }

    // Get channel statistics
    getChannelStats() {
        if (this.channels.length > 0) {
            return [{
                index: 0,
                readyState: this.channels[0].readyState,
                bufferedAmount: this.channels[0].bufferedAmount,
                queuedItems: this.channelQueues[0].length
            }]
        }
        return []
    }
}

// Enhanced file transfer with multiple channels
export class ParallelFileTransfer {
    constructor(multiChannelManager, encryptionManager) {
        this.multiChannel = multiChannelManager
        this.encryption = encryptionManager
        this.chunkSize = 64 * 1024 // 64KB chunks
        this.maxConcurrentChunks = 6 // Increased for parallel channels
    }

    async transferFile(file, onProgress) {
        const fileId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
        const totalSize = file.size
        let transferred = 0

        // Send metadata first
        const metadata = {
            fileId,
            name: file.name,
            size: file.size,
            type: file.type,
            chunkSize: this.chunkSize,
            totalChunks: Math.ceil(file.size / this.chunkSize)
        }

        await this.multiChannel.sendData(JSON.stringify({ type: 'metadata', data: metadata }))

        // Read file in chunks
        const stream = file.stream()
        const reader = stream.getReader()
        const chunks = []

        // Read all chunks first
        while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const buffer = value instanceof Uint8Array ? value : new Uint8Array(value)
            
            // Split into smaller chunks
            for (let offset = 0; offset < buffer.byteLength; offset += this.chunkSize) {
                const chunk = buffer.subarray(offset, Math.min(offset + this.chunkSize, buffer.byteLength))
                chunks.push({
                    data: chunk,
                    index: chunks.length,
                    fileId
                })
            }
        }

        // Send chunks in parallel batches
        const batchSize = this.multiChannel.maxChannels
        for (let i = 0; i < chunks.length; i += batchSize) {
            const batch = chunks.slice(i, i + batchSize)
            
            // Prepare batch data
            const batchData = await Promise.all(batch.map(async (chunk) => {
                let data = chunk.data
                
                // Encrypt if needed
                if (this.encryption) {
                    data = await this.encryption.encryptFile(data, this.encryption.key)
                }

                return JSON.stringify({
                    type: 'chunk',
                    fileId: chunk.fileId,
                    index: chunk.index,
                    data: Array.from(data) // Convert to array for JSON
                })
            }))

            // Send batch in parallel
            await this.multiChannel.sendDataParallel(batchData)

            // Update progress
            transferred += batch.reduce((sum, chunk) => sum + chunk.data.byteLength, 0)
            if (onProgress) {
                onProgress((transferred / totalSize) * 100)
            }
        }

        // Send completion signal
        await this.multiChannel.sendData(JSON.stringify({
            type: 'complete',
            fileId
        }))

        // Wait for all channels to drain
        await this.multiChannel.waitForAllChannelsToDrain()

        return fileId
    }
}
