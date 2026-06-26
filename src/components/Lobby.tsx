import React, { useState } from 'react';
import { Shield, Terminal, User, Wifi } from 'lucide-react';
import { soundManager } from '../utils/sounds';

interface LobbyProps {
  onJoin: (nickname: string, roomName: string, roomPass: string) => void;
}

export const Lobby: React.FC<LobbyProps> = ({ onJoin }) => {
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
  const [nickname, setNickname] = useState('');
  const [roomName, setRoomName] = useState('');
  const [roomPass, setRoomPass] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim() || !roomName.trim() || !roomPass.trim()) return;
    
    soundManager.playBeep();
    onJoin(nickname.trim(), roomName.trim(), roomPass.trim());
  };

  const handleTabChange = (tab: 'create' | 'join') => {
    soundManager.playClick();
    setActiveTab(tab);
  };

  return (
    <div className="lobby-wrapper">
      <div className="terminal-window lobby-box">
        <div className="terminal-header">
          <div className="terminal-title">
            <Terminal size={14} className="cyber-glow-green" />
            <span>SHADOWNET_GATEWAY_v1.0.8</span>
          </div>
          <div className="terminal-actions">
            <span className="terminal-dot active"></span>
          </div>
        </div>

        <div className="terminal-content">
          <div className="lobby-logo">
            <h1 className="cyber-glow-green">SHADOWNET</h1>
            <p className="cyber-glow-cyan" style={{ fontSize: '11px', letterSpacing: '2px', marginTop: '4px' }}>
              SECURE DECENTRALIZED WORKSPACE
            </p>
          </div>

          <div className="lobby-tabs">
            <button
              type="button"
              className={`lobby-tab ${activeTab === 'create' ? 'active' : ''}`}
              onClick={() => handleTabChange('create')}
            >
              [ Create Terminal ]
            </button>
            <button
              type="button"
              className={`lobby-tab ${activeTab === 'join' ? 'active' : ''}`}
              onClick={() => handleTabChange('join')}
            >
              [ Join Terminal ]
            </button>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="hacker-input-group">
              <label>
                <User size={12} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                Operator Handle (Nickname)
              </label>
              <input
                type="text"
                className="hacker-input"
                placeholder="e.g. Neo"
                value={nickname}
                onChange={(e) => {
                  soundManager.playClick();
                  setNickname(e.target.value);
                }}
                required
                maxLength={14}
              />
            </div>

            <div className="hacker-input-group">
              <label>
                <Wifi size={12} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                {activeTab === 'create' ? 'Room Name / Namespace' : 'Room ID / Target ID'}
              </label>
              <input
                type="text"
                className="hacker-input"
                placeholder={activeTab === 'create' ? 'e.g. zion-base' : 'Enter Room ID'}
                value={roomName}
                onChange={(e) => {
                  soundManager.playClick();
                  setRoomName(e.target.value);
                }}
                required
              />
            </div>

            <div className="hacker-input-group">
              <label>
                <Shield size={12} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                Encryption Keyphrase
              </label>
              <input
                type="password"
                className="hacker-input"
                placeholder="••••••••••••"
                value={roomPass}
                onChange={(e) => {
                  soundManager.playClick();
                  setRoomPass(e.target.value);
                }}
                required
              />
            </div>

            <button
              type="submit"
              className={`hacker-btn ${activeTab === 'create' ? 'btn-green' : 'btn-cyan'}`}
              style={{ marginTop: '8px', padding: '12px' }}
            >
              {activeTab === 'create' ? 'INITIALIZE CORE' : 'ESTABLISH LINK'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
