import React, { useEffect, useRef } from 'react';
import { Terminal } from 'lucide-react';
import type { SystemLog } from '../hooks/useP2P';

interface TerminalLogsProps {
  logs: SystemLog[];
}

export const TerminalLogs: React.FC<TerminalLogsProps> = ({ logs }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="terminal-window" style={{ flex: 1, minHeight: '180px' }}>
      <div className="terminal-header">
        <div className="terminal-title">
          <Terminal size={14} />
          <span>DIAGNOSTIC_TELEMETRY</span>
        </div>
        <div className="terminal-actions">
          <span className="terminal-dot active"></span>
        </div>
      </div>
      <div ref={containerRef} className="terminal-content" style={{ background: '#020503' }}>
        <div className="diag-log-container">
          {logs.length === 0 ? (
            <div className="diag-log-item info">
              <span className="timestamp">[{new Date().toLocaleTimeString()}]</span>
              <span>SYSTEM: Standing by...</span>
            </div>
          ) : (
            logs.map((log, index) => (
              <div key={index} className={`diag-log-item ${log.type}`}>
                <span className="timestamp">[{log.timestamp}]</span>
                <span>{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
