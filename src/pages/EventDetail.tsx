import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Upload, ArrowLeft, QrCode, Download, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import apiClient from '@/api/apiClient';
import { toast } from 'sonner';

interface Photo {
  id: string;
  url: string;
  filename?: string;
  uploaded_at?: string;
}

interface EventData {
  id: string;
  event_name: string;
  event_location: string;
  event_date: string;
  photographer_name: string;
  total_photos?: number;
}

const EventDetail = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [event, setEvent] = useState<EventData | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const fetchEventDetails = useCallback(async () => {
    try {
      const response = await apiClient.get(`/api/v1/events/${eventId}`);
      setEvent(response.data?.data?.event ?? null);
    } catch {
      toast.error('Failed to load event details');
    }
  }, [eventId]);

  const fetchPhotos = useCallback(async () => {
    try {
      const response = await apiClient.get(`/api/v1/events/${eventId}/photos`);
      setPhotos(response.data?.data?.photos ?? []);
    } catch {
      toast.error('Failed to load photos');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (eventId) {
      fetchEventDetails();
      fetchPhotos();
    }
  }, [eventId, fetchEventDetails, fetchPhotos]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFiles(Array.from(e.target.files || []));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      toast.error('Please select at least one file');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    selectedFiles.forEach((file) => formData.append('files', file));

    try {
      const result = await apiClient.post(`/api/v1/events/${eventId}/photos`, formData, {
        timeout: 300000,
        onUploadProgress: (e) => {
          if (e.total) setUploadProgress(Math.round((e.loaded * 100) / e.total));
        },
      });

      const { uploaded_count, error_count } = result.data?.data ?? {};
      if (uploaded_count > 0) toast.success(`${uploaded_count} photo(s) uploaded successfully!`);
      if (error_count > 0) toast.warning(`${error_count} file(s) could not be uploaded.`);

      setSelectedFiles([]);
      setUploadProgress(0);
      setUploadDialogOpen(false);
      fetchPhotos();
      fetchEventDetails();
    } catch (error: unknown) {
      const msg =
        (error as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? 'Failed to upload photos';
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const downloadPhoto = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      // Fallback: open in new tab if fetch fails (e.g., CORS on direct URL)
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const guestUrl = `${window.location.origin}/guest/${eventId}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      <div className="container mx-auto px-4 py-8">
        <Button variant="ghost" onClick={() => navigate('/dashboard')} className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">{event?.event_name ?? 'Event'}</h1>
            <p className="text-muted-foreground">
              {event?.event_location} &nbsp;·&nbsp;{' '}
              {event?.event_date ? new Date(event.event_date).toLocaleDateString() : ''}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {photos.length} photo{photos.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <QrCode className="h-4 w-4 mr-2" />
                  Guest Link
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Guest Access Link</DialogTitle>
                  <DialogDescription>Share this with guests so they can find their photos</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="p-4 bg-muted rounded-lg break-all font-mono text-sm">
                    {guestUrl}
                  </div>
                  <Button
                    onClick={() => { navigator.clipboard.writeText(guestUrl); toast.success('Link copied!'); }}
                    className="w-full"
                  >
                    Copy Link
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Photos
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Upload Photos</DialogTitle>
                  <DialogDescription>Add photos to this event</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div
                    className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ImageIcon className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm font-medium">Click to select photos</p>
                    <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WebP up to 20 MB each</p>
                    {selectedFiles.length > 0 && (
                      <p className="text-sm font-semibold text-primary mt-2">
                        {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected
                      </p>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </div>

                  {uploading && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Uploading...</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={handleUpload}
                    disabled={uploading || selectedFiles.length === 0}
                    className="w-full"
                  >
                    {uploading
                      ? 'Uploading...'
                      : `Upload ${selectedFiles.length > 0 ? selectedFiles.length + ' ' : ''}Photo${selectedFiles.length !== 1 ? 's' : ''}`}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Photo Grid */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="aspect-square bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : photos.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <ImageIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold">No photos yet</h3>
              <p className="text-muted-foreground mb-6">Upload photos to this event to get started</p>
              <Button onClick={() => setUploadDialogOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Upload Photos
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="relative group aspect-square rounded-lg overflow-hidden border border-border bg-muted"
              >
                <img
                  src={photo.url}
                  alt={photo.filename ?? 'Event photo'}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                  {photo.filename ?? 'photo'}
                </div>
                <button
                  onClick={() => downloadPhoto(photo.url, photo.filename ?? `photo-${photo.id}.jpg`)}
                  className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Download"
                >
                  <Download className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default EventDetail;
