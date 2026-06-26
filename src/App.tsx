import React, { useState } from 'react';
import { Activity, LogOut, PhoneCall, Volume2, VolumeX, ShieldAlert } from 'lucide-react';
import { useP2P } from './hooks/useP2P';
import { MatrixRain } from './components/MatrixRain';
import { Lobby } from './components/Lobby';
import { TerminalLogs } from './components/TerminalLogs';
import { ChatConsole } from './components/ChatConsole';
import { FileShare } from './components/FileShare';
import { MediaGrid } from './components/MediaGrid';
import { soundManager } from './utils/sounds';

export const App: React.FC = () => {
  const [inRoom, setInRoom] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [roomPass, setRoomPass] = useState('');
  const [nickname, setNickname] = useState('');
  const [soundMuted, setSoundMuted] = useState(soundManager.getMuteState());

  const handleJoinRoom = (name: string, pass: string, nick: string) => {
    setRoomName(name);
    setRoomPass(pass);
    setNickname(nick);
    setInRoom(true);
  };

  const handleDisconnect = () => {
    soundManager.playAlert();
    setInRoom(false);
    setRoomName('');
    setRoomPass('');
  };

  const toggleSoundMute = () => {
    const isMuted = soundManager.toggleMute();
    setSoundMuted(isMuted);
  };

  return (
    <div className="app-container">
      {/* CRT scanline filters */}
      <div className="crt-overlay"></div>
      <div className="crt-scanline"></div>

      {/* Animated Matrix Background */}
      <MatrixRain />

      {!inRoom ? (
        <Lobby onJoin={handleJoinRoom} />
      ) : (
        <RoomConsole
          roomName={roomName}
          roomPass={roomPass}
          nickname={nickname}
          onDisconnect={handleDisconnect}
          soundMuted={soundMuted}
          onToggleSound={toggleSoundMute}
        />
      )}
    </div>
  );
};

interface RoomConsoleProps {
  roomName: string;
  roomPass: string;
  nickname: string;
  onDisconnect: () => void;
  soundMuted: boolean;
  onToggleSound: () => void;
}

const RoomConsole: React.FC<RoomConsoleProps> = ({
  roomName,
  roomPass,
  nickname,
  onDisconnect,
  soundMuted,
  onToggleSound,
}) => {
  const {
    myPeerId,
    peers,
    chatMessages,
    fileTransfers,
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
  } = useP2P(roomName, roomPass, nickname);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', zIndex: 10 }}>
      {/* Top Banner Header */}
      <header className="dashboard-header">
        <div className="dashboard-title-area">
          <Activity className="cyber-glow-green" size={18} style={{ animation: 'pulse-glow 1.5s infinite' }} />
          <span className="cyber-glow-green" style={{ fontWeight: 'bold', fontSize: '18px', letterSpacing: '1px' }}>
            SHADOWNET_NODE
          </span>
          <span className="room-badge">
            ROOM: {roomName.toUpperCase()}
          </span>
        </div>

        <div className="dashboard-title-area">
          <div className="user-identity">
            <span style={{ color: 'var(--color-green-dim)' }}>OPERATOR:</span>
            <span className="cyber-glow-cyan">{nickname.toUpperCase()}</span>
            <span style={{ color: 'var(--color-green-dark)' }}>
              ({myPeerId ? myPeerId.slice(-6) : 'OFFLINE'})
            </span>
          </div>

          <button
            className={`hacker-btn ${soundMuted ? 'btn-red' : 'btn-cyan'}`}
            style={{ padding: '6px 10px', fontSize: '11px' }}
            onClick={onToggleSound}
            title={soundMuted ? 'Unmute Audio Feedback' : 'Mute Audio Feedback'}
          >
            {soundMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>

          <button
            className="hacker-btn btn-red"
            style={{ padding: '6px 12px', fontSize: '11px' }}
            onClick={onDisconnect}
          >
            <LogOut size={12} />
            DISCONNECT
          </button>
        </div>
      </header>

      {/* Main Split Interface */}
      <main className="dashboard-grid">
        {/* Left Column: Peers List and Voice/Video Calling Grid */}
        <section className="left-panel">
          {/* Peer Nodes Active list */}
          <div className="terminal-window" style={{ flex: '0 0 160px' }}>
            <div className="terminal-header">
              <div className="terminal-title">
                <span className="peer-status-dot"></span>
                <span>SIBLING_NODES ({peers.length})</span>
              </div>
            </div>
            <div className="terminal-content" style={{ padding: '4px' }}>
              <div className="peers-list">
                {peers.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '16px', color: 'var(--color-green-dim)', fontSize: '12px' }}>
                    AWAITING SIBLING HANDSHAKES...
                  </div>
                ) : (
                  peers.map((peer) => (
                    <div key={peer.peerId} className="peer-item">
                      <div className="peer-info">
                        <span className="peer-status-dot"></span>
                        <span className="cyber-glow-green" style={{ fontWeight: 'bold' }}>
                          {peer.nickname}
                        </span>
                      </div>
                      <span style={{ fontSize: '10px', color: 'var(--color-green-dark)' }}>
                        NODE_{peer.index}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Secure WebRTC Video Calling */}
          <MediaGrid
            localStream={localStream}
            peerStreams={peerStreams}
            peers={peers}
            isCallActive={isCallActive}
            isMuted={isMuted}
            isVideoOff={isVideoOff}
            onStartCall={startCall}
            onEndCall={endCall}
            onToggleMute={toggleMute}
            onToggleVideo={toggleVideo}
          />
        </section>

        {/* Center Column: Group Messaging Terminal */}
        <section className="center-panel">
          <ChatConsole
            messages={chatMessages}
            onSendMessage={sendChatMessage}
            myPeerId={myPeerId}
          />
        </section>

        {/* Right Column: File Transfer Manager and Diagnostic Telemetries */}
        <section className="right-panel">
          <FileShare
            transfers={fileTransfers}
            peers={peers}
            onSendFile={sendFile}
            onAcceptFile={acceptFile}
            onControlTransfer={controlFileTransfer}
          />

          <TerminalLogs logs={systemLogs} />
        </section>
      </main>

      {/* Cybernetic Incoming Call Alert Overlay */}
      {incomingCall && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(3, 7, 4, 0.9)',
          zIndex: 10000,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '20px'
        }}>
          <div className="terminal-window border-red" style={{ width: '100%', maxWidth: '420px', padding: '16px' }}>
            <div className="terminal-header" style={{ borderBottomColor: 'var(--color-red-dim)' }}>
              <div className="terminal-title cyber-glow-red">
                <ShieldAlert size={14} />
                <span>INCOMING_COM_LINK</span>
              </div>
            </div>
            
            <div className="terminal-content" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '20px', padding: '24px 12px' }}>
              <PhoneCall size={32} className="cyber-glow-red" style={{ alignSelf: 'center', animation: 'pulse-glow 1.2s infinite' }} />
              
              <div>
                <p style={{ fontSize: '13px', color: 'var(--color-red-glow)', textShadow: 'var(--text-shadow-red)', letterSpacing: '1px' }}>
                  WARNING: INCOMING VOICE/VIDEO FEED REQUESTED
                </p>
                <h3 className="cyber-glow-cyan" style={{ fontSize: '20px', marginTop: '10px' }}>
                  OPERATOR: {incomingCall.callerName.toUpperCase()}
                </h3>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  className="hacker-btn btn-green"
                  style={{ flex: 1, padding: '10px' }}
                  onClick={acceptCall}
                >
                  BIND CONNECTION
                </button>
                <button
                  className="hacker-btn btn-red"
                  style={{ flex: 1, padding: '10px' }}
                  onClick={declineCall}
                >
                  REFUSE FEED
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
