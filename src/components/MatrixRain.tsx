import React, { useEffect, useRef } from 'react';

export const MatrixRain: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resize handler
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Characters definition
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾏｹﾒｴｶｷﾑﾕﾗｾﾈｽﾀﾇﾍ';
    const charArr = chars.split('');
    
    const fontSize = 14;
    const columns = Math.floor(canvas.width / fontSize) + 1;
    const drops: number[] = Array(columns).fill(1);

    let animationId: number;

    const draw = () => {
      ctx.fillStyle = 'rgba(3, 7, 4, 0.08)'; // Semi-transparent black background to draw trail
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#00ff66';
      ctx.font = `${fontSize}px 'Share Tech Mono', monospace`;

      for (let i = 0; i < drops.length; i++) {
        // Random character
        const char = charArr[Math.floor(Math.random() * charArr.length)];
        const x = i * fontSize;
        const y = drops[i] * fontSize;

        // Draw character
        ctx.fillText(char, x, y);

        // Reset drops if they reach end of screen or randomly
        if (y > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }

        // Increment drop y coordinate
        drops[i]++;
      }

      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  return <canvas ref={canvasRef} className="matrix-canvas" />;
};
