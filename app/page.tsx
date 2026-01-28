'use client';

import { useRef, useEffect, useState } from 'react';

export default function DrawingLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(5);
  const [brushColor, setBrushColor] = useState('#000000');
  const [tool, setTool] = useState<'brush' | 'eraser'>('brush');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 캔버스 크기 설정
    canvas.width = 800;
    canvas.height = 600;

    // 배경 흰색으로
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    draw(e);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx) {
      ctx.beginPath();
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing && e.type !== 'mousedown') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : brushColor;

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const saveImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = 'drawing.png';
    link.href = canvas.toDataURL();
    link.click();
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-center">
          🎨 AI Drawing Lab
        </h1>

        {/* 컨트롤 패널 */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            {/* 도구 선택 */}
            <div className="flex gap-2">
              <button
                onClick={() => setTool('brush')}
                className={`px-4 py-2 rounded ${
                  tool === 'brush'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200'
                }`}
              >
                ✏️ 브러시
              </button>
              <button
                onClick={() => setTool('eraser')}
                className={`px-4 py-2 rounded ${
                  tool === 'eraser'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200'
                }`}
              >
                🧹 지우개
              </button>
            </div>

            {/* 브러시 크기 */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">크기:</label>
              <input
                type="range"
                min="1"
                max="50"
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="w-32"
              />
              <span className="text-sm w-8">{brushSize}</span>
            </div>

            {/* 색상 선택 */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">색상:</label>
              <input
                type="color"
                value={brushColor}
                onChange={(e) => setBrushColor(e.target.value)}
                className="w-12 h-10 rounded cursor-pointer"
              />
            </div>

            {/* 버튼들 */}
            <button
              onClick={clearCanvas}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
              🗑️ 전체 지우기
            </button>

            <button
              onClick={saveImage}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              💾 저장
            </button>
          </div>
        </div>

        {/* 캔버스 */}
        <div className="bg-white rounded-lg shadow-lg p-4">
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            className="border border-gray-300 rounded cursor-crosshair mx-auto block"
          />
        </div>
      </div>
    </div>
  );
}
