import React, { useEffect, useRef } from 'react';

export const InteractiveDotBackground = ({ isDark = true }: { isDark?: boolean }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let mouse = { x: -1000, y: -1000, targetX: -1000, targetY: -1000 };
    
    const easing = 0.15;
    const connectionDistance = 150;
    const mouseConnectionDistance = 250;

    let particles: { x: number, y: number, vx: number, vy: number, radius: number }[] = [];

    const initParticles = () => {
      particles = [];
      const numParticles = Math.min(35, Math.max(15, Math.floor((canvas.width * canvas.height) / 45000)));
      for (let i = 0; i < numParticles; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 1.0,
          vy: (Math.random() - 0.5) * 1.0,
          radius: Math.random() * 1.5 + 0.5,
        });
      }
    };

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initParticles();
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouse.targetX = e.clientX;
      mouse.targetY = e.clientY;
    };
    
    const handleMouseLeave = () => {
      mouse.targetX = -1000;
      mouse.targetY = -1000;
    };

    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mouseleave', handleMouseLeave, { passive: true });
    
    resize();
    mouse.x = -1000;
    mouse.y = -1000;

    const connectionDistanceSq = connectionDistance * connectionDistance;
    const mouseConnectionDistanceSq = mouseConnectionDistance * mouseConnectionDistance;

    const draw = () => {
      if (document.hidden) {
        animationFrameId = requestAnimationFrame(draw);
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      mouse.x += (mouse.targetX - mouse.x) * easing;
      mouse.y += (mouse.targetY - mouse.y) * easing;

      const colorRGB = isDark ? '255, 255, 255' : '99, 102, 241';
      const dotOpacity = isDark ? 0.6 : 0.8;
      const lineOpacity = isDark ? 0.2 : 0.25;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${colorRGB}, ${dotOpacity})`;
        ctx.fill();

        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const distToMouseSq = dx * dx + dy * dy;
        
        if (distToMouseSq < mouseConnectionDistanceSq) {
          const distToMouse = Math.sqrt(distToMouseSq);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(mouse.x, mouse.y);
          const opacity = lineOpacity * (1 - distToMouse / mouseConnectionDistance);
          ctx.strokeStyle = `rgba(${colorRGB}, ${opacity * 1.5})`;
          ctx.lineWidth = 1;
          ctx.stroke();

          p.x -= dx * 0.015;
          p.y -= dy * 0.015;
        }

        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx2 = p.x - p2.x;
          const dy2 = p.y - p2.y;
          const dist2Sq = dx2 * dx2 + dy2 * dy2;

          if (dist2Sq < connectionDistanceSq) {
            const dist2 = Math.sqrt(dist2Sq);
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            const opacity = lineOpacity * (1 - dist2 / connectionDistance);
            ctx.strokeStyle = `rgba(${colorRGB}, ${opacity})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      cancelAnimationFrame(animationFrameId);
    };
  }, [isDark]);

  return (
    <div className={`absolute inset-0 pointer-events-none overflow-hidden select-none z-0`}>
      <div className={`absolute inset-0 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}></div>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full opacity-100"
      />
    </div>
  );
};
