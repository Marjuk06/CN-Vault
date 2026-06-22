import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import getCroppedImg from '@/lib/cropImage';
import { Check, X as CloseIcon } from 'lucide-react';

interface ImageCropperModalProps {
  imageSrc: string;
  onCropDone: (croppedBase64: string) => void;
  onCancel: () => void;
}

export default function ImageCropperModal({ imageSrc, onCropDone, onCancel }: ImageCropperModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<unknown | null>(null);

  const onCropComplete = useCallback((_croppedArea: unknown, croppedAreaPixels: unknown) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleSave = async () => {
    if (!croppedAreaPixels) return;
    try {
      const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels, 0);
      onCropDone(croppedImage);
    } catch (e) {
      console.error('Error cropping image:', e);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-sm glass-bright rounded-2xl overflow-hidden flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h3 className="font-semibold text-white">Crop Profile Picture</h3>
          <button onClick={onCancel} className="p-1 rounded-lg text-white/50 hover:text-white hover:bg-white/10">
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>
        
        <div className="relative w-full h-64 bg-black">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onCropComplete={onCropComplete}
            onZoomChange={setZoom}
          />
        </div>

        <div className="p-4 bg-white/[0.02]">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs text-white/50">Zoom</span>
            <input
              type="range"
              value={zoom}
              min={1}
              max={3}
              step={0.1}
              aria-labelledby="Zoom"
              onChange={(e) => {
                setZoom(Number(e.target.value));
              }}
              className="w-full accent-violet-500 h-1 bg-white/10 rounded-full appearance-none outline-none"
            />
          </div>
          <button
            onClick={handleSave}
            className="w-full btn-primary py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" /> Apply Picture
          </button>
        </div>
      </div>
    </div>
  );
}
