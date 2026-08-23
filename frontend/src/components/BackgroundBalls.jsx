import { useEffect, useRef } from 'react';

export default function BackgroundBalls({ count = 2 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let balls = [];

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    const init = () => {
      balls = [];
      for (let i = 0; i < count; i++) {
        const radius = Math.random() * (120 - 80) + 80; 
        
        let x, y;
        let overlapping = true;
        
        // Find non-overlapping position
        while (overlapping) {
          x = Math.random() * (canvas.width - radius * 2) + radius;
          y = Math.random() * (canvas.height - radius * 2) + radius;
          overlapping = false;
          
          for (let j = 0; j < balls.length; j++) {
            const dx = x - balls[j].x;
            const dy = y - balls[j].y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < radius + balls[j].radius) {
              overlapping = true;
              break;
            }
          }
        }
        
        // Random velocities between -2 and 2
        const vx = (Math.random() - 0.5) * 4;
        const vy = (Math.random() - 0.5) * 4;
        
        const color = i % 2 === 0 ? 'rgba(79, 70, 229, 0.6)' : 'rgba(124, 58, 237, 0.6)';

        balls.push({ x, y, vx, vy, radius, color });
      }
    };

    init();

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      for (let i = 0; i < balls.length; i++) {
        const ball = balls[i];
        
        ball.x += ball.vx;
        ball.y += ball.vy;

        // Wall collisions
        if (ball.x - ball.radius < 0 || ball.x + ball.radius > canvas.width) ball.vx *= -1;
        if (ball.y - ball.radius < 0 || ball.y + ball.radius > canvas.height) ball.vy *= -1;

        // Circle collisions
        for (let j = i + 1; j < balls.length; j++) {
            const ball2 = balls[j];
            const dx = ball2.x - ball.x;
            const dy = ball2.y - ball.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const minDist = ball.radius + ball2.radius;

            if (distance < minDist) {
                // Swap velocities (Simple elastic collision for equal mass)
                const tempVx = ball.vx;
                const tempVy = ball.vy;
                ball.vx = ball2.vx;
                ball.vy = ball2.vy;
                ball2.vx = tempVx;
                ball2.vy = tempVy;

                // Separate them immediately so they don't get stuck glued together
                const overlap = minDist - distance;
                const nx = dx / distance;
                const ny = dy / distance;
                ball.x -= (nx * overlap) / 2;
                ball.y -= (ny * overlap) / 2;
                ball2.x += (nx * overlap) / 2;
                ball2.y += (ny * overlap) / 2;
            }
        }
        
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2, false);
        ctx.fillStyle = ball.color;
        ctx.fill();
        ctx.closePath();
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, [count]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full -z-10 pointer-events-none"
    />
  );
}
