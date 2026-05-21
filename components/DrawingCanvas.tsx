"use client";

import { useRef, useState, useEffect } from "react";

const COLORS = ["#1a1a14", "#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6", "#ffffff"];
const WIDTHS = [2, 5, 10, 18];

interface Point { x: number; y: number; }

export default function DrawingCanvas({
  onSave, onCancel,
}: {
  onSave: (blob: Blob) => void;
  onCancel: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState(COLORS[0]);
  const [strokeWidth, setStrokeWidth] = useState(WIDTHS[1]);
  const [eraser, setEraser] = useState(false);
  const drawing = useRef(false);
  const lastPoint = useRef<Point | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  function getPos(e: React.MouseEvent | React.TouchEvent): Point {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    drawing.current = true;
    const pos = getPos(e);
    lastPoint.current = pos;
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, (eraser ? strokeWidth * 2 : strokeWidth) / 2, 0, Math.PI * 2);
    ctx.fillStyle = eraser ? "white" : color;
    ctx.fill();
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    if (!drawing.current || !lastPoint.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = eraser ? "white" : color;
    ctx.lineWidth = eraser ? strokeWidth * 2.5 : strokeWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    lastPoint.current = pos;
  }

  function stopDraw() {
    drawing.current = false;
    lastPoint.current = null;
  }

  function clearCanvas() {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function save() {
    canvasRef.current!.toBlob(blob => { if (blob) onSave(blob); }, "image/png");
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <div className="flex gap-1.5 items-center">
          {COLORS.map(c => (
            <button
              key={c}
              onClick={() => { setColor(c); setEraser(false); }}
              className="w-6 h-6 rounded-full transition-all flex-shrink-0"
              style={{
                background: c,
                border: color === c && !eraser ? "2.5px solid var(--ink)" : "1.5px solid var(--border-strong)",
                boxShadow: color === c && !eraser ? "0 0 0 1.5px white inset" : "none",
              }}
            />
          ))}
        </div>

        <div className="flex gap-1 items-center">
          {WIDTHS.map(w => (
            <button
              key={w}
              onClick={() => { setStrokeWidth(w); setEraser(false); }}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
              style={{ background: strokeWidth === w && !eraser ? "var(--bg-2)" : "transparent" }}
            >
              <div className="rounded-full bg-[var(--ink)]" style={{ width: Math.min(w * 2, 20), height: Math.min(w * 2, 20) }} />
            </button>
          ))}
        </div>

        <button
          onClick={() => setEraser(v => !v)}
          className="px-2.5 py-1 rounded-lg font-mono text-[11px] uppercase tracking-[0.12em] transition-colors"
          style={{ background: eraser ? "var(--ink)" : "var(--bg-2)", color: eraser ? "var(--bg)" : "var(--muted)" }}
        >
          Eraser
        </button>

        <button
          onClick={clearCanvas}
          className="px-2.5 py-1 rounded-lg font-mono text-[11px] uppercase tracking-[0.12em]"
          style={{ color: "var(--muted)" }}
        >
          Clear
        </button>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={800}
        height={480}
        className="w-full rounded-xl touch-none select-none"
        style={{
          border: "1.5px solid var(--border-strong)",
          cursor: eraser ? "cell" : "crosshair",
        }}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={stopDraw}
        onMouseLeave={stopDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={stopDraw}
      />

      <div className="mt-3 flex gap-2">
        <button
          onClick={save}
          className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-xl text-white"
          style={{ background: "var(--ink)" }}
        >
          Save drawing
        </button>
        <button
          onClick={onCancel}
          className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium"
          style={{ color: "var(--muted)" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
