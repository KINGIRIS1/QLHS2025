
import React, { useState, useRef, useEffect } from 'react';
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Check, X, Crop as CropIcon } from 'lucide-react';

interface ScreenshotCropperProps {
  imageSrc: string;
  onConfirm: (croppedBlob: Blob) => void;
  onCancel: () => void;
}

// Hàm helper để cắt ảnh từ canvas
const getCroppedImg = (image: HTMLImageElement, crop: PixelCrop): Promise<Blob> => {
  const canvas = document.createElement('canvas');
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  canvas.width = crop.width;
  canvas.height = crop.height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('No 2d context');
  }

  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    crop.width,
    crop.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Canvas is empty'));
        return;
      }
      resolve(blob);
    }, 'image/png');
  });
};

const ScreenshotCropper: React.FC<ScreenshotCropperProps> = ({ imageSrc, onConfirm, onCancel }) => {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement>(null);

  // Tự động chọn vùng crop mặc định ở giữa khi ảnh load xong
  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    const crop = centerCrop(
      makeAspectCrop(
        {
          unit: '%',
          width: 80, // Chọn 80% ảnh mặc định
        },
        width / height,
        width,
        height
      ),
      width,
      height
    );
    setCrop(crop);
  };

  const handleConfirm = async () => {
    if (completedCrop && imgRef.current && completedCrop.width > 0 && completedCrop.height > 0) {
      try {
        const croppedBlob = await getCroppedImg(imgRef.current, completedCrop);
        onConfirm(croppedBlob);
      } catch (e) {
        console.error("Lỗi khi cắt ảnh:", e);
      }
    } else if (imgRef.current) {
        // Nếu không crop, gửi nguyên ảnh gốc
        const response = await fetch(imageSrc);
        const blob = await response.blob();
        onConfirm(blob);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/90 flex flex-col items-center justify-center p-4">
      <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
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
      </div>

      {/* Toolbar */}
      <div className="absolute bottom-6 flex items-center gap-4 bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/20 shadow-xl">
        <div className="text-white text-sm font-medium px-2 flex items-center gap-2">
            <CropIcon size={18} />
            <span>Kéo thả để chọn vùng gửi</span>
        </div>
        <div className="h-6 w-px bg-white/20"></div>
        <button
          onClick={onCancel}
          className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl transition-all font-medium text-sm"
        >
          <X size={18} /> Hủy
        </button>
        <button
          onClick={handleConfirm}
          className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all font-bold text-sm shadow-lg shadow-blue-900/20"
        >
          <Check size={18} /> Gửi ngay
        </button>
      </div>
    </div>
  );
};

export default ScreenshotCropper;
