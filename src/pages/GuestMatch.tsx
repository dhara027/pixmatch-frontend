import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import apiClient from '@/api/apiClient';
import { Button } from '@/components/ui/button';

// Reliable data-URL → Blob without fetch() (fetch(dataURL) fails on some mobile browsers)
function dataURLtoBlob(dataURL: string): Blob {
  const [header, data] = dataURL.split(',');
  const mime = header.match(/:(.*?);/)![1];
  const bytes = atob(data);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

type JobStatus = 'idle' | 'uploading' | 'queued' | 'processing' | 'completed' | 'failed';

interface MatchedPhoto {
  photo_id: string;
  url: string;
  similarity: number;
}

const GuestMatch = () => {
  const { eventCode } = useParams<{ eventCode: string }>();
  const eventId = eventCode ?? '';

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [matchedPhotos, setMatchedPhotos] = useState<MatchedPhoto[]>([]);
  const [jobStatus, setJobStatus] = useState<JobStatus>('idle');
  const [jobId, setJobId] = useState<string | null>(null);
  const [eventName, setEventName] = useState<string>('');
  // null = trying, true = works, false = failed (use file input)
  const [cameraReady, setCameraReady] = useState<boolean | null>(null);

  // ── Fetch event info ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!eventId) return;
    apiClient.get(`/api/v1/events/${eventId}/public`).then((res) => {
      setEventName(res.data.data.event.event_name);
    }).catch(() => {
      toast.error('Event not found.');
    });
  }, [eventId]);

  // ── Try WebRTC camera (only works on HTTPS or localhost) ──────────────────
  useEffect(() => {
    let mounted = true;
    (async () => {
      // getUserMedia requires a secure context (https or localhost)
      if (!navigator.mediaDevices?.getUserMedia) {
        if (mounted) setCameraReady(false);
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setCameraReady(true);
      } catch {
        if (mounted) setCameraReady(false);
      }
    })();

    return () => {
      mounted = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  // ── Capture from live video ───────────────────────────────────────────────
  const captureFromVideo = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    setCapturedImage(canvas.toDataURL('image/jpeg', 0.92));
  }, []);

  // ── Handle file selected (from file input / gallery) ─────────────────────
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      if (result) setCapturedImage(result);
    };
    reader.readAsDataURL(file);
    // Reset input so the same file can be re-selected if user retakes
    e.target.value = '';
  }, []);

  const reset = useCallback(() => {
    setCapturedImage(null);
    setJobStatus('idle');
    setJobId(null);
    setMatchedPhotos([]);
  }, []);

  // ── Upload selfie → create async job ─────────────────────────────────────
  const uploadSelfie = useCallback(async () => {
    if (!capturedImage || !eventId) return;
    setJobStatus('uploading');

    try {
      const blob = dataURLtoBlob(capturedImage);
      const formData = new FormData();
      formData.append('event_id', eventId);
      formData.append('file', blob, 'selfie.jpg');

      const res = await apiClient.post('/api/v1/face-match/jobs', formData);
      const { job_id } = res.data.data;
      setJobId(job_id);
      setJobStatus('queued');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? 'Upload failed. Please try again.';
      toast.error(msg);
      setJobStatus('idle');
    }
  }, [capturedImage, eventId]);

  // ── Poll job status ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!jobId || jobStatus === 'completed' || jobStatus === 'failed') return;

    const interval = setInterval(async () => {
      try {
        const res = await apiClient.get(`/api/v1/face-match/jobs/${jobId}`);
        const { status, matched_photos, error } = res.data.data;
        setJobStatus(status);

        if (status === 'completed') {
          setMatchedPhotos(matched_photos || []);
          if ((matched_photos || []).length === 0) {
            toast.info('No matching photos found for your face.');
          } else {
            toast.success(`Found ${matched_photos.length} photo(s)!`);
          }
        } else if (status === 'failed') {
          toast.error(error || 'Face matching failed. Please try again.');
        }
      } catch {
        // Poll silently
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [jobId, jobStatus]);

  // ── Download helpers ──────────────────────────────────────────────────────
  // window.open() is blocked as a popup on mobile — use <a> click instead
  const triggerDownload = useCallback((href: string, filename: string) => {
    const a = document.createElement('a');
    a.href = href;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  const downloadAll = useCallback(() => {
    if (!matchedPhotos.length) return;
    if (matchedPhotos.length === 1) {
      triggerDownload(
        `/api/v1/face-match/download?urls=${encodeURIComponent(matchedPhotos[0].url)}`,
        'photo.jpg',
      );
    } else {
      const urls = matchedPhotos.map((p) => p.url).join(',');
      triggerDownload(
        `/api/v1/face-match/download?urls=${encodeURIComponent(urls)}`,
        'matched_photos.zip',
      );
    }
  }, [matchedPhotos, triggerDownload]);

  const downloadOne = useCallback((url: string, idx: number) => {
    triggerDownload(
      `/api/v1/face-match/download?urls=${encodeURIComponent(url)}`,
      `photo_${idx + 1}.jpg`,
    );
  }, [triggerDownload]);

  const isProcessing = jobStatus === 'queued' || jobStatus === 'processing' || jobStatus === 'uploading';

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center">
      <div className="w-full max-w-lg mx-auto p-4 space-y-6">

        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold">Find Your Photos</h1>
          {eventName && <p className="text-muted-foreground mt-1">{eventName}</p>}
        </div>

        {!capturedImage ? (
          <div className="space-y-4">
            {/* Live video (HTTPS / localhost only) */}
            {cameraReady === true && (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full rounded-xl shadow-lg border"
                />
                <Button onClick={captureFromVideo} className="w-full" size="lg">
                  📸 Capture Selfie
                </Button>
              </>
            )}

            {/* Loading camera */}
            {cameraReady === null && (
              <div className="flex items-center justify-center h-40 rounded-xl border bg-muted">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
              </div>
            )}

            {/* File-input fallback (works on HTTP — opens camera on mobile) */}
            {cameraReady === false && (
              <div className="rounded-xl border-2 border-dashed border-muted-foreground/30 p-8 text-center space-y-4">
                <div className="text-5xl">🤳</div>
                <p className="font-semibold text-lg">Take or upload your selfie</p>
                <p className="text-sm text-muted-foreground">
                  Use the buttons below to take a photo or choose from your gallery.
                </p>

                {/* Opens front camera on mobile */}
                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => fileInputRef.current?.click()}
                >
                  📷 Open Camera
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="user"
                  className="hidden"
                  onChange={handleFileSelect}
                />

                {/* Opens gallery / file picker */}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => galleryInputRef.current?.click()}
                >
                  🖼 Choose from Gallery
                </Button>
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>
            )}

            {/* Also show gallery option when live camera is available */}
            {cameraReady === true && (
              <div className="text-center">
                <span className="text-sm text-muted-foreground">or </span>
                <button
                  className="text-sm text-primary underline"
                  onClick={() => galleryInputRef.current?.click()}
                >
                  choose from gallery
                </button>
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <img
              src={capturedImage}
              alt="Your selfie"
              className="w-full rounded-xl shadow-lg border object-cover max-h-80"
            />
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={reset}
                className="flex-1"
                disabled={isProcessing}
              >
                🔄 Retake
              </Button>
              <Button
                onClick={uploadSelfie}
                className="flex-1"
                disabled={isProcessing || jobStatus === 'completed'}
              >
                {isProcessing
                  ? jobStatus === 'uploading'
                    ? 'Uploading...'
                    : 'Analyzing...'
                  : '🔍 Find My Photos'}
              </Button>
            </div>

            {isProcessing && (
              <div className="text-center py-4">
                <div className="animate-spin inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
                <p className="text-sm text-muted-foreground mt-2">
                  AI is scanning event photos — this may take 10–30 seconds...
                </p>
              </div>
            )}
          </div>
        )}

        {/* Results */}
        {matchedPhotos.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Your Photos ({matchedPhotos.length})</h2>
              <Button onClick={downloadAll} size="sm" variant="outline">
                ⬇ Download All
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {matchedPhotos.map((photo, idx) => (
                <div key={photo.photo_id} className="relative group rounded-lg overflow-hidden shadow border bg-muted">
                  <img
                    src={photo.url}
                    alt="Matched photo"
                    className="w-full h-40 object-cover"
                  />
                  <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                    {(photo.similarity * 100).toFixed(0)}% match
                  </div>
                  <button
                    onClick={() => downloadOne(photo.url, idx)}
                    className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1.5 shadow"
                    title="Download"
                  >
                    ⬇
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
};

export default GuestMatch;
