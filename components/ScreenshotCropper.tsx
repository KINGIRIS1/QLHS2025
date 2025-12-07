
import React, { useState, useRef, useEffect } from 'react';
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Check, X, Crop as CropIcon, Edit3, Type, Undo, PenTool, Eraser } from 'lucide-react';

interface ScreenshotCropperProps {
  imageSrc: string;
  onConfirm: (croppedBlob: Blob) => void;
  onCancel: () => void;
}

const ScreenshotCropper: React.FC<ScreenshotCropperProps> = ({ imageSrc, onConfirm, onCancel }) => {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  
  // States cho chế độ chỉnh sửa (Annotate)
  const [mode, setMode] = useState<'crop' | 'edit'>('crop');
  const [editTool, setEditTool] = useState<'pen' | 'text'>('pen');
  const [penColor, setPenColor] = useState('#ef4444'); // Mặc định màu đỏ
  const [editImageSrc, setEditImageSrc] = useState<string | null>(null); // Ảnh sau khi crop để vẽ lên
  const [textInput, setTextInput] = useState<{ x: number, y: number, value: string } | null>(null);

  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  
  // Ref cho vẽ
  const isDrawing = useRef(false);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  // Tự động chọn vùng crop mặc định
  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    const crop = centerCrop(
      makeAspectCrop({ unit: '%', width: 80 }, width / height, width, height),
      width, height
    );
    setCrop(crop);
  };

  // 1. Xử lý Crop -> Chuyển sang chế độ Edit
  const handleCropContinue = async () => {
    if (completedCrop && imgRef.current && completedCrop.width > 0 && completedCrop.height > 0) {
      const canvas = document.createElement('canvas');
      const image = imgRef.current;
      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;
      
      canvas.width = completedCrop.width;
      canvas.height = completedCrop.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Vẽ phần đã crop lên canvas tạm
      ctx.drawImage(
        image,
        completedCrop.x * scaleX,
        completedCrop.y * scaleY,
        completedCrop.width * scaleX,
        completedCrop.height * scaleY,
        0, 0,
        completedCrop.width,
        completedCrop.height
      );

      // Chuyển canvas thành URL để hiển thị ở bước Edit
      const croppedDataUrl = canvas.toDataURL('image/png');
      setEditImageSrc(croppedDataUrl);
      setMode('edit');
    } else if (imgRef.current) {
        // Nếu không crop, dùng nguyên ảnh gốc
        setEditImageSrc(imageSrc);
        setMode('edit');
    }
  };

  // 2. Khởi tạo Canvas Edit khi chuyển mode
  useEffect(() => {
      if (mode === 'edit' && editImageSrc && canvasRef.current) {
          const canvas = canvasRef.current;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          
          const img = new Image();
          img.onload = () => {
              // Set kích thước canvas bằng kích thước ảnh
              canvas.width = img.width;
              canvas.height = img.height;
              // Vẽ ảnh nền
              ctx.drawImage(img, 0, 0);
              ctx.lineCap = 'round';
              ctx.lineJoin = 'round';
              ctxRef.current = ctx;
          };
          img.src = editImageSrc;
      }
  }, [mode, editImageSrc]);

  // --- LOGIC VẼ (DRAWING) ---
  const startDrawing = (e: React.MouseEvent) => {
      if (editTool !== 'pen' || !ctxRef.current || !canvasRef.current) return;
      isDrawing.current = true;
      const { offsetX, offsetY } = e.nativeEvent;
      
      // Tính tỉ lệ nếu canvas bị scale CSS
      const rect = canvasRef.current.getBoundingClientRect();
      const scaleX = canvasRef.current.width / rect.width;
      const scaleY = canvasRef.current.height / rect.height;

      ctxRef.current.beginPath();
      ctxRef.current.moveTo(offsetX * scaleX, offsetY * scaleY);
      ctxRef.current.strokeStyle = penColor;
      ctxRef.current.lineWidth = 3;
  };

  const draw = (e: React.MouseEvent) => {
      if (!isDrawing.current || editTool !== 'pen' || !ctxRef.current || !canvasRef.current) return;
      const { offsetX, offsetY } = e.nativeEvent;
      
      const rect = canvasRef.current.getBoundingClientRect();
      const scaleX = canvasRef.current.width / rect.width;
      const scaleY = canvasRef.current.height / rect.height;

      ctxRef.current.lineTo(offsetX * scaleX, offsetY * scaleY);
      ctxRef.current.stroke();
  };

  const stopDrawing = () => {
      if (!isDrawing.current || !ctxRef.current) return;
      ctxRef.current.closePath();
      isDrawing.current = false;
  };

  // --- LOGIC TEXT ---
  const handleCanvasClick = (e: React.MouseEvent) => {
      if (editTool === 'text' && !textInput) {
          const rect = e.currentTarget.getBoundingClientRect();
          // Tọa độ click tương đối theo viewport để đặt input overlay
          setTextInput({ x: e.clientX, y: e.clientY, value: '' });
          setTimeout(() => textInputRef.current?.focus(), 100);
      }
  };

  const finishText = () => {
      if (textInput && ctxRef.current && canvasRef.current) {
          if (textInput.value.trim()) {
              const rect = canvasRef.current.getBoundingClientRect();
              const scaleX = canvasRef.current.width / rect.width;
              const scaleY = canvasRef.current.height / rect.height;

              // Tính toán vị trí tương đối trên Canvas gốc
              // textInput.x/y là clientX/Y, cần trừ đi rect.left/top
              const canvasX = (textInput.x - rect.left) * scaleX;
              const canvasY = (textInput.y - rect.top) * scaleY;

              ctxRef.current.font = "bold 20px Arial";
              ctxRef.current.fillStyle = penColor;
              ctxRef.current.fillText(textInput.value, canvasX, canvasY + 15); // +15 để căn chỉnh baseline
          }
          setTextInput(null); // Ẩn input
      }
  };

  // --- FINAL CONFIRM ---
  const handleFinalConfirm = () => {
      if (canvasRef.current) {
          canvasRef.current.toBlob((blob) => {
              if (blob) onConfirm(blob);
          }, 'image/png');
      }
  };

  // Bắt sự kiện Enter khi nhập text
  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') finishText();
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/90 flex flex-col items-center justify-center p-4">
      
      <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
        {mode === 'crop' ? (
            <ReactCrop
              crop={crop}
              onChange={(_, percentCrop) => setCrop(percentCrop)}
              onComplete={(c) => setCompletedCrop(c)}
              className="max-h-[85vh]"
            >
              <img
                ref={imgRef}
                src={imageSrc}
                alt="Screenshot"
                onLoad={onImageLoad}
                className="max-h-[85vh] object-contain shadow-2xl"
              />
            </ReactCrop>
        ) : (
            <div className="relative max-h-[85vh] flex items-center justify-center">
                <canvas 
                    ref={canvasRef}
                    className="max-h-[85vh] max-w-full object-contain shadow-2xl cursor-crosshair bg-white"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onClick={handleCanvasClick}
                />
                {/* Text Input Overlay */}
                {textInput && (
                    <input
                        ref={textInputRef}
                        type="text"
                        style={{
                            position: 'fixed',
                            left: textInput.x,
                            top: textInput.y,
                            color: penColor,
                            fontSize: '20px',
                            fontWeight: 'bold',
                            background: 'transparent',
                            border: '1px dashed white',
                            outline: 'none',
                            zIndex: 10000,
                            padding: '4px',
                            minWidth: '100px'
                        }}
                        value={textInput.value}
                        onChange={(e) => setTextInput({ ...textInput, value: e.target.value })}
                        onBlur={finishText}
                        onKeyDown={handleKeyDown}
                        placeholder="Nhập chữ..."
                    />
                )}
            </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="absolute bottom-6 flex flex-col items-center gap-3">
        {/* Color Picker & Tool Selector (Only for Edit Mode) */}
        {mode === 'edit' && (
            <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md p-2 rounded-xl border border-white/20 shadow-xl mb-2">
                <div className="flex bg-black/20 rounded-lg p-1">
                    <button 
                        onClick={() => setEditTool('pen')}
                        className={`p-2 rounded-md ${editTool === 'pen' ? 'bg-white text-black' : 'text-white hover:bg-white/20'}`}
                    >
                        <Edit3 size={18} />
                    </button>
                    <button 
                        onClick={() => setEditTool('text')}
                        className={`p-2 rounded-md ${editTool === 'text' ? 'bg-white text-black' : 'text-white hover:bg-white/20'}`}
                    >
                        <Type size={18} />
                    </button>
                </div>
                
                <div className="h-6 w-px bg-white/20"></div>

                <div className="flex gap-2 px-2">
                    {['#ef4444', '#3b82f6', '#22c55e', '#ffffff', '#000000'].map(color => (
                        <button 
                            key={color}
                            onClick={() => setPenColor(color)}
                            className={`w-6 h-6 rounded-full border-2 ${penColor === color ? 'border-white scale-110' : 'border-transparent'}`}
                            style={{ backgroundColor: color }}
                        />
                    ))}
                </div>
            </div>
        )}

        <div className="flex items-center gap-4 bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/20 shadow-xl">
            <div className="text-white text-sm font-medium px-2 flex items-center gap-2">
                {mode === 'crop' ? (
                    <>
                        <CropIcon size={18} />
                        <span>Chọn vùng cắt</span>
                    </>
                ) : (
                    <>
                        <PenTool size={18} />
                        <span>Vẽ ghi chú</span>
                    </>
                )}
            </div>
            <div className="h-6 w-px bg-white/20"></div>
            
            <button
            onClick={onCancel}
            className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl transition-all font-medium text-sm"
            >
            <X size={18} /> Hủy
            </button>

            {mode === 'crop' ? (
                <button
                onClick={handleCropContinue}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all font-bold text-sm shadow-lg"
                >
                <Edit3 size={18} /> Chỉnh sửa
                </button>
            ) : (
                <button
                onClick={handleFinalConfirm}
                className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-500 text-white rounded-xl transition-all font-bold text-sm shadow-lg"
                >
                <Check size={18} /> Gửi ngay
                </button>
            )}
        </div>
      </div>
    </div>
  );
};

export default ScreenshotCropper;
