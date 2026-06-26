import React, { useEffect, useRef } from 'react';
import { Video, VideoOff, Mic, MicOff, Phone, PhoneOff } from 'lucide-react';
import type { PeerInfo } from '../hooks/useP2P';
import { soundManager } from '../utils/sounds';

interface MediaGridProps {
  localStream: MediaStream | null;
  peerStreams: Record<string, MediaStream>;
  peers: PeerInfo[];
  isCallActive: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
  onStartCall: () => void;
  onEndCall: () => void;
  onToggleMute: () => void;
  onToggleVideo: () => void;
}

// Sub-component to safely handle HTML5 video stream mounting
const VideoFrame: React.FC<{ stream: MediaStream; label: string; isSelf?: boolean }> = ({
  stream,
  label,
  isSelf = false
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className={`video-frame ${isSelf ? 'self' : ''}`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isSelf} // Always mute self to prevent local microphone feedback
      />
      <div className="video-label">{label}</div>
    </div>
  );
};

export const MediaGrid: React.FC<MediaGridProps> = ({
  localStream,
  peerStreams,
  peers,
  isCallActive,
  isMuted,
  isVideoOff,
  onStartCall,
  onEndCall,
  onToggleMute,
  onToggleVideo
}) => {
  const remotePeerIds = Object.keys(peerStreams);

  const getNickname = (peerId: string) => {
    const found = peers.find(p => p.peerId === peerId);
    return found ? found.nickname : 'Remote Node';
  };

  return (
    <div className="terminal-window" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="terminal-header">
        <div className="terminal-title">
          <Video size={14} className="cyber-glow-cyan" />
          <span>CYBERNETIC_MEDIA_MESH</span>
        </div>
        <div className="terminal-actions">
          <span className="terminal-dot active" style={{ backgroundColor: 'var(--color-cyan-glow)', boxShadow: '0 0 6px var(--color-cyan-glow)' }}></span>
        </div>
      </div>

      <div className="terminal-content" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', background: '#020402', overflow: 'hidden' }}>
        {!isCallActive ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '24px', textAlign: 'center' }}>
            <Phone size={36} className="cyber-glow-green" style={{ animation: 'pulse-glow 2s infinite' }} />
            <div style={{ color: 'var(--color-green-dim)', fontSize: '13px' }}>
              ENCRYPTED WebRTC VOICE & VIDEO CALL
            </div>
            <button className="hacker-btn btn-green" onClick={onStartCall}>
              INITIALIZE BROADCAST
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
            {/* Grid of video frames */}
            <div className="video-mesh-area">
              {/* Local Stream Frame */}
              {localStream && (
                <VideoFrame
                  stream={localStream}
                  label={`YOU ${isMuted ? '[MUTED]' : ''} ${isVideoOff ? '[CAM OFF]' : ''}`}
                  isSelf={true}
                />
              )}

              {/* Remote Stream Frames */}
              {remotePeerIds.map((peerId) => (
                <VideoFrame
                  key={peerId}
                  stream={peerStreams[peerId]}
                  label={getNickname(peerId)}
                />
              ))}

              {remotePeerIds.length === 0 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--color-green-dark)', aspectRatio: '4/3', borderRadius: '4px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--color-green-dim)', textTransform: 'uppercase' }}>
                    WAITING FOR SIBLINGS TO BIND STREAM...
                  </span>
                </div>
              )}
            </div>

            {/* Media control bars */}
            <div className="video-controls-row">
              <button
                className={`hacker-btn ${isMuted ? 'btn-red' : 'btn-cyan'}`}
                style={{ padding: '8px 14px' }}
                onClick={() => {
                  soundManager.playClick();
                  onToggleMute();
                }}
                title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
              >
                {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
              </button>

              <button
                className={`hacker-btn ${isVideoOff ? 'btn-red' : 'btn-cyan'}`}
                style={{ padding: '8px 14px' }}
                onClick={() => {
                  soundManager.playClick();
                  onToggleVideo();
                }}
                title={isVideoOff ? 'Enable Camera' : 'Disable Camera'}
              >
                {isVideoOff ? <VideoOff size={16} /> : <Video size={16} />}
              </button>

              <button
                className="hacker-btn btn-red"
                style={{ padding: '8px 14px' }}
                onClick={onEndCall}
                title="Disconnect Call"
              >
                <PhoneOff size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
