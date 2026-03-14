import { useEffect, useRef, useCallback, useState, type RefObject } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

const PARTICLE_COUNT_DESKTOP = 35;
const PARTICLE_COUNT_MOBILE = 15;
const LERP_FACTOR = 0.15;
const SPEED_SMOOTH = 0.12;
const TURBULENCE_SPEED = 0.0025;

interface Particle {
  x: number;
  y: number;
  size: number;
  opacity: number;
  speedX: number;
  speedY: number;
  hue: number;
}

interface HeroInteractiveBackgroundProps {
  trackingRef?: RefObject<HTMLElement | null>;
}

const HeroInteractiveBackground = ({ trackingRef }: HeroInteractiveBackgroundProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef({ x: 0, y: 0, active: false });
  const glowRef = useRef({ x: 0, y: 0 });
  const prevGlowRef = useRef({ x: 0, y: 0 });
  const angleRef = useRef(0);
  const speedRef = useRef(0);
  const animFrameRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const isMobile = useIsMobile();
  const [ready, setReady] = useState(false);
  const autoPhaseRef = useRef(0);
  const turbPhaseRef = useRef(0);

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
    const trackingElement = trackingRef?.current ?? containerRef.current;
    if (!trackingElement) return;
    const rect = trackingElement.getBoundingClientRect();
    mouseRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      active: true,
    };
  }, [trackingRef]);

  const handleMouseLeave = useCallback(() => {
    mouseRef.current.active = false;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const trackingElement = trackingRef?.current ?? container;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      initParticles(rect.width, rect.height);
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      glowRef.current = { x: cx, y: cy };
      prevGlowRef.current = { x: cx, y: cy };
      mouseRef.current.x = cx;
      mouseRef.current.y = cy;
      setReady(true);
    };

    resize();
    window.addEventListener("resize", resize);

    if (!isMobile) {
      trackingElement.addEventListener("mousemove", handleMouseMove);
      trackingElement.addEventListener("mouseleave", handleMouseLeave);
    }

    const animate = () => {
      const rect = container.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      ctx.clearRect(0, 0, w, h);

      // Save previous position for direction calculation
      prevGlowRef.current.x = glowRef.current.x;
      prevGlowRef.current.y = glowRef.current.y;

      if (isMobile) {
        autoPhaseRef.current += 0.003;
        glowRef.current.x = w * (0.5 + Math.sin(autoPhaseRef.current) * 0.2);
        glowRef.current.y = h * (0.5 + Math.cos(autoPhaseRef.current * 0.7) * 0.15);
      } else {
        const targetX = mouseRef.current.active ? mouseRef.current.x : w / 2;
        const targetY = mouseRef.current.active ? mouseRef.current.y : h / 2;
        glowRef.current.x += (targetX - glowRef.current.x) * LERP_FACTOR;
        glowRef.current.y += (targetY - glowRef.current.y) * LERP_FACTOR;
      }

      const gx = glowRef.current.x;
      const gy = glowRef.current.y;

      // Movement direction & speed
      const dx = gx - prevGlowRef.current.x;
      const dy = gy - prevGlowRef.current.y;
      const currentSpeed = Math.sqrt(dx * dx + dy * dy);
      speedRef.current += (currentSpeed - speedRef.current) * SPEED_SMOOTH;
      const spd = speedRef.current;

      if (currentSpeed > 0.3) {
        const targetAngle = Math.atan2(dy, dx);
        let angleDiff = targetAngle - angleRef.current;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        angleRef.current += angleDiff * 0.15;
      }

      const angle = angleRef.current;

      // Velocity-reactive tail length & opacity (Improvement 2)
      const tailLength = Math.min(420, Math.max(200, spd * 8));
      const tailOpacity = Math.min(0.6, Math.max(0.2, spd * 0.015));
      const tailWidth = 140;

      // Turbulence phase (Improvement 1)
      turbPhaseRef.current += TURBULENCE_SPEED;
      const turbT = turbPhaseRef.current;
      const turbScaleY = 1 + Math.sin(turbT * 2.5) * 0.08;
      const turbSkew = Math.sin(turbT * 1.7) * 1.5;

      // --- Comet tail with turbulence ---
      if (!isMobile && mouseRef.current.active && spd > 0.2) {
        ctx.save();
        ctx.translate(gx, gy);
        ctx.rotate(angle + Math.PI);

        // Apply turbulence: skew + scaleY
        ctx.transform(1, Math.sin(turbSkew * Math.PI / 180), 0, turbScaleY, 0, 0);

        const tailGrad = ctx.createLinearGradient(0, 0, tailLength, 0);
        tailGrad.addColorStop(0, `rgba(106,27,154,${tailOpacity})`);
        tailGrad.addColorStop(0.3, `rgba(106,27,154,${tailOpacity * 0.4})`);
        tailGrad.addColorStop(0.6, `rgba(106,27,154,${tailOpacity * 0.18})`);
        tailGrad.addColorStop(1, `rgba(106,27,154,0)`);

        ctx.filter = "blur(40px)";
        ctx.globalAlpha = 0.85 + Math.sin(turbT * 3.1) * 0.15;
        ctx.fillStyle = tailGrad;
        ctx.beginPath();
        ctx.ellipse(tailLength / 2, 0, tailLength / 2, tailWidth / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.filter = "none";
        ctx.restore();
      }

      // --- Comet core ---
      const coreRadius = 80;
      const coreGrad = ctx.createRadialGradient(gx, gy, 0, gx, gy, coreRadius);
      const coreOpacity = isMobile ? 0.18 : (mouseRef.current.active ? 0.8 : 0.15);
      coreGrad.addColorStop(0, `rgba(255,255,255,${coreOpacity})`);
      coreGrad.addColorStop(0.3, `rgba(255,255,255,${coreOpacity * 0.5})`);
      coreGrad.addColorStop(0.55, `rgba(106,27,154,${coreOpacity * 0.3})`);
      coreGrad.addColorStop(0.7, `rgba(106,27,154,${coreOpacity * 0.1})`);
      coreGrad.addColorStop(1, `rgba(106,27,154,0)`);

      ctx.save();
      ctx.filter = "blur(18px)";
      ctx.fillStyle = coreGrad;
      ctx.fillRect(gx - coreRadius * 2, gy - coreRadius * 2, coreRadius * 4, coreRadius * 4);
      ctx.filter = "none";
      ctx.restore();

      // --- Velocity-reactive aura (Improvement 3) ---
      if (!isMobile && mouseRef.current.active) {
        const auraScale = Math.min(1.6, 1 + spd * 0.02);
        const auraOp = Math.min(0.7, Math.max(0.2, spd * 0.02));
        const auraR = 110 * auraScale;
        const auraGrad = ctx.createRadialGradient(gx, gy, 0, gx, gy, auraR);
        auraGrad.addColorStop(0, `rgba(106,27,154,${auraOp * 0.35})`);
        auraGrad.addColorStop(0.35, `rgba(106,27,154,${auraOp * 0.18})`);
        auraGrad.addColorStop(0.55, `rgba(106,27,154,${auraOp * 0.08})`);
        auraGrad.addColorStop(1, `rgba(106,27,154,0)`);

        ctx.save();
        ctx.filter = "blur(40px)";
        ctx.fillStyle = auraGrad;
        ctx.fillRect(gx - auraR, gy - auraR, auraR * 2, auraR * 2);
        ctx.filter = "none";
        ctx.restore();
      }

      // --- Ambient purple glow ---
      const ambientGrad = ctx.createRadialGradient(gx, gy, 0, gx, gy, 300);
      const ambientOp = mouseRef.current.active ? 0.12 : 0.06;
      ambientGrad.addColorStop(0, `rgba(106,27,154,${ambientOp})`);
      ambientGrad.addColorStop(1, "transparent");
      ctx.fillStyle = ambientGrad;
      ctx.fillRect(0, 0, w, h);

      // --- Particles ---
      const particles = particlesRef.current;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.speedX;
        p.y += p.speedY;
        if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.hue === 0
          ? `rgba(255,255,255,${p.opacity})`
          : `rgba(170,120,220,${p.opacity * 0.7})`;
        ctx.fill();
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener("resize", resize);
      if (!isMobile) {
        trackingElement.removeEventListener("mousemove", handleMouseMove);
        trackingElement.removeEventListener("mouseleave", handleMouseLeave);
      }
    };
  }, [isMobile, initParticles, handleMouseMove, handleMouseLeave, trackingRef]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{ zIndex: 0, pointerEvents: "none" }}
    >
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
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{
          zIndex: 6,
          pointerEvents: "none",
          opacity: ready ? 1 : 0,
          transition: "opacity 0.5s ease",
        }}
      />
    </div>
  );
};

export default HeroInteractiveBackground;
