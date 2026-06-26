import React, { useRef, useState } from 'react';
import { Share2, Paperclip, AlertTriangle, CheckCircle2, Pause, Play, XCircle, ArrowDown } from 'lucide-react';
import type { FileTransfer, PeerInfo } from '../hooks/useP2P';
import { soundManager } from '../utils/sounds';

interface FileShareProps {
  transfers: FileTransfer[];
  peers: PeerInfo[];
  onSendFile: (file: File, peerId: string) => void;
  onAcceptFile: (fileId: string) => void;
  onControlTransfer: (fileId: string, action: 'pause' | 'resume' | 'cancel') => void;
}

export const FileShare: React.FC<FileShareProps> = ({
  transfers,
  peers,
  onSendFile,
  onAcceptFile,
  onControlTransfer,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedPeerId, setSelectedPeerId] = useState<string>('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    // Choose target peer
    const targetPeer = selectedPeerId || (peers.length > 0 ? peers[0].peerId : '');
    if (!targetPeer) {
      soundManager.playAlert();
      alert('Establish connection to another node before sharing files.');
      return;
    }

    onSendFile(file, targetPeer);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const triggerFileInput = () => {
    soundManager.playClick();
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="terminal-window" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div className="terminal-header">
        <div className="terminal-title">
          <Share2 size={14} className="cyber-glow-amber" />
          <span>QUANTUM_FILE_SHARING</span>
        </div>
        <div className="terminal-actions">
          <span className="terminal-dot active" style={{ backgroundColor: 'var(--color-amber-glow)', boxShadow: '0 0 6px var(--color-amber-glow)' }}></span>
        </div>
      </div>

      <div className="terminal-content" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Peer Selection and Trigger */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className="hacker-input-group">
            <label>Target Peer Node</label>
            <select
              className="hacker-input"
              style={{ fontSize: '13px', padding: '6px 10px', background: '#020503' }}
              value={selectedPeerId}
              onChange={(e) => {
                soundManager.playClick();
                setSelectedPeerId(e.target.value);
              }}
            >
              <option value="">
                {peers.length === 0 ? '--- NO PEERS ONLINE ---' : '-- SELECT PEER NODE --'}
              </option>
              {peers.map((p) => (
                <option key={p.peerId} value={p.peerId}>
                  {p.nickname} ({p.peerId.slice(-4)})
                </option>
              ))}
            </select>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />

          <button
            className="hacker-btn btn-amber"
            style={{ width: '100%', padding: '10px' }}
            onClick={triggerFileInput}
            disabled={peers.length === 0}
          >
            <Paperclip size={14} />
            QUICK UPLOAD DATA
          </button>
        </div>

        {/* Transfer list */}
        <div className="file-list">
          {transfers.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--color-green-dim)', fontSize: '12px', marginTop: '20px' }}>
              NO DATA CHANNELS PENDING
            </div>
          ) : (
            transfers.map((tx) => (
              <div
                key={tx.id}
                className={`file-card ${tx.role === 'sender' ? 'outgoing' : 'incoming'} ${tx.status}`}
              >
                <div className="file-header-row">
                  <div className="file-title" title={tx.name}>
                    {tx.name}
                  </div>
                  <div className="file-size-badge">
                    {formatSize(tx.size)}
                  </div>
                </div>

                <div className="file-progress-bar">
                  <div
                    className="file-progress-fill"
                    style={{ width: `${tx.progress}%` }}
                  ></div>
                </div>

                <div className="file-footer-row">
                  <span className="file-status-text">
                    {tx.role === 'sender' ? '↑ OUTGOING' : '↓ INCOMING'} • {tx.status.toUpperCase()} ({tx.progress}%)
                  </span>

                  <div className="file-controls">
                    {/* Accept button for incoming pending files */}
                    {tx.status === 'pending' && tx.role === 'receiver' && (
                      <button
                        className="file-ctrl-btn btn-download"
                        style={{ padding: '2px 8px', fontWeight: 'bold' }}
                        onClick={() => onAcceptFile(tx.id)}
                      >
                        ACCEPT & SAVE
                      </button>
                    )}

                    {/* Pause/Resume/Cancel buttons */}
                    {tx.status === 'transferring' && (
                      <button
                        className="file-ctrl-btn btn-pause"
                        title="Pause"
                        onClick={() => onControlTransfer(tx.id, 'pause')}
                      >
                        <Pause size={10} />
                      </button>
                    )}
                    
                    {tx.status === 'paused' && (
                      <button
                        className="file-ctrl-btn"
                        title="Resume"
                        onClick={() => onControlTransfer(tx.id, 'resume')}
                      >
                        <Play size={10} />
                      </button>
                    )}

                    {/* Cancel button */}
                    {(tx.status === 'transferring' || tx.status === 'paused' || (tx.status === 'pending' && tx.role === 'sender')) && (
                      <button
                        className="file-ctrl-btn btn-cancel"
                        title="Cancel"
                        onClick={() => onControlTransfer(tx.id, 'cancel')}
                      >
                        <XCircle size={10} />
                      </button>
                    )}

                    {/* Reject button for pending receiver */}
                    {tx.status === 'pending' && tx.role === 'receiver' && (
                      <button
                        className="file-ctrl-btn btn-cancel"
                        title="Reject"
                        onClick={() => onControlTransfer(tx.id, 'cancel')}
                      >
                        REJECT
                      </button>
                    )}

                    {/* Manual download for completed incoming files */}
                    {tx.status === 'completed' && tx.role === 'receiver' && tx.blobUrl && (
                      <a
                        href={tx.blobUrl}
                        download={tx.name}
                        className="file-ctrl-btn btn-download"
                        title="Save File"
                        style={{ display: 'inline-flex', textDecoration: 'none', alignItems: 'center' }}
                      >
                        <ArrowDown size={10} style={{ marginRight: '2px' }} />
                        SAVE
                      </a>
                    )}

                    {/* Status icons */}
                    {tx.status === 'completed' && (
                      <CheckCircle2 size={12} style={{ color: 'var(--color-green-glow)' }} />
                    )}

                    {tx.status === 'cancelled' && (
                      <AlertTriangle size={12} style={{ color: 'var(--color-red-glow)' }} />
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
