// Web Audio API Synthesizer for Retro-Futuristic Hacker Console Sound Effects

let audioCtx: AudioContext | null = null;
let isMuted = false;

function getAudioContext(): AudioContext | null {
  if (isMuted) return null;
  if (!audioCtx) {
    // Lazy initialize to bypass browser autoplay policies
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export const soundManager = {
  toggleMute: () => {
    isMuted = !isMuted;
    if (isMuted && audioCtx) {
      audioCtx.close();
      audioCtx = null;
    }
    return isMuted;
  },
  
  getMuteState: () => isMuted,

  playClick: () => {
    const ctx = getAudioContext();
    if (!ctx) return;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1000, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1500, ctx.currentTime + 0.05);
    
    gain.gain.setValueAtTime(0.02, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.05);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  },

  playBeep: () => {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(800, ctx.currentTime);

    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  },

  playAlert: () => {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, ctx.currentTime);
    osc.frequency.setValueAtTime(120, ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.setValueAtTime(0.06, ctx.currentTime + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  },

  playSuccess: () => {
    const ctx = getAudioContext();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 arpeggio
    const time = ctx.currentTime;
    
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time + idx * 0.075);
      
      gain.gain.setValueAtTime(0.03, time + idx * 0.075);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + idx * 0.075 + 0.15);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(time + idx * 0.075);
      osc.stop(time + idx * 0.075 + 0.15);
    });
  },

  playRingtone: () => {
    const ctx = getAudioContext();
    if (!ctx) return () => {};

    let osc1: OscillatorNode | null = null;
    let osc2: OscillatorNode | null = null;
    let gain: GainNode | null = null;
    let intervalId: any = null;

    const startRing = () => {
      const currentCtx = getAudioContext();
      if (!currentCtx) return;
      
      osc1 = currentCtx.createOscillator();
      osc2 = currentCtx.createOscillator();
      gain = currentCtx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(440, currentCtx.currentTime); // A4
      
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(480, currentCtx.currentTime); // slightly detuned ring
      
      gain.gain.setValueAtTime(0, currentCtx.currentTime);
      
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(currentCtx.destination);

      osc1.start();
      osc2.start();

      let active = false;
      intervalId = setInterval(() => {
        const cCtx = getAudioContext();
        if (!cCtx || !gain) return;
        
        if (active) {
          gain.gain.exponentialRampToValueAtTime(0.0001, cCtx.currentTime + 0.2);
        } else {
          gain.gain.linearRampToValueAtTime(0.05, cCtx.currentTime + 0.1);
        }
        active = !active;
      }, 500);
    };

    startRing();

    return () => {
      if (intervalId) clearInterval(intervalId);
      try {
        if (osc1) osc1.stop();
        if (osc2) osc2.stop();
        if (gain) gain.disconnect();
      } catch (e) {
        // Safe catch if already stopped
      }
    };
  }
};
