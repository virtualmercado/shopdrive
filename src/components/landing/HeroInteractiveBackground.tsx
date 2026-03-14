import { useEffect, useRef, useCallback, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

const PARTICLE_COUNT_DESKTOP = 35;
const PARTICLE_COUNT_MOBILE = 15;

interface Particle {
  x: number;
  y: number;
  size: number;
  opacity: number;
  speedX: number;
  speedY: number;
  hue: number; // 0 = white-ish, 1 = lilac
}

const HeroInteractiveBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef({ x: 0.5, y: 0.5, active: false });
  const glowRef = useRef({ x: 0.5, y: 0.5 });
  const animFrameRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const isMobile = useIsMobile();
  const [ready, setReady] = useState(false);

  // Autonomous glow phase for mobile
  const autoPhaseRef = useRef(0);

  const initParticles = useCallback((width: number, height: number) => {
    const count = isMobile ? PARTICLE_COUNT_MOBILE : PARTICLE_COUNT_DESKTOP;
    const particles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: 1 + Math.random() * 2,
        opacity: 0.15 + Math.random() * 0.35,
        speedX: (Math.random() - 0.5) * 0.3,
        speedY: -0.15 - Math.random() * 0.35,
        hue: Math.random() > 0.5 ? 1 : 0,
      });
    }
    particlesRef.current = particles;
  }, [isMobile]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    mouseRef.current = {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
      active: true,
    };
  }, []);

  const handleMouseLeave = useCallback(() => {
    mouseRef.current.active = false;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.scale(dpr, dpr);
      initParticles(rect.width, rect.height);
      setReady(true);
    };

    resize();
    window.addEventListener("resize", resize);

    if (!isMobile) {
      container.addEventListener("mousemove", handleMouseMove);
      container.addEventListener("mouseleave", handleMouseLeave);
    }

    const animate = () => {
      const rect = container.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      ctx.clearRect(0, 0, w, h);

      // --- Smooth glow position interpolation ---
      const targetX = mouseRef.current.active ? mouseRef.current.x : 0.5;
      const targetY = mouseRef.current.active ? mouseRef.current.y : 0.5;
      
      if (isMobile) {
        autoPhaseRef.current += 0.003;
        glowRef.current.x = 0.5 + Math.sin(autoPhaseRef.current) * 0.2;
        glowRef.current.y = 0.5 + Math.cos(autoPhaseRef.current * 0.7) * 0.15;
      } else {
        glowRef.current.x += (targetX - glowRef.current.x) * 0.04;
        glowRef.current.y += (targetY - glowRef.current.y) * 0.04;
      }

      // --- Layer 4: Mouse / auto glow ---
      const gx = glowRef.current.x * w;
      const gy = glowRef.current.y * h;
      const glowRadius = isMobile ? 200 : 300;
      const glowGradient = ctx.createRadialGradient(gx, gy, 0, gx, gy, glowRadius);
      const glowOpacity = isMobile ? 0.18 : (mouseRef.current.active ? 0.30 : 0.12);
      glowGradient.addColorStop(0, `rgba(255,255,255,${glowOpacity})`);
      glowGradient.addColorStop(0.4, `rgba(106,27,154,${glowOpacity * 0.4})`);
      glowGradient.addColorStop(1, "transparent");
      ctx.fillStyle = glowGradient;
      ctx.fillRect(0, 0, w, h);

      // --- Layer 3: Particles ---
      const particles = particlesRef.current;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.speedX;
        p.y += p.speedY;

        // Wrap around
        if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        if (p.hue === 0) {
          ctx.fillStyle = `rgba(255,255,255,${p.opacity})`;
        } else {
          ctx.fillStyle = `rgba(170,120,220,${p.opacity * 0.7})`;
        }
        ctx.fill();
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener("resize", resize);
      if (!isMobile) {
        container.removeEventListener("mousemove", handleMouseMove);
        container.removeEventListener("mouseleave", handleMouseLeave);
      }
    };
  }, [isMobile, initParticles, handleMouseMove, handleMouseLeave]);

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden" style={{ zIndex: 0 }}>
      {/* Layer 1: Static base gradient */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(circle at 30% 20%, rgba(106,27,154,0.04), transparent 40%),
            radial-gradient(circle at 70% 60%, rgba(251,140,0,0.03), transparent 45%),
            #FFFFFF
          `,
          zIndex: 1,
        }}
      />

      {/* Layer 2: Aurora / light fog */}
      <div className="absolute inset-0" style={{ zIndex: 2, pointerEvents: "none" }}>
        <div
          className="absolute"
          style={{
            width: "120%",
            height: "120%",
            top: "-10%",
            left: "-10%",
            background: `
              radial-gradient(ellipse 600px 400px at 25% 30%, rgba(106,27,154,0.12), transparent 70%),
              radial-gradient(ellipse 500px 350px at 65% 55%, rgba(170,120,220,0.10), transparent 65%),
              radial-gradient(ellipse 450px 300px at 80% 25%, rgba(251,140,0,0.08), transparent 60%)
            `,
            filter: "blur(60px)",
            animation: "auroraMove 30s ease-in-out infinite alternate",
          }}
        />
      </div>

      {/* Layer 3 & 4: Canvas (particles + glow) */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{
          zIndex: 3,
          pointerEvents: "none",
          opacity: ready ? 1 : 0,
          transition: "opacity 0.5s ease",
        }}
      />
    </div>
  );
};

export default HeroInteractiveBackground;
