// DirectDrop - Full Frontend Logic
// This script manages file selection, signaling, WebRTC connection, and file transfer.
// Author: AI

// --- DOM ELEMENT REFERENCES ---
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const transferInfo = document.getElementById('transfer-info');
const fileNameElem = document.getElementById('file-name');
const fileSizeElem = document.getElementById('file-size');
const shareLinkContainer = document.getElementById('share-link-container');
const shareLinkInput = document.getElementById('share-link');
const copyLinkBtn = document.getElementById('copy-link');
const qrCodeElem = document.getElementById('qr-code');
const progressSection = document.getElementById('progress-section');
const statusMessage = document.getElementById('status-message');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const downloadButton = document.getElementById('download-button');
const fileListElem = document.getElementById('file-list');
const fileListTable = document.getElementById('file-list-table');
const totalSizeElem = document.getElementById('total-size');
const overallProgressContainer = document.getElementById('overall-progress-container');
const overallProgressBar = document.getElementById('overall-progress-bar');
const overallProgressText = document.getElementById('overall-progress-text');
const toastElem = document.getElementById('toast');
const themeToggle = document.getElementById('theme-toggle');
const sendFilesRadio = document.getElementById('send-files');
const sendFolderRadio = document.getElementById('send-folder');
const folderInput = document.getElementById('folder-input');
const dropZoneText = document.getElementById('drop-zone-text');
const selectedLabel = document.getElementById('selected-label');
const receiverProgressContainer = document.getElementById('receiver-progress-container');
const receiverProgressBar = document.getElementById('receiver-progress-bar');
const receiverProgressText = document.getElementById('receiver-progress-text');
const senderShareSection = document.getElementById('sender-share-section');
const senderProgressContainer = document.getElementById('sender-progress-container');
const senderProgressBar = document.getElementById('sender-progress-bar');
const senderProgressText = document.getElementById('sender-progress-text');

let sendType = 'files'; // 'files' or 'folder'

if (sendFilesRadio && sendFolderRadio) {
  sendFilesRadio.addEventListener('change', () => {
    if (sendFilesRadio.checked) {
      sendType = 'files';
      fileInput.classList.remove('hidden');
      folderInput.classList.add('hidden');
      dropZoneText.textContent = 'Drag & drop files here or click to select';
    }
  });
  sendFolderRadio.addEventListener('change', () => {
    if (sendFolderRadio.checked) {
      sendType = 'folder';
      fileInput.classList.add('hidden');
      folderInput.classList.remove('hidden');
      dropZoneText.textContent = 'Drag & drop a folder here or click to select';
    }
  });
}

// --- GLOBALS ---
let socket;
let roomId;
let isSender = false;
let file;
let peerConnection;
let dataChannel;
let fileReader;
let fileMeta;
let receivedBuffers = [];
let receivedSize = 0;
let fileUrl;
let files = [];
let sendingIndex = 0;
let sendingFile = null;
let sendingOffset = 0;
let sendingMeta = null;
let sendingDataChannel = null;
let receivedFiles = [];
let receivingMeta = null;
let receivingBuffers = [];
let receivingSize = 0;
let receivingFiles = [];

let fileTableRows = [];
let fileProgress = [];
let fileStatus = [];
let fileDownloadLinks = [];
let totalBytes = 0;
let transferredBytes = 0;
let darkMode = true;

// --- SOCKET.IO CONNECTION ---
// Load Socket.IO from CDN if not present
(function loadSocketIo() {
  if (!window.io) {
    const script = document.createElement('script');
    script.src = 'https://cdn.socket.io/4.7.5/socket.io.min.js';
    script.onload = init;
    document.head.appendChild(script);
  } else {
    init();
  }
})();

// --- QR CODE LIBRARY LOADER ---
(function loadQrCodeLib() {
  if (!window.QRCode) {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js';
    document.head.appendChild(script);
  }
})();

// --- MAIN INITIALIZATION ---
function init() {
  // Connect to signaling server
  socket = io('http://localhost:3000');
  console.log('Socket.IO connected');

  // Register peer-joined handler right away
  socket.on('peer-joined', () => {
    console.log('Peer joined, creating offer...');
    setupWebRtcSender();
  });

  // Room management
  const hash = window.location.hash;
  if (hash && hash.length > 2) {
    // RECEIVER
    roomId = hash.replace('#/', '');
    isSender = false;
    console.log('Receiver mode, roomId:', roomId);
    setupReceiver();
  } else {
    // SENDER
    isSender = true;
    console.log('Sender mode');
    setupSender();
  }

  // Common socket events
  socket.on('signal', handleSignal);
}

// --- SENDER LOGIC ---
function setupSender() {
  dropZone.classList.remove('hidden');
  transferInfo.classList.add('hidden');
  progressSection.classList.add('hidden');
  downloadButton.classList.add('hidden');
  if (senderShareSection) senderShareSection.style.display = '';

  dropZone.addEventListener('click', () => {
    if (sendType === 'files') fileInput.click();
    else folderInput.click();
  });
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('border-blue-400', 'bg-gray-600');
  });
  dropZone.addEventListener('dragleave', (e) => {
    dropZone.classList.remove('border-blue-400', 'bg-gray-600');
  });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('border-blue-400', 'bg-gray-600');
    if (sendType === 'files') {
      if (e.dataTransfer.files.length > 0) {
        files = Array.from(e.dataTransfer.files);
        handleFilesSelected(files);
      }
    } else {
      if (e.dataTransfer.items) {
        let folderFiles = [];
        for (let i = 0; i < e.dataTransfer.items.length; i++) {
          const item = e.dataTransfer.items[i];
          if (item.kind === 'file') {
            const file = item.getAsFile();
            folderFiles.push(file);
          }
        }
        handleFolderSelected(folderFiles);
      }
    }
  });
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      files = Array.from(e.target.files);
      handleFilesSelected(files);
    }
  });
  folderInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      const folderFiles = Array.from(e.target.files);
      handleFolderSelected(folderFiles);
    }
  });
  copyLinkBtn.addEventListener('click', () => {
    if (shareLinkInput.value) {
      navigator.clipboard.writeText(shareLinkInput.value);
      copyLinkBtn.textContent = 'Copied!';
      setTimeout(() => (copyLinkBtn.textContent = 'Copy'), 1200);
    }
  });
}

function handleFilesSelected(selectedFiles) {
  dropZone.classList.add('hidden');
  transferInfo.classList.remove('hidden');
  if (selectedFiles.length === 1) {
    selectedLabel.textContent = selectedFiles[0].name;
  } else {
    selectedLabel.textContent = selectedFiles.map(f => f.name).join(', ');
  }
  if (senderProgressContainer) senderProgressContainer.classList.remove('hidden');
  if (senderProgressBar) senderProgressBar.style.width = '0%';
  if (senderProgressText) senderProgressText.textContent = '0%';
  roomId = generateRoomId();
  const shareUrl = `${window.location.origin}${window.location.pathname}#/` + roomId;
  shareLinkInput.value = shareUrl;
  shareLinkInput.disabled = false;
  copyLinkBtn.disabled = false;
  setTimeout(() => {
    if (window.QRCode) {
      qrCodeElem.innerHTML = '';
      new QRCode(qrCodeElem, {
        text: shareUrl,
        width: 112,
        height: 112,
        colorDark: '#fff',
        colorLight: '#374151',
        correctLevel: QRCode.CorrectLevel.H
      });
    }
  }, 200);
  socket.emit('join-room', roomId);
  console.log('Sender joined room:', roomId);
}

function handleFolderSelected(folderFiles) {
  dropZone.classList.add('hidden');
  transferInfo.classList.remove('hidden');
  if (folderFiles.length > 0) {
    const firstPath = folderFiles[0].webkitRelativePath;
    const folderName = firstPath.split('/')[0];
    selectedLabel.textContent = folderName;
  } else {
    selectedLabel.textContent = '';
  }
  if (senderProgressContainer) senderProgressContainer.classList.remove('hidden');
  if (senderProgressBar) senderProgressBar.style.width = '0%';
  if (senderProgressText) senderProgressText.textContent = '0%';
  files = folderFiles;
  roomId = generateRoomId();
  const shareUrl = `${window.location.origin}${window.location.pathname}#/` + roomId;
  shareLinkInput.value = shareUrl;
  shareLinkInput.disabled = false;
  copyLinkBtn.disabled = false;
  setTimeout(() => {
    if (window.QRCode) {
      qrCodeElem.innerHTML = '';
      new QRCode(qrCodeElem, {
        text: shareUrl,
        width: 112,
        height: 112,
        colorDark: '#fff',
        colorLight: '#374151',
        correctLevel: QRCode.CorrectLevel.H
      });
    }
  }, 200);
  socket.emit('join-room', roomId);
  console.log('Sender joined room:', roomId);
}

// Listen for 'peer-joined' event to start WebRTC offer
// socket && socket.on && socket.on('peer-joined', () => {
//   console.log('Peer joined, creating offer...');
//   setupWebRtcSender();
// });

function setupWebRtcSender() {
  peerConnection = createPeerConnection();
  dataChannel = peerConnection.createDataChannel('file-transfer');
  dataChannel.binaryType = 'arraybuffer';
  dataChannel.onopen = function() {
    console.log('Data channel open (sender)');
    sendingDataChannel = dataChannel;
    sendingIndex = 0;
    // Update status to 'Transferring...'
    updateStatus('Transferring...');
    sendNextFile();
  };
  dataChannel.onclose = () => { console.log('Data channel closed (sender)'); updateStatus('Data channel closed.'); };
  dataChannel.onerror = (e) => { console.error('Data channel error (sender):', e); updateStatus('Data channel error: ' + e.message); };

  // Create offer
  peerConnection.createOffer().then((offer) => {
    return peerConnection.setLocalDescription(offer);
  }).then(() => {
    // Send offer to receiver
    console.log('Sender sending offer');
    socket.emit('signal', {
      roomId,
      payload: { type: 'offer', sdp: peerConnection.localDescription }
    });
    // Show progress section
    progressSection.classList.remove('hidden');
    updateStatus('Waiting for receiver to connect...');
  });
}

function sendNextFile() {
  if (sendingIndex >= files.length) {
    // All files sent
    sendingDataChannel.send(JSON.stringify({ done: true }));
    showToast('All files sent!');
    updateStatus('Transfer complete!');
    updateOverallProgress();
    return;
  }
  sendingFile = files[sendingIndex];
  sendingOffset = 0;
  sendingMeta = {
    meta: true,
    name: sendingFile.name,
    size: sendingFile.size,
    type: sendingFile.type,
    relativePath: sendingFile.webkitRelativePath || sendingFile.name
  };
  updateFileStatus(sendingIndex, 'Transferring', 'text-blue-400');
  updateFileProgress(sendingIndex, 0);
  // Send file metadata
  console.log('Sender sending file metadata', sendingMeta);
  sendingDataChannel.send(JSON.stringify(sendingMeta));
  sendFileChunksMulti();
}

function sendFileChunksMulti() {
  const chunkSize = 64 * 1024; // 64KB
  if (!sendingDataChannel || sendingDataChannel.readyState !== 'open') return;
  if (sendingOffset >= sendingFile.size) {
    sendingDataChannel.send(JSON.stringify({ fileDone: true, relativePath: sendingMeta.relativePath }));
    updateFileStatus(sendingIndex, 'Complete', 'text-green-400');
    updateFileProgress(sendingIndex, 100);
    if (senderProgressBar) senderProgressBar.style.width = '100%';
    if (senderProgressText) senderProgressText.textContent = '100%';
    sendingIndex++;
    setTimeout(sendNextFile, 0);
    return;
  }
  const reader = new FileReader();
  const slice = sendingFile.slice(sendingOffset, sendingOffset + chunkSize);
  reader.onload = (e) => {
    if (sendingDataChannel.readyState !== 'open') return;
    if (sendingDataChannel.bufferedAmount > 4 * chunkSize) {
      sendingDataChannel.addEventListener('bufferedamountlow', sendFileChunksMulti, { once: true });
      return;
    }
    sendingDataChannel.send(e.target.result);
    sendingOffset += e.target.result.byteLength;
    const percent = Math.floor((sendingOffset / sendingFile.size) * 100);
    updateFileProgress(sendingIndex, percent);
    if (senderProgressBar) senderProgressBar.style.width = percent + '%';
    if (senderProgressText) senderProgressText.textContent = percent + '%';
    setTimeout(sendFileChunksMulti, 0);
  };
  reader.readAsArrayBuffer(slice);
}

// --- RECEIVER LOGIC ---
function setupReceiver() {
  // Hide drop zone, show progress
  dropZone.classList.add('hidden');
  transferInfo.classList.remove('hidden');
  progressSection.classList.add('hidden');
  downloadButton.classList.add('hidden');
  if (senderShareSection) senderShareSection.style.display = 'none';
  updateStatus('Connecting to sender...');

  // Join room
  socket.emit('join-room', roomId);
  console.log('Receiver joined room:', roomId);
}

// --- SIGNAL HANDLING ---
function handleSignal(payload) {
  console.log('Signal received:', payload);
  if (isSender) {
    // Sender receives answer or ICE
    if (payload.type === 'answer') {
      console.log('Sender received answer');
      peerConnection.setRemoteDescription(new RTCSessionDescription(payload.sdp));
    } else if (payload.type === 'ice') {
      console.log('Sender received ICE candidate');
      peerConnection.addIceCandidate(new RTCIceCandidate(payload.candidate));
    }
  } else {
    // Receiver receives offer or ICE
    if (payload.type === 'offer') {
      console.log('Receiver received offer');
      // Setup peer connection
      peerConnection = createPeerConnection();
      peerConnection.ondatachannel = handleDataChannel;
      peerConnection.setRemoteDescription(new RTCSessionDescription(payload.sdp)).then(() => {
        return peerConnection.createAnswer();
      }).then((answer) => {
        return peerConnection.setLocalDescription(answer);
      }).then(() => {
        // Send answer to sender
        console.log('Receiver sending answer');
        socket.emit('signal', {
          roomId,
          payload: { type: 'answer', sdp: peerConnection.localDescription }
        });
      });
    } else if (payload.type === 'ice') {
      console.log('Receiver received ICE candidate');
      peerConnection.addIceCandidate(new RTCIceCandidate(payload.candidate));
    }
  }
}

// --- PEER CONNECTION SETUP ---
function createPeerConnection() {
  const pc = new RTCPeerConnection({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' }
    ]
  });
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      console.log('ICE candidate generated');
      socket.emit('signal', {
        roomId,
        payload: { type: 'ice', candidate: event.candidate }
      });
    }
  };
  return pc;
}

// --- SENDER: FILE CHUNK SENDING ---
function sendFileChunks() {
  if (!dataChannel || dataChannel.readyState !== 'open') return;
  // Send file metadata first
  console.log('Sender sending file metadata');
  dataChannel.send(JSON.stringify({
    meta: true,
    name: file.name,
    size: file.size,
    type: file.type
  }));
  // Read and send file in chunks
  const chunkSize = 64 * 1024; // 64KB
  let offset = 0;
  let lastTime = Date.now();
  let lastBytes = 0;

  function readChunk() {
    const reader = new FileReader();
    const slice = file.slice(offset, offset + chunkSize);
    reader.onload = (e) => {
      if (dataChannel.readyState !== 'open') return;
      dataChannel.send(e.target.result);
      console.log('Sender sent file chunk:', offset, '/', file.size);
      offset += e.target.result.byteLength;
      // Update progress
      const percent = Math.floor((offset / file.size) * 100);
      const now = Date.now();
      const speed = (offset - lastBytes) / ((now - lastTime) / 1000 + 0.001); // bytes/sec
      lastTime = now;
      lastBytes = offset;
      updateProgress(percent, speed);
      if (offset < file.size) {
        setTimeout(readChunk, 0);
      } else {
        // Send transfer complete
        dataChannel.send(JSON.stringify({ done: true }));
        console.log('Sender sent transfer complete');
        updateStatus('Transfer complete!');
      }
    };
    reader.readAsArrayBuffer(slice);
  }
  readChunk();
}

// --- RECEIVER: DATA CHANNEL HANDLING ---
function handleDataChannel(event) {
  const channel = event.channel;
  channel.binaryType = 'arraybuffer';
  receivingMeta = null;
  receivingBuffers = [];
  receivingSize = 0;
  receivingFiles = [];
  if (selectedLabel) selectedLabel.textContent = '';
  if (receiverProgressContainer) receiverProgressContainer.classList.add('hidden');
  if (receiverProgressBar) receiverProgressBar.style.width = '0%';
  if (receiverProgressText) receiverProgressText.textContent = '';

  channel.onmessage = (e) => {
    if (typeof e.data === 'string') {
      try {
        const msg = JSON.parse(e.data);
        if (msg.meta) {
          receivingMeta = msg;
          receivingBuffers = [];
          receivingSize = 0;
          transferInfo.classList.remove('hidden');
          if (msg.relativePath && msg.relativePath.includes('/')) {
            const folderName = msg.relativePath.split('/')[0];
            if (selectedLabel) selectedLabel.textContent = folderName;
          } else {
            if (selectedLabel) selectedLabel.textContent = msg.name;
          }
          if (receiverProgressContainer) receiverProgressContainer.classList.remove('hidden');
          if (receiverProgressBar) receiverProgressBar.style.width = '0%';
          if (receiverProgressText) receiverProgressText.textContent = '0%';
          // Update status to 'Receiving...'
          updateStatus('Receiving...');
        } else if (msg.fileDone) {
          const blob = new Blob(receivingBuffers, { type: receivingMeta.type });
          receivingFiles.push({
            name: receivingMeta.name,
            relativePath: receivingMeta.relativePath,
            blob
          });
          receivingMeta = null;
          receivingBuffers = [];
          receivingSize = 0;
          if (receiverProgressBar) receiverProgressBar.style.width = '100%';
          if (receiverProgressText) receiverProgressText.textContent = '100%';
        } else if (msg.done) {
          offerZipDownload();
          if (receiverProgressContainer) receiverProgressContainer.classList.add('hidden');
        }
      } catch {
        // Not JSON, ignore
      }
    } else {
      if (receivingMeta) {
        receivingBuffers.push(e.data);
        receivingSize += e.data.byteLength;
        const percent = Math.floor((receivingSize / receivingMeta.size) * 100);
        if (receiverProgressBar) receiverProgressBar.style.width = percent + '%';
        if (receiverProgressText) receiverProgressText.textContent = percent + '%';
        updateStatus('Receiving file: ' + (receivingMeta.relativePath || receivingMeta.name) + ' (' + percent + '%)');
      }
    }
  };
  channel.onopen = () => { console.log('Data channel open (receiver)'); updateStatus('Receiving...'); };
  channel.onclose = () => { console.log('Data channel closed (receiver)'); updateStatus('Data channel closed.'); };
  channel.onerror = (e) => { console.error('Data channel error (receiver):', e); updateStatus('Data channel error: ' + e.message); };
}

function assembleFile(meta) {
  const blob = new Blob(receivedBuffers, { type: meta.type });
  fileUrl = URL.createObjectURL(blob);
  downloadButton.classList.remove('hidden');
  downloadButton.textContent = 'Download File';
  downloadButton.onclick = () => {
    const a = document.createElement('a');
    a.href = fileUrl;
    a.download = meta.name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(fileUrl);
    }, 100);
  };
  updateStatus('File ready to download!');
}

// --- UI HELPERS ---
function updateStatus(msg) {
  statusMessage.textContent = msg;
}

function updateProgress(percent, speed) {
  progressBar.style.width = percent + '%';
  progressText.textContent = `${percent}% • ${formatBytes(speed)}/s`;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function generateRoomId() {
  return Math.random().toString(36).substr(2, 10);
}

// --- ZIP DOWNLOAD ---
function offerZipDownload() {
  // Load JSZip if not present
  if (!window.JSZip) {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
    script.onload = createZipAndDownload;
    document.head.appendChild(script);
  } else {
    createZipAndDownload();
  }
}

function createZipAndDownload() {
  const zip = new JSZip();
  for (const file of receivingFiles) {
    zip.file(file.relativePath, file.blob);
  }
  zip.generateAsync({ type: 'blob' }).then((content) => {
    const url = URL.createObjectURL(content);
    downloadButton.classList.remove('hidden');
    downloadButton.textContent = 'Download All as ZIP';
    downloadButton.onclick = () => {
      const a = document.createElement('a');
      a.href = url;
      a.download = 'DirectDrop_Files.zip';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    };
    updateStatus('All files ready to download!');
  });
}

// --- FILE ICONS ---
function getFileIcon(name) {
  const ext = name.split('.').pop().toLowerCase();
  if (name.endsWith('/')) return '📁';
  if (["jpg","jpeg","png","gif","bmp","svg","webp"].includes(ext)) return '🖼️';
  if (["pdf"].includes(ext)) return '📄';
  if (["doc","docx"].includes(ext)) return '📝';
  if (["xls","xlsx"].includes(ext)) return '📊';
  if (["ppt","pptx"].includes(ext)) return '📈';
  if (["zip","rar","7z","tar","gz"].includes(ext)) return '🗜️';
  if (["mp3","wav","ogg"].includes(ext)) return '🎵';
  if (["mp4","avi","mov","mkv"].includes(ext)) return '🎬';
  return '📄';
}

// --- FILE TABLE RENDERING ---
function renderFileTable(filesArr) {
  fileListTable.innerHTML = '';
  fileTableRows = [];
  fileProgress = [];
  fileStatus = [];
  fileDownloadLinks = [];
  totalBytes = 0;
  transferredBytes = 0;
  filesArr.forEach((f, i) => {
    const row = document.createElement('tr');
    const icon = document.createElement('td');
    icon.textContent = getFileIcon(f.webkitRelativePath || f.name);
    icon.className = 'py-1';
    const name = document.createElement('td');
    name.textContent = f.webkitRelativePath || f.name;
    name.className = 'py-1 break-all';
    const size = document.createElement('td');
    size.textContent = formatBytes(f.size);
    size.className = 'py-1';
    const status = document.createElement('td');
    status.textContent = 'Waiting';
    status.className = 'py-1 text-gray-400';
    const progress = document.createElement('td');
    progress.innerHTML = `<div class='w-32 bg-gray-700 rounded h-2 overflow-hidden'><div class='bg-blue-500 h-2 w-0 transition-all duration-300' id='file-progress-${i}'></div></div>`;
    const download = document.createElement('td');
    download.innerHTML = '';
    row.appendChild(icon);
    row.appendChild(name);
    row.appendChild(size);
    row.appendChild(status);
    row.appendChild(progress);
    row.appendChild(download);
    fileListTable.appendChild(row);
    fileTableRows.push(row);
    fileProgress.push(0);
    fileStatus.push('Waiting');
    fileDownloadLinks.push(null);
    totalBytes += f.size;
  });
  totalSizeElem.textContent = 'Total: ' + formatBytes(totalBytes);
  if (filesArr.length > 0) {
    overallProgressContainer.classList.remove('hidden');
    updateOverallProgress();
  } else {
    overallProgressContainer.classList.add('hidden');
  }
}

function updateFileStatus(idx, status, color = 'text-gray-400') {
  if (fileTableRows[idx]) {
    fileTableRows[idx].children[3].textContent = status;
    fileTableRows[idx].children[3].className = 'py-1 ' + color;
    fileStatus[idx] = status;
  }
}
function updateFileProgress(idx, percent) {
  const bar = document.getElementById('file-progress-' + idx);
  if (bar) bar.style.width = percent + '%';
  fileProgress[idx] = percent;
  updateOverallProgress();
}
function setFileDownload(idx, url, name) {
  if (fileTableRows[idx]) {
    fileTableRows[idx].children[5].innerHTML = `<a href="${url}" download="${name}" class="text-blue-400 underline" tabindex="0">Download</a>`;
    fileDownloadLinks[idx] = url;
  }
}
function updateOverallProgress() {
  if (!overallProgressBar) return;
  const avg = fileProgress.length ? fileProgress.reduce((a, b) => a + b, 0) / fileProgress.length : 0;
  overallProgressBar.style.width = avg + '%';
  overallProgressText.textContent = Math.round(avg) + '% complete';
}

// --- THEME TOGGLE ---
if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    darkMode = !darkMode;
    document.documentElement.classList.toggle('dark', darkMode);
    document.body.classList.toggle('bg-gray-900', darkMode);
    document.body.classList.toggle('bg-gray-100', !darkMode);
    showToast(darkMode ? 'Dark mode enabled' : 'Light mode enabled');
  });
}

// --- TOAST NOTIFICATION ---
function showToast(msg, duration = 2500) {
  if (!toastElem) return;
  toastElem.textContent = msg;
  toastElem.classList.remove('hidden');
  setTimeout(() => toastElem.classList.add('hidden'), duration);
} 