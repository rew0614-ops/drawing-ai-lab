'use client';

import { useRef, useEffect, useState } from 'react';

type BrushType = 
  | 'pen' 
  | 'pencil' 
  | 'marker' 
  | 'airbrush' 
  | 'watercolor' 
  | 'spray'
  | 'calligraphy'
  | 'square'
  | 'eraser';

interface Layer {
  id: string;
  name: string;
  canvas: HTMLCanvasElement;
  visible: boolean;
  opacity: number;
}

interface HistoryState {
  layersData: {
    id: string;
    name: string;
    dataUrl: string;
    visible: boolean;
    opacity: number;
  }[];
}

export default function DrawingLab() {
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const layerPanelRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(5);
  const [brushColor, setBrushColor] = useState('#000000');
  const [brushType, setBrushType] = useState<BrushType>('pen');
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyStep, setHistoryStep] = useState(-1);
  
  // 레이어 관련
  const [layers, setLayers] = useState<Layer[]>([]);
  const [currentLayerId, setCurrentLayerId] = useState<string>('');
  const [showLayerPanel, setShowLayerPanel] = useState(false);
  const [draggedLayerId, setDraggedLayerId] = useState<string | null>(null);
  
  // 이전 좌표 저장 (부드러운 선을 위해)
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  
  // 압력 감지
  const [pressure, setPressure] = useState(0.5);
  
  // 텍스처 캔버스 (한 번만 생성)
  const textureCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // 텍스처 생성 (노이즈 패턴)
  const createTexture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    const imageData = ctx.createImageData(100, 100);
    for (let i = 0; i < imageData.data.length; i += 4) {
      const value = Math.random() * 255;
      imageData.data[i] = value;
      imageData.data[i + 1] = value;
      imageData.data[i + 2] = value;
      imageData.data[i + 3] = Math.random() * 255;
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas;
  };

  // 초기화 및 첫 레이어 생성
  useEffect(() => {
    const canvas = mainCanvasRef.current;
    if (!canvas) return;

    // 캔버스 크기를 화면에 맞게 설정
    const maxWidth = window.innerWidth - 100;
    const maxHeight = window.innerHeight - 80;
    
    canvas.width = Math.min(maxWidth, 1920);
    canvas.height = Math.min(maxHeight, 1080);

    // 텍스처 생성
    textureCanvasRef.current = createTexture();

    // 첫 번째 레이어 생성
    if (layers.length === 0) {
      createLayer('레이어 1');
    }
  }, []);

  // 키보드 단축키 (Ctrl+Z, Ctrl+Shift+Z)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'Z') {
        e.preventDefault();
        redo();
      } else if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        undo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyStep, history]);

  // 레이어 패널 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        showLayerPanel &&
        layerPanelRef.current &&
        !layerPanelRef.current.contains(e.target as Node)
      ) {
        const target = e.target as HTMLElement;
        // 레이어 버튼 클릭은 제외
        if (!target.closest('[data-layer-toggle]')) {
          setShowLayerPanel(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showLayerPanel]);

  // 레이어 생성
  const createLayer = (name: string) => {
    const canvas = mainCanvasRef.current;
    if (!canvas) return;

    const newCanvas = document.createElement('canvas');
    newCanvas.width = canvas.width;
    newCanvas.height = canvas.height;
    
    const ctx = newCanvas.getContext('2d');
    if (ctx) {
      // 첫 번째 레이어만 흰색 배경, 나머지는 투명
      if (layers.length === 0) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, newCanvas.width, newCanvas.height);
      }
    }

    const newLayer: Layer = {
      id: Date.now().toString(),
      name,
      canvas: newCanvas,
      visible: true,
      opacity: 1,
    };

    setLayers(prev => [...prev, newLayer]);
    setCurrentLayerId(newLayer.id);
    saveToHistory();
  };

  // 레이어 합성 및 메인 캔버스에 렌더링
  useEffect(() => {
    const canvas = mainCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 모든 레이어를 순서대로 그리기
    layers.forEach(layer => {
      if (layer.visible) {
        ctx.globalAlpha = layer.opacity;
        ctx.drawImage(layer.canvas, 0, 0);
      }
    });
    
    ctx.globalAlpha = 1;
  }, [layers]);

  const saveToHistory = () => {
    if (layers.length === 0) return;

    const historyState: HistoryState = {
      layersData: layers.map(layer => ({
        id: layer.id,
        name: layer.name,
        dataUrl: layer.canvas.toDataURL(),
        visible: layer.visible,
        opacity: layer.opacity,
      })),
    };

    setHistory(prev => {
      const newHistory = prev.slice(0, historyStep + 1);
      newHistory.push(historyState);
      return newHistory;
    });
    setHistoryStep(prev => prev + 1);
  };

  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = mainCanvasRef.current;
    if (!canvas) return { x: 0, y: 0, pressure: 0.5 };

    const rect = canvas.getBoundingClientRect();
    let x = 0, y = 0, pressure = 0.5;
    
    // 터치 이벤트인 경우
    if ('touches' in e) {
      if (e.touches.length > 0) {
        const touch = e.touches[0] as any;
        x = touch.clientX - rect.left;
        y = touch.clientY - rect.top;
        // 터치 압력 (일부 기기만 지원)
        pressure = touch.force || touch.webkitForce || 0.5;
      } else if (e.changedTouches.length > 0) {
        const touch = e.changedTouches[0] as any;
        x = touch.clientX - rect.left;
        y = touch.clientY - rect.top;
        pressure = touch.force || touch.webkitForce || 0.5;
      }
    } else {
      // 마우스 이벤트인 경우
      const mouseEvent = e as any;
      x = mouseEvent.clientX - rect.left;
      y = mouseEvent.clientY - rect.top;
      // 포인터 압력 (펜 태블릿)
      pressure = mouseEvent.pressure || 0.5;
    }
    
    return { x, y, pressure };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault(); // 터치 스크롤 방지
    setIsDrawing(true);
    
    const { x, y, pressure } = getCoordinates(e);
    setPressure(pressure);
    lastPointRef.current = { x, y };
    
    // 시작점에 점 찍기
    const currentLayer = layers.find(l => l.id === currentLayerId);
    if (!currentLayer) return;
    
    const ctx = currentLayer.canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    lastPointRef.current = null;
    
    const currentLayer = layers.find(l => l.id === currentLayerId);
    if (currentLayer) {
      const ctx = currentLayer.canvas.getContext('2d');
      if (ctx) {
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    
    // 그리기가 끝나면 히스토리에 저장
    saveToHistory();
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const currentLayer = layers.find(l => l.id === currentLayerId);
    if (!currentLayer) return;

    const ctx = currentLayer.canvas.getContext('2d');
    if (!ctx) return;

    const { x, y, pressure: newPressure } = getCoordinates(e);
    setPressure(newPressure);
    
    if (!lastPointRef.current) {
      lastPointRef.current = { x, y };
      return;
    }

    // 거리 계산
    const dx = x - lastPointRef.current.x;
    const dy = y - lastPointRef.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // 빠르게 움직일 때 중간 점들 보간
    if (distance > 2) {
      const steps = Math.ceil(distance / 2);
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const interpX = lastPointRef.current.x + dx * t;
        const interpY = lastPointRef.current.y + dy * t;
        
        // 브러시 타입에 따른 그리기
        drawBrush(ctx, interpX, interpY, newPressure);
      }
    } else {
      drawBrush(ctx, x, y, newPressure);
    }
    
    lastPointRef.current = { x, y };

    // 레이어 업데이트 트리거
    setLayers([...layers]);
  };

  // 브러시 타입에 따라 그리기
  const drawBrush = (ctx: CanvasRenderingContext2D, x: number, y: number, pressure: number) => {
    switch (brushType) {
      case 'pen':
        drawPen(ctx, x, y, pressure);
        break;
      case 'pencil':
        drawPencil(ctx, x, y, pressure);
        break;
      case 'marker':
        drawMarker(ctx, x, y);
        break;
      case 'airbrush':
        drawAirbrush(ctx, x, y);
        break;
      case 'watercolor':
        drawWatercolor(ctx, x, y, pressure);
        break;
      case 'spray':
        drawSpray(ctx, x, y);
        break;
      case 'calligraphy':
        drawCalligraphy(ctx, x, y, pressure);
        break;
      case 'square':
        drawSquare(ctx, x, y);
        break;
      case 'eraser':
        drawEraser(ctx, x, y);
        break;
    }
  };

  // 각 브러시 타입별 그리기 함수들
  const drawPen = (ctx: CanvasRenderingContext2D, x: number, y: number, pressure: number) => {
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = brushSize * (0.6 + pressure * 0.4);
    ctx.strokeStyle = brushColor;
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    // 부드러운 원 그리기
    ctx.beginPath();
    ctx.arc(x, y, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = brushColor;
  };

  const drawPencil = (ctx: CanvasRenderingContext2D, x: number, y: number, pressure: number) => {
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const size = brushSize * 0.7 * (0.5 + pressure * 0.5);
    ctx.strokeStyle = brushColor;
    ctx.shadowBlur = 0;

    // 연필 질감 - 더 자연스럽게
    const density = 5;
    for (let i = 0; i < density; i++) {
      const angle = (Math.PI * 2 * i) / density + Math.random() * 0.5;
      const distance = Math.random() * size * 0.3;
      const offsetX = Math.cos(angle) * distance;
      const offsetY = Math.sin(angle) * distance;
      
      ctx.globalAlpha = 0.15 + Math.random() * 0.15;
      ctx.lineWidth = size * (0.3 + Math.random() * 0.3);
      
      ctx.beginPath();
      ctx.arc(x + offsetX, y + offsetY, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = brushColor;
    }
  };

  const drawMarker = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.fillStyle = brushColor;
    ctx.globalAlpha = 0.5;
    ctx.shadowBlur = 0;

    const size = brushSize * 1.8;
    ctx.beginPath();
    ctx.arc(x, y, size / 2, 0, Math.PI * 2);
    ctx.fill();
  };

  const drawAirbrush = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = brushColor;

    // 가우시안 분포로 더 부드러운 에어브러시
    const density = 30;
    const radius = brushSize * 2.5;
    for (let i = 0; i < density; i++) {
      const angle = Math.random() * Math.PI * 2;
      // 가우시안 분포 (중앙에 더 많이)
      const r1 = Math.random();
      const r2 = Math.random();
      const distance = radius * Math.sqrt(-2 * Math.log(r1)) * Math.cos(2 * Math.PI * r2) * 0.3;
      
      const px = x + Math.cos(angle) * Math.abs(distance);
      const py = y + Math.sin(angle) * Math.abs(distance);
      
      // 중심에서 멀수록 투명하게
      const distFromCenter = Math.abs(distance) / radius;
      ctx.globalAlpha = 0.08 * (1 - distFromCenter);
      
      ctx.beginPath();
      ctx.arc(px, py, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const drawWatercolor = (ctx: CanvasRenderingContext2D, x: number, y: number, pressure: number) => {
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = brushColor;

    const size = brushSize * 1.5 * (0.7 + pressure * 0.3);
    
    // 여러 레이어로 수채화 효과
    const layers = 8;
    for (let i = 0; i < layers; i++) {
      const layerSize = size * (1 - i * 0.08);
      ctx.globalAlpha = 0.03 + pressure * 0.02;
      
      const offsetX = (Math.random() - 0.5) * size * 0.3;
      const offsetY = (Math.random() - 0.5) * size * 0.3;
      
      ctx.beginPath();
      ctx.arc(x + offsetX, y + offsetY, layerSize / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const drawSpray = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = brushColor;

    // 스프레이 효과 - 자연스러운 분포
    const density = 25;
    const radius = brushSize * 1.8;
    for (let i = 0; i < density; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.sqrt(Math.random()) * radius;
      const px = x + Math.cos(angle) * distance;
      const py = y + Math.sin(angle) * distance;
      
      const size = Math.random() * 1.5 + 0.5;
      ctx.globalAlpha = 0.6 + Math.random() * 0.4;
      
      ctx.beginPath();
      ctx.arc(px, py, size, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const drawCalligraphy = (ctx: CanvasRenderingContext2D, x: number, y: number, pressure: number) => {
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.fillStyle = brushColor;

    if (!lastPointRef.current) return;

    // 이동 방향 계산
    const dx = x - lastPointRef.current.x;
    const dy = y - lastPointRef.current.y;
    const angle = Math.atan2(dy, dx);
    const speed = Math.sqrt(dx * dx + dy * dy);

    // 속도에 따라 두께 변화 (빠르면 가늘게)
    const speedFactor = Math.min(1, 5 / (speed + 1));
    const width = brushSize * (0.5 + pressure * 0.5) * speedFactor;
    const height = width * 0.25;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle + Math.PI / 2); // 90도 회전
    ctx.beginPath();
    ctx.ellipse(0, 0, height, width, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  const drawSquare = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = brushColor;
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    const size = brushSize;
    ctx.fillRect(x - size / 2, y - size / 2, size, size);
  };

  const drawEraser = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0,0,0,1)';
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    ctx.beginPath();
    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
    ctx.fill();
  };

  const clearCurrentLayer = () => {
    const currentLayer = layers.find(l => l.id === currentLayerId);
    if (!currentLayer) return;

    const ctx = currentLayer.canvas.getContext('2d');
    if (!ctx) return;

    // 첫 번째 레이어면 흰색으로, 아니면 투명하게
    const isFirstLayer = layers[0].id === currentLayerId;
    if (isFirstLayer) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, currentLayer.canvas.width, currentLayer.canvas.height);
    } else {
      ctx.clearRect(0, 0, currentLayer.canvas.width, currentLayer.canvas.height);
    }
    
    setLayers([...layers]);
    saveToHistory();
  };

  const saveImage = () => {
    const canvas = mainCanvasRef.current;
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = 'drawing.png';
    link.href = canvas.toDataURL();
    link.click();
  };

  const deleteLayer = (layerId: string) => {
    if (layers.length <= 1) return; // 최소 1개 레이어 유지
    
    const newLayers = layers.filter(l => l.id !== layerId);
    setLayers(newLayers);
    
    if (currentLayerId === layerId && newLayers.length > 0) {
      setCurrentLayerId(newLayers[0].id);
    }
    saveToHistory();
  };

  const toggleLayerVisibility = (layerId: string) => {
    setLayers(layers.map(l => 
      l.id === layerId ? { ...l, visible: !l.visible } : l
    ));
  };

  const updateLayerOpacity = (layerId: string, opacity: number) => {
    setLayers(layers.map(l => 
      l.id === layerId ? { ...l, opacity } : l
    ));
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>, layerId: string) => {
    setDraggedLayerId(layerId);
    if ('dataTransfer' in e) {
      e.dataTransfer.effectAllowed = 'move';
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    if ('dataTransfer' in e) {
      e.dataTransfer.dropEffect = 'move';
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>, targetLayerId: string) => {
    e.preventDefault();
    
    if (!draggedLayerId || draggedLayerId === targetLayerId) {
      setDraggedLayerId(null);
      return;
    }

    const draggedIndex = layers.findIndex(l => l.id === draggedLayerId);
    const targetIndex = layers.findIndex(l => l.id === targetLayerId);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedLayerId(null);
      return;
    }

    const newLayers = [...layers];
    const [draggedLayer] = newLayers.splice(draggedIndex, 1);
    newLayers.splice(targetIndex, 0, draggedLayer);

    setLayers(newLayers);
    setDraggedLayerId(null);
    saveToHistory();
  };

  const handleDragEnd = () => {
    setDraggedLayerId(null);
  };

  const undo = () => {
    if (historyStep <= 0) return;

    const prevState = history[historyStep - 1];
    restoreHistoryState(prevState);
    setHistoryStep(prev => prev - 1);
  };

  const redo = () => {
    if (historyStep >= history.length - 1) return;

    const nextState = history[historyStep + 1];
    restoreHistoryState(nextState);
    setHistoryStep(prev => prev + 1);
  };

  const restoreHistoryState = (state: HistoryState) => {
    const canvas = mainCanvasRef.current;
    if (!canvas) return;

    const restoredLayers: Layer[] = state.layersData.map(layerData => {
      const newCanvas = document.createElement('canvas');
      newCanvas.width = canvas.width;
      newCanvas.height = canvas.height;

      const ctx = newCanvas.getContext('2d');
      if (ctx) {
        const img = new Image();
        img.src = layerData.dataUrl;
        img.onload = () => {
          ctx.drawImage(img, 0, 0);
          setLayers([...restoredLayers]);
        };
      }

      return {
        id: layerData.id,
        name: layerData.name,
        canvas: newCanvas,
        visible: layerData.visible,
        opacity: layerData.opacity,
      };
    });

    setLayers(restoredLayers);
    if (restoredLayers.length > 0) {
      setCurrentLayerId(restoredLayers[restoredLayers.length - 1].id);
    }
  };

  return (
    <div className="h-screen w-screen bg-gray-900 overflow-hidden flex flex-col">
      {/* 상단 바 */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-white font-semibold text-lg">Drawing Lab</h1>
          
          {/* 브러시 타입 선택 */}
          <div className="flex items-center gap-1 bg-gray-700 px-2 py-1 rounded-lg overflow-x-auto max-w-xl">
            <button
              onClick={() => setBrushType('pen')}
              className={`px-2 py-1 rounded text-xs whitespace-nowrap ${brushType === 'pen' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-600'}`}
              title="펜 - 부드러운 기본 브러시"
            >
              펜
            </button>
            <button
              onClick={() => setBrushType('pencil')}
              className={`px-2 py-1 rounded text-xs whitespace-nowrap ${brushType === 'pencil' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-600'}`}
              title="연필 - 질감있는 연필"
            >
              연필
            </button>
            <button
              onClick={() => setBrushType('marker')}
              className={`px-2 py-1 rounded text-xs whitespace-nowrap ${brushType === 'marker' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-600'}`}
              title="마커 - 두껍고 반투명"
            >
              마커
            </button>
            <button
              onClick={() => setBrushType('calligraphy')}
              className={`px-2 py-1 rounded text-xs whitespace-nowrap ${brushType === 'calligraphy' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-600'}`}
              title="캘리그라피 - 각도에 따라 변하는 붓"
            >
              캘리
            </button>
            <button
              onClick={() => setBrushType('airbrush')}
              className={`px-2 py-1 rounded text-xs whitespace-nowrap ${brushType === 'airbrush' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-600'}`}
              title="에어브러시 - 부드러운 그라데이션"
            >
              에어
            </button>
            <button
              onClick={() => setBrushType('spray')}
              className={`px-2 py-1 rounded text-xs whitespace-nowrap ${brushType === 'spray' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-600'}`}
              title="스프레이 - 점들이 흩뿌려짐"
            >
              스프레이
            </button>
            <button
              onClick={() => setBrushType('watercolor')}
              className={`px-2 py-1 rounded text-xs whitespace-nowrap ${brushType === 'watercolor' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-600'}`}
              title="수채화 - 번지는 효과"
            >
              수채
            </button>
            <button
              onClick={() => setBrushType('square')}
              className={`px-2 py-1 rounded text-xs whitespace-nowrap ${brushType === 'square' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-600'}`}
              title="사각 - 픽셀 아트 스타일"
            >
              사각
            </button>
          </div>

          {/* 브러시 크기 */}
          <div className="flex items-center gap-2 bg-gray-700 px-3 py-1 rounded-lg">
            <span className="text-white text-sm">크기</span>
            <input
              type="range"
              min="1"
              max="50"
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="w-24"
            />
            <span className="text-white text-sm w-8">{brushSize}</span>
          </div>

          {/* 색상 선택 */}
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={brushColor}
              onChange={(e) => setBrushColor(e.target.value)}
              className="w-10 h-10 rounded-lg cursor-pointer border-2 border-gray-600"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={clearCurrentLayer}
            className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
          >
            레이어 지우기
          </button>
          <button
            onClick={saveImage}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            저장
          </button>
        </div>
      </div>

      {/* 메인 영역 */}
      <div className="flex-1 flex relative">
        {/* 캔버스 */}
        <div className="flex-1 flex items-center justify-center bg-gray-900">
          <canvas
            ref={mainCanvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            onTouchCancel={stopDrawing}
            className="cursor-crosshair shadow-2xl"
            style={{ touchAction: 'none' }}
          />
        </div>

        {/* 오른쪽 사이드바 - 프로크리에이트 스타일 */}
        <div className="w-20 bg-gray-800 border-l border-gray-700 flex flex-col items-center py-4 gap-3">
          {/* 지우개 */}
          <button
            onClick={() => setBrushType('eraser')}
            className={`w-14 h-14 rounded-xl flex items-center justify-center transition-all ${
              brushType === 'eraser'
                ? 'bg-blue-600 shadow-lg shadow-blue-500/50'
                : 'bg-gray-700 hover:bg-gray-600'
            }`}
            title="지우개"
          >
            <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M16.24 3.56l4.95 4.94c.78.79.78 2.05 0 2.84L12 20.53a4.008 4.008 0 0 1-5.66 0L2.81 17c-.78-.79-.78-2.05 0-2.84l10.6-10.6c.79-.78 2.05-.78 2.83 0M4.22 15.58l3.54 3.53c.78.79 2.04.79 2.83 0l3.53-3.53l-4.95-4.95l-4.95 4.95z"/>
            </svg>
          </button>

          {/* 레이어 */}
          <button
            onClick={() => setShowLayerPanel(!showLayerPanel)}
            data-layer-toggle
            className={`w-14 h-14 rounded-xl flex items-center justify-center transition-all ${
              showLayerPanel
                ? 'bg-blue-600 shadow-lg shadow-blue-500/50'
                : 'bg-gray-700 hover:bg-gray-600'
            }`}
            title="레이어"
          >
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </button>

          {/* 구분선 */}
          <div className="w-10 h-px bg-gray-700 my-2"></div>

          {/* 실행취소 */}
          <button
            onClick={undo}
            disabled={historyStep <= 0}
            className={`w-14 h-14 rounded-xl flex items-center justify-center transition-all ${
              historyStep <= 0
                ? 'bg-gray-700 opacity-50 cursor-not-allowed'
                : 'bg-gray-700 hover:bg-gray-600'
            }`}
            title="실행취소"
          >
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
          </button>

          {/* 다시실행 */}
          <button
            onClick={redo}
            disabled={historyStep >= history.length - 1}
            className={`w-14 h-14 rounded-xl flex items-center justify-center transition-all ${
              historyStep >= history.length - 1
                ? 'bg-gray-700 opacity-50 cursor-not-allowed'
                : 'bg-gray-700 hover:bg-gray-600'
            }`}
            title="다시실행"
          >
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
            </svg>
          </button>
        </div>

        {/* 레이어 패널 */}
        {showLayerPanel && (
          <div ref={layerPanelRef} className="absolute right-24 top-4 w-72 bg-gray-800 border border-gray-700 rounded-lg shadow-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-semibold">레이어</h3>
              <button
                onClick={() => createLayer(`레이어 ${layers.length + 1}`)}
                className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
              >
                + 새 레이어
              </button>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {layers.map((layer, index) => (
                <div
                  key={layer.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, layer.id)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, layer.id)}
                  onDragEnd={handleDragEnd}
                  onTouchStart={(e) => {
                    // 터치 시작 시 약간의 지연 후 드래그 시작
                    const touch = e.touches[0];
                    const startY = touch.clientY;
                    let moved = false;

                    const handleTouchMove = (moveEvent: TouchEvent) => {
                      const moveTouch = moveEvent.touches[0];
                      const deltaY = Math.abs(moveTouch.clientY - startY);
                      
                      if (deltaY > 10 && !moved) {
                        moved = true;
                        setDraggedLayerId(layer.id);
                      }
                    };

                    const handleTouchEnd = () => {
                      document.removeEventListener('touchmove', handleTouchMove);
                      document.removeEventListener('touchend', handleTouchEnd);
                      if (!moved) {
                        setCurrentLayerId(layer.id);
                      }
                      setDraggedLayerId(null);
                    };

                    document.addEventListener('touchmove', handleTouchMove);
                    document.addEventListener('touchend', handleTouchEnd);
                  }}
                  className={`p-2 rounded cursor-move transition-all ${
                    currentLayerId === layer.id
                      ? 'bg-blue-600'
                      : 'bg-gray-700 hover:bg-gray-600'
                  } ${
                    draggedLayerId === layer.id ? 'opacity-50' : ''
                  }`}
                  onClick={() => setCurrentLayerId(layer.id)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {/* 드래그 핸들 */}
                      <div className="cursor-move">
                        <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M9 3h2v2H9V3zm0 4h2v2H9V7zm0 4h2v2H9v-2zm0 4h2v2H9v-2zm0 4h2v2H9v-2zm4-16h2v2h-2V3zm0 4h2v2h-2V7zm0 4h2v2h-2v-2zm0 4h2v2h-2v-2zm0 4h2v2h-2v-2z"/>
                        </svg>
                      </div>
                      <span className="text-white text-sm">{layer.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleLayerVisibility(layer.id);
                        }}
                        className="p-1 hover:bg-gray-500 rounded"
                      >
                        {layer.visible ? (
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        )}
                      </button>
                      {layers.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteLayer(layer.id);
                          }}
                          className="p-1 hover:bg-red-600 rounded"
                        >
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                  <div 
                    className="flex items-center gap-2"
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="text-white text-xs">투명도</span>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={layer.opacity}
                      onChange={(e) => {
                        e.stopPropagation();
                        updateLayerOpacity(layer.id, Number(e.target.value));
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      className="flex-1"
                      onClick={(e) => e.stopPropagation()}
                      draggable={false}
                    />
                    <span className="text-white text-xs w-8">{Math.round(layer.opacity * 100)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
