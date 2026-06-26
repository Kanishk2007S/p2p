import { useState, useEffect, useRef, useCallback } from 'react';
import Peer from 'peerjs';
import type { DataConnection, MediaConnection } from 'peerjs';
import { deriveRoomKey } from '../utils/crypto';
import { soundManager } from '../utils/sounds';

// Maximum peers in the mesh room (for connection stability without signaling database)
const MAX_PEERS = 8;
const CHUNK_SIZE = 16384; // 16KB WebRTC chunk size for safe throughput

export interface PeerInfo {
  peerId: string;
  nickname: string;
  index: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: Date;
  isSystem?: boolean;
}

export interface FileTransfer {
  id: string;
  name: string;
  size: number;
  type: string;
  role: 'sender' | 'receiver';
  peerId: string;
  peerName: string;
  progress: number; // Percentage
  status: 'pending' | 'transferring' | 'paused' | 'cancelled' | 'completed';
  chunksReceived: number;
  totalChunks: number;
  blobUrl?: string;
  file?: File; // Sender only
}

export interface SystemLog {
  timestamp: string;
  type: 'info' | 'success' | 'warn' | 'error';
  message: string;
}

export function useP2P(roomName: string, roomPass: string, nickname: string) {
  const [myPeerId, setMyPeerId] = useState<string>('');
  const [myIndex, setMyIndex] = useState<number>(-1);
  const [peers, setPeers] = useState<Record<string, PeerInfo>>({});
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [fileTransfers, setFileTransfersState] = useState<Record<string, FileTransfer>>({});
  const fileTransfersRef = useRef<Record<string, FileTransfer>>({});

  const setFileTransfers = useCallback((val: Record<string, FileTransfer> | ((prev: Record<string, FileTransfer>) => Record<string, FileTransfer>)) => {
    if (typeof val === 'function') {
      setFileTransfersState(prev => {
        const next = val(prev);
        fileTransfersRef.current = next;
        return next;
      });
    } else {
      fileTransfersRef.current = val;
      setFileTransfersState(val);
    }
  }, []);

  const [systemLogs, setSystemLogs] = useState<SystemLog[]>([]);
  
  // Media streams
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peerStreams, setPeerStreams] = useState<Record<string, MediaStream>>({});
  const [isCallActive, setIsCallActive] = useState<boolean>(false);
  const [incomingCall, setIncomingCall] = useState<{ call: MediaConnection; callerName: string } | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isVideoOff, setIsVideoOff] = useState<boolean>(false);

  // Refs for WebRTC coordination
  const peerRef = useRef<Peer | null>(null);
  const connectionsRef = useRef<Record<string, DataConnection>>({});
  const callsRef = useRef<Record<string, MediaConnection>>({});
  const fileChunksRef = useRef<Record<string, ArrayBuffer[]>>({}); // Temporary store for receiving files (RAM fallback)
  const writablesRef = useRef<Record<string, any>>({}); // Filesystem write streams for large files (150GB support)
  const ringtoneStopRef = useRef<(() => void) | null>(null);

  // Helper to add logs to the hacker console
  const addLog = useCallback((message: string, type: SystemLog['type'] = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setSystemLogs(prev => [...prev.slice(-99), { timestamp, type, message }]);
  }, []);

  // Send a control message to a specific peer's data channel
  const sendToPeer = useCallback((peerId: string, payload: any) => {
    const conn = connectionsRef.current[peerId];
    if (conn && conn.open) {
      conn.send(payload);
    }
  }, []);

  // Broadcast a control message to all connected peers
  const broadcast = useCallback((payload: any) => {
    Object.keys(connectionsRef.current).forEach(peerId => {
      sendToPeer(peerId, payload);
    });
  }, [sendToPeer]);

  // Clean up a specific peer's connections and resources
  const removePeer = useCallback((peerId: string) => {
    const peerName = peers[peerId]?.nickname || 'Unknown Node';
    
    // Close data connection
    if (connectionsRef.current[peerId]) {
      try { connectionsRef.current[peerId].close(); } catch(e) {}
      delete connectionsRef.current[peerId];
    }

    // Close call
    if (callsRef.current[peerId]) {
      try { callsRef.current[peerId].close(); } catch(e) {}
      delete callsRef.current[peerId];
    }

    // Remove video stream
    setPeerStreams(prev => {
      const copy = { ...prev };
      delete copy[peerId];
      return copy;
    });

    // Remove peer info
    setPeers(prev => {
      const copy = { ...prev };
      delete copy[peerId];
      return copy;
    });

    addLog(`DISCONNECTED: Node ${peerName} (${peerId}) offline.`, 'warn');
    setChatMessages(prev => [
      ...prev,
      {
        id: Math.random().toString(),
        senderId: 'system',
        senderName: 'SYSTEM',
        text: `Node [${peerName}] has disconnected.`,
        timestamp: new Date(),
        isSystem: true
      }
    ]);
  }, [peers, addLog]);

  // Handle incoming chat messages
  const sendChatMessage = useCallback((text: string) => {
    if (!text.trim()) return;
    soundManager.playClick();
    
    const msgId = Math.random().toString();
    const newMsg: ChatMessage = {
      id: msgId,
      senderId: myPeerId,
      senderName: nickname,
      text,
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, newMsg]);
    broadcast({
      type: 'chat',
      id: msgId,
      senderName: nickname,
      text
    });
  }, [myPeerId, nickname, broadcast]);

  // Core File Transfer Chunk Pull Loop
  const requestNextChunk = useCallback((fileId: string, chunkIndex: number) => {
    const transfer = fileTransfersRef.current[fileId];
    if (!transfer || transfer.status !== 'transferring') return;
    
    sendToPeer(transfer.peerId, {
      type: 'file-request-chunk',
      fileId,
      chunkIndex
    });
  }, [sendToPeer]);

  // Accept File and open save location stream
  const acceptFile = useCallback(async (fileId: string) => {
    soundManager.playClick();
    const transfer = fileTransfersRef.current[fileId];
    if (!transfer || transfer.role !== 'receiver') return;

    const hasFileSystemAccess = 'showSaveFilePicker' in window;
    
    if (hasFileSystemAccess) {
      try {
        addLog(`Requesting disk sector mapping for "${transfer.name}"...`, 'info');
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: transfer.name,
        });
        const writable = await handle.createWritable();
        writablesRef.current[fileId] = writable;
        addLog(`Storage link mapped to local file. Starting chunk-pull stream...`, 'success');
      } catch (err: any) {
        addLog(`Disk channel aborted: ${err.message}. Falling back to RAM buffer (1.5GB cap).`, 'warn');
        fileChunksRef.current[fileId] = [];
      }
    } else {
      addLog(`Origin stream storage unsupported. Fallback active: RAM buffering.`, 'warn');
      fileChunksRef.current[fileId] = [];
    }

    setFileTransfers(prev => ({
      ...prev,
      [fileId]: { ...prev[fileId], status: 'transferring' as const }
    }));

    // Start chunk pull
    sendToPeer(transfer.peerId, {
      type: 'file-request-chunk',
      fileId,
      chunkIndex: 0
    });
  }, [sendToPeer, setFileTransfers, addLog]);

  // Handle Pause, Resume, Cancel File Transfers
  const controlFileTransfer = useCallback((fileId: string, action: 'pause' | 'resume' | 'cancel') => {
    soundManager.playClick();
    const transfer = fileTransfersRef.current[fileId];
    if (!transfer) return;

    if (action === 'pause') {
      addLog(`File transfer paused: ${transfer.name}`, 'warn');
      setFileTransfers(prev => ({
        ...prev,
        [fileId]: { ...prev[fileId], status: 'paused' }
      }));
      sendToPeer(transfer.peerId, { type: 'file-control', fileId, action: 'pause' });
    } 
    else if (action === 'resume') {
      addLog(`File transfer resumed: ${transfer.name}`, 'info');
      setFileTransfers(prev => {
        const updated = { ...prev[fileId], status: 'transferring' as const };
        
        // If we are the receiver, pull the next chunk immediately
        if (updated.role === 'receiver') {
          setTimeout(() => {
            requestNextChunk(fileId, updated.chunksReceived);
          }, 50);
        }
        
        return {
          ...prev,
          [fileId]: updated
        };
      });
      sendToPeer(transfer.peerId, { type: 'file-control', fileId, action: 'resume' });
    } 
    else if (action === 'cancel') {
      addLog(`File transfer cancelled: ${transfer.name}`, 'error');
      soundManager.playAlert();
      
      setFileTransfers(prev => ({
        ...prev,
        [fileId]: { ...prev[fileId], status: 'cancelled' }
      }));
      
      sendToPeer(transfer.peerId, { type: 'file-control', fileId, action: 'cancel' });

      // Clean up streams & buffers
      if (writablesRef.current[fileId]) {
        try { writablesRef.current[fileId].close(); } catch (e) {}
        delete writablesRef.current[fileId];
      }
      delete fileChunksRef.current[fileId];
    }
  }, [sendToPeer, setFileTransfers, requestNextChunk, addLog]);

  // Send file initialization
  const sendFile = useCallback((file: File, peerId: string) => {
    soundManager.playClick();
    const fileId = Math.random().toString(36).substring(2, 9);
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const peerName = peers[peerId]?.nickname || 'Peer';

    const newTransfer: FileTransfer = {
      id: fileId,
      name: file.name,
      size: file.size,
      type: file.type,
      role: 'sender',
      peerId,
      peerName,
      progress: 0,
      status: 'pending',
      chunksReceived: 0,
      totalChunks,
      file
    };

    setFileTransfers(prev => ({ ...prev, [fileId]: newTransfer }));
    addLog(`INITIATED FILE TRANSFER: "${file.name}" to ${peerName}. Waiting for handshake...`, 'info');

    // Notify receiver about file metadata
    sendToPeer(peerId, {
      type: 'file-meta',
      fileId,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      totalChunks
    });
  }, [peers, sendToPeer, addLog]);

  // WebRTC Audio/Video Calls mesh setup
  const startCall = useCallback(async () => {
    if (isCallActive) return;
    soundManager.playClick();
    addLog('Requesting system media permissions (Camera/Mic)...', 'info');
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      setLocalStream(stream);
      setIsCallActive(true);
      addLog('Local camera stream acquired. Ringing other nodes...', 'success');

      // Call all active peers in the room
      Object.keys(connectionsRef.current).forEach(peerId => {
        addLog(`Dialing node ${peers[peerId]?.nickname || 'Node'}...`, 'info');
        const call = peerRef.current!.call(peerId, stream);
        callsRef.current[peerId] = call;

        call.on('stream', (remoteStream) => {
          addLog(`Stream handshake established with node ${peers[peerId]?.nickname || 'Node'}.`, 'success');
          setPeerStreams(prev => ({ ...prev, [peerId]: remoteStream }));
        });

        call.on('error', (err) => {
          addLog(`Call error with peer ${peerId}: ${err.message}`, 'error');
        });
      });
    } catch (err: any) {
      addLog(`Failed to acquire media stream: ${err.name} - ${err.message}`, 'error');
      soundManager.playAlert();
    }
  }, [isCallActive, peers, addLog]);

  const acceptCall = useCallback(() => {
    if (!incomingCall) return;
    soundManager.playClick();
    if (ringtoneStopRef.current) {
      ringtoneStopRef.current();
      ringtoneStopRef.current = null;
    }

    addLog('Accepting call. Fetching camera/mic...', 'info');

    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
      setLocalStream(stream);
      setIsCallActive(true);
      
      const { call, callerName } = incomingCall;
      call.answer(stream);
      callsRef.current[call.peer] = call;

      addLog(`Connected voice/video mesh with ${callerName}.`, 'success');
      
      call.on('stream', (remoteStream) => {
        setPeerStreams(prev => ({ ...prev, [call.peer]: remoteStream }));
      });
      
      setIncomingCall(null);
    }).catch(err => {
      addLog(`Media access error: ${err.message}`, 'error');
      soundManager.playAlert();
      declineCall();
    });
  }, [incomingCall, addLog]);

  const declineCall = useCallback(() => {
    soundManager.playClick();
    if (ringtoneStopRef.current) {
      ringtoneStopRef.current();
      ringtoneStopRef.current = null;
    }

    if (incomingCall) {
      incomingCall.call.close();
      setIncomingCall(null);
      addLog('Call declined.', 'warn');
    }
  }, [incomingCall, addLog]);

  const endCall = useCallback(() => {
    soundManager.playClick();
    addLog('Terminating current calling session.', 'warn');

    // Close all peer calls
    Object.keys(callsRef.current).forEach(peerId => {
      try { callsRef.current[peerId].close(); } catch (e) {}
      delete callsRef.current[peerId];
    });

    // Close local stream tracks
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }

    setPeerStreams({});
    setIsCallActive(false);
    setIncomingCall(null);
    
    if (ringtoneStopRef.current) {
      ringtoneStopRef.current();
      ringtoneStopRef.current = null;
    }
  }, [localStream, addLog]);

  // Audio mute toggles
  const toggleMute = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  }, [localStream]);

  const toggleVideo = useCallback(() => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  }, [localStream]);

  // Main Effect: Connection setup, peer discovery scan, and signaling listeners
  useEffect(() => {
    let active = true;
    let discoveryInterval: any = null;

    const initP2P = async () => {
      addLog(`Calculating cryptographic signature for room [${roomName}]...`, 'info');
      const hash = await deriveRoomKey(roomName, roomPass);
      addLog(`Cryptographic signature derived: ${hash}. Registering on signaling gateway...`, 'info');

      // Attempt to register at index 0..7
      let currentIndex = 0;
      const attemptRegister = () => {
        if (!active) return;
        if (currentIndex >= MAX_PEERS) {
          addLog('Signaling channel error: Room is currently full (max 8 peers).', 'error');
          soundManager.playAlert();
          return;
        }

        const registrationId = `shadownet_${hash}_${currentIndex}`;
        addLog(`Registering socket node: ${registrationId}...`, 'info');
        
        const peer = new Peer(registrationId, {
          debug: 1,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' },
              { urls: 'stun:stun2.l.google.com:19302' },
              { urls: 'stun:stun3.l.google.com:19302' },
              // TURN servers to traverse strict firewalls, routers, and cellular carriers
              { urls: 'stun:openrelay.metered.ca:80' },
              { 
                urls: 'turn:openrelay.metered.ca:80',
                username: 'openrelayproject',
                credential: 'openrelayproject'
              },
              { 
                urls: 'turn:openrelay.metered.ca:443',
                username: 'openrelayproject',
                credential: 'openrelayproject'
              },
              { 
                urls: 'turn:openrelay.metered.ca:443?transport=tcp',
                username: 'openrelayproject',
                credential: 'openrelayproject'
              }
            ]
          }
        });

        peer.on('open', (id) => {
          if (!active) {
            peer.destroy();
            return;
          }
          addLog(`REGISTRATION SUCCESSFUL. Active on Node ID: ${id}`, 'success');
          soundManager.playBeep();
          setMyPeerId(id);
          setMyIndex(currentIndex);
          peerRef.current = peer;

          // Start Mesh Peer Discovery Loop
          startDiscoveryLoop(hash, currentIndex);
        });

        peer.on('error', (err: any) => {
          if (err.type === 'unavailable-id') {
            addLog(`Conflict: node ${registrationId} already active. Probing index ${currentIndex + 1}...`, 'warn');
            peer.destroy();
            currentIndex++;
            setTimeout(attemptRegister, 100);
          } else if (err.type === 'disconnected' || err.type === 'network' || err.type === 'socket-error' || err.type === 'socket-closed') {
            addLog(`Signaling link offline: ${err.message}. Retrying connection...`, 'warn');
            if (active && !peer.destroyed) {
              try { peer.reconnect(); } catch (e) {}
            }
          } else {
            addLog(`Signaling link warning: ${err.message}`, 'warn');
          }
        });

        peer.on('disconnected', () => {
          addLog('Connection to signaling gateway lost. Retrying com-link reconnection...', 'warn');
          if (active && !peer.destroyed) {
            try { peer.reconnect(); } catch (e) {}
          }
        });

        // Set up WebRTC channel bindings
        peer.on('connection', (conn) => {
          const incomingPeerId = conn.peer;
          
          conn.on('open', () => {
            addLog(`INCOMING CONNECTION from P2P node: ${incomingPeerId}. Authenticating...`, 'info');
            connectionsRef.current[incomingPeerId] = conn;
            
            // Handshake exchange: send our identity
            conn.send({ type: 'handshake', nickname });
          });

          bindDataEvents(conn);
        });

        // Set up call receiver bindings
        peer.on('call', (call) => {
          addLog(`INCOMING CALL signal from peer: ${call.peer}`, 'warn');
          
          // Ringing audio
          if (ringtoneStopRef.current) ringtoneStopRef.current();
          ringtoneStopRef.current = soundManager.playRingtone();
          
          // Match peer nickname
          const callerName = peers[call.peer]?.nickname || 'Unknown Operator';
          setIncomingCall({ call, callerName });
        });
      };

      attemptRegister();
    };

    const startDiscoveryLoop = (roomHash: string, selfIndex: number) => {
      // Periodic check to build/maintain full-mesh connections
      const runScan = () => {
        if (!peerRef.current || peerRef.current.destroyed) return;

        // Peer mesh design: higher indices dial lower indices to resolve race conditions
        for (let targetIdx = 0; targetIdx < selfIndex; targetIdx++) {
          const targetId = `shadownet_${roomHash}_${targetIdx}`;
          
          // Check if we don't have an active connection
          if (!connectionsRef.current[targetId]) {
            addLog(`Establishing connection to sibling node ${targetId}...`, 'info');
            
            const conn = peerRef.current.connect(targetId, {
              metadata: { nickname }
            });
            
            connectionsRef.current[targetId] = conn;

            conn.on('open', () => {
              addLog(`Connection established with sibling node ${targetId}.`, 'success');
              conn.send({ type: 'handshake', nickname });
            });

            bindDataEvents(conn);
          }
        }
      };

      runScan(); // Initial check
      discoveryInterval = setInterval(runScan, 4000); // Check every 4 seconds for dead/new nodes
    };

    const bindDataEvents = (conn: DataConnection) => {
      const senderId = conn.peer;

      conn.on('data', (data: any) => {
        if (!data || typeof data !== 'object') return;

        switch (data.type) {
          case 'handshake':
            setPeers(prev => {
              // Extract index from Peer ID string shadownet_hash_index
              const parts = senderId.split('_');
              const index = parseInt(parts[parts.length - 1], 10);
              const nickname = data.nickname || `Peer_${index}`;
              
              addLog(`Node authenticated: ${nickname} as ID ${senderId}`, 'success');
              
              setChatMessages(prevChat => [
                ...prevChat,
                {
                  id: Math.random().toString(),
                  senderId: 'system',
                  senderName: 'SYSTEM',
                  text: `Node [${nickname}] joined the workspace.`,
                  timestamp: new Date(),
                  isSystem: true
                }
              ]);

              return {
                ...prev,
                [senderId]: { peerId: senderId, nickname, index }
              };
            });
            break;

          case 'chat':
            setChatMessages(prev => [
              ...prev,
              {
                id: data.id || Math.random().toString(),
                senderId,
                senderName: data.senderName,
                text: data.text,
                timestamp: new Date()
              }
            ]);
            soundManager.playBeep();
            break;

          case 'file-meta': {
            const { fileId, fileName, fileSize, fileType, totalChunks } = data;
            const peerName = peers[senderId]?.nickname || 'Peer';

            // Initialize receiver file entry as pending choice
            const rxTransfer: FileTransfer = {
              id: fileId,
              name: fileName,
              size: fileSize,
              type: fileType,
              role: 'receiver',
              peerId: senderId,
              peerName,
              progress: 0,
              status: 'pending', // Awaiting manual acceptance
              chunksReceived: 0,
              totalChunks
            };

            setFileTransfers(prev => ({ ...prev, [fileId]: rxTransfer }));
            addLog(`INCOMING FILE SIGNAL: "${fileName}" (${Math.round(fileSize/1024)} KB) from ${peerName}. Confirm download location.`, 'warn');
            soundManager.playBeep();
            break;
          }

          case 'file-request-chunk': {
            const { fileId, chunkIndex } = data;
            const transfer = fileTransfersRef.current[fileId];
            if (!transfer || transfer.status !== 'transferring') return;

            // Read file block
            const file = transfer.file;
            if (!file) return;

            const start = chunkIndex * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, file.size);
            const blob = file.slice(start, end);

            const reader = new FileReader();
            reader.onload = (e) => {
              if (e.target?.result) {
                sendToPeer(senderId, {
                  type: 'file-chunk',
                  fileId,
                  chunkIndex,
                  data: e.target.result
                });
              }
            };
            reader.readAsArrayBuffer(blob);

            const progress = Math.round(((chunkIndex + 1) / transfer.totalChunks) * 100);

            // Update sender progress
            setFileTransfers(prev => {
              const current = prev[fileId];
              if (!current) return prev;
              return {
                ...prev,
                [fileId]: {
                  ...current,
                  chunksReceived: chunkIndex + 1,
                  progress,
                  status: progress === 100 ? ('completed' as const) : ('transferring' as const)
                }
              };
            });

            if (progress === 100) {
              addLog(`File sent successfully: ${transfer.name}`, 'success');
              soundManager.playSuccess();
            }
            break;
          }

          case 'file-chunk': {
            const { fileId, chunkIndex, data: arrayBuffer } = data;
            
            const streamAndRequest = async () => {
              const transfer = fileTransfersRef.current[fileId];
              if (!transfer || transfer.status !== 'transferring') return;

              const writable = writablesRef.current[fileId];
              if (writable) {
                try {
                  await writable.write(new Uint8Array(arrayBuffer));
                } catch (e: any) {
                  addLog(`Disk block write failed: ${e.message}`, 'error');
                  controlFileTransfer(fileId, 'cancel');
                  return;
                }
              } else {
                if (!fileChunksRef.current[fileId]) {
                  fileChunksRef.current[fileId] = [];
                }
                fileChunksRef.current[fileId][chunkIndex] = arrayBuffer;
              }

              const chunksReceived = transfer.chunksReceived + 1;
              const progress = Math.round((chunksReceived / transfer.totalChunks) * 100);

              setFileTransfers(prev => {
                const current = prev[fileId];
                if (!current) return prev;
                return {
                  ...prev,
                  [fileId]: {
                    ...current,
                    chunksReceived,
                    progress,
                    status: progress === 100 ? ('completed' as const) : ('transferring' as const)
                  }
                };
              });

              if (progress === 100) {
                if (writable) {
                  try { await writable.close(); } catch (e) {}
                  delete writablesRef.current[fileId];
                } else {
                  const allChunks = fileChunksRef.current[fileId];
                  const fullBlob = new Blob(allChunks, { type: transfer.type });
                  const blobUrl = URL.createObjectURL(fullBlob);
                  
                  const dlLink = document.createElement('a');
                  dlLink.href = blobUrl;
                  dlLink.download = transfer.name;
                  dlLink.click();
                  
                  delete fileChunksRef.current[fileId];
                }
                addLog(`Finished downloading: ${transfer.name}. Data channel verified and finalized.`, 'success');
                soundManager.playSuccess();
              } else {
                // Request next block
                sendToPeer(senderId, {
                  type: 'file-request-chunk',
                  fileId,
                  chunkIndex: chunksReceived
                });
              }
            };

            streamAndRequest();
            break;
          }

          case 'file-control': {
            const { fileId, action } = data;
            setFileTransfers(prev => {
              const transfer = prev[fileId];
              if (!transfer) return prev;

              if (action === 'pause') {
                addLog(`Remote peer paused transfer of: ${transfer.name}`, 'warn');
                return {
                  ...prev,
                  [fileId]: { ...transfer, status: 'paused' }
                };
              } 
              else if (action === 'resume') {
                addLog(`Remote peer resumed transfer of: ${transfer.name}`, 'info');
                const updated = { ...transfer, status: 'transferring' as const };
                
                // If we are the receiver, pull the next block
                if (updated.role === 'receiver') {
                  setTimeout(() => {
                    requestNextChunk(fileId, updated.chunksReceived);
                  }, 50);
                }
                
                return {
                  ...prev,
                  [fileId]: updated
                };
              } 
              else if (action === 'cancel') {
                addLog(`Remote peer cancelled transfer of: ${transfer.name}`, 'error');
                soundManager.playAlert();
                
                if (writablesRef.current[fileId]) {
                  try { writablesRef.current[fileId].close(); } catch(e) {}
                  delete writablesRef.current[fileId];
                }
                delete fileChunksRef.current[fileId];
                
                return {
                  ...prev,
                  [fileId]: { ...transfer, status: 'cancelled' }
                };
              }
              return prev;
            });
            break;
          }
        }
      });

      conn.on('close', () => {
        removePeer(senderId);
      });

      conn.on('error', (err) => {
        addLog(`P2P channel error on peer connection ${senderId}: ${err.message}`, 'error');
        removePeer(senderId);
      });
    };

    initP2P();

    return () => {
      active = false;
      if (discoveryInterval) clearInterval(discoveryInterval);
      
      // Stop calling ringing tone
      if (ringtoneStopRef.current) {
        ringtoneStopRef.current();
      }

      // Close all connections
      Object.keys(connectionsRef.current).forEach(peerId => {
        try { connectionsRef.current[peerId].close(); } catch(e) {}
      });
      Object.keys(callsRef.current).forEach(peerId => {
        try { callsRef.current[peerId].close(); } catch(e) {}
      });

      // Close media tracks
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }

      if (peerRef.current) {
        peerRef.current.destroy();
      }
    };
  }, [roomName, roomPass, addLog, removePeer]); // Run once when room settings are set

  return {
    myPeerId,
    myIndex,
    peers: Object.values(peers),
    chatMessages,
    fileTransfers: Object.values(fileTransfers),
    systemLogs,
    localStream,
    peerStreams,
    isCallActive,
    incomingCall,
    isMuted,
    isVideoOff,
    sendChatMessage,
    sendFile,
    acceptFile,
    controlFileTransfer,
    startCall,
    acceptCall,
    declineCall,
    endCall,
    toggleMute,
    toggleVideo,
    addLog
  };
}
