import { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  LogOut, Calendar, Image, Plus, Upload,
  MapPin, QrCode, Download, X as Close, ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/api/apiClient';
import { toast } from 'sonner';
import QRCode from 'react-qr-code';

interface Event {
  id: string;
  event_name: string;
  photographer_name: string;
  event_location: string;
  event_date: string;
  total_photos: number;
}

interface EventsResponse {
  events: Event[];
  meta: { page: number; page_size: number; total: number; total_pages: number };
}

const PAGE_SIZE = 12;

const EventCardSkeleton = () => (
  <Card className="animate-pulse">
    <CardHeader>
      <div className="h-5 bg-muted rounded w-3/4 mb-2" />
      <div className="h-4 bg-muted rounded w-1/2" />
    </CardHeader>
    <CardContent className="space-y-2">
      <div className="h-4 bg-muted rounded w-full" />
      <div className="h-4 bg-muted rounded w-2/3" />
      <div className="h-8 bg-muted rounded w-full mt-3" />
    </CardContent>
  </Card>
);

const Dashboard = () => {
  const [page, setPage] = useState(1);
  const [showQR, setShowQR] = useState(false);
  const [qrEvent, setQrEvent] = useState<Event | null>(null);

  const { logout, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  const { data, isLoading, isError } = useQuery<EventsResponse>({
    queryKey: ['events', page],
    queryFn: async () => {
      const response = await apiClient.get('/api/v1/events', {
        params: { page, page_size: PAGE_SIZE },
      });
      // Backend paginated() puts events inside `data` but `meta` at top level
      return {
        events: response.data?.data?.events ?? [],
        meta: response.data?.meta,
      };
    },
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (isError) toast.error('Failed to load events.');
  }, [isError]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const events = data?.events ?? [];
  const meta = data?.meta;
  const totalPages = meta?.total_pages ?? 1;

  const publicURL = import.meta.env.VITE_PUBLIC_URL ?? window.location.origin;

  const openQR = (event: Event) => { setQrEvent(event); setShowQR(true); };

  const downloadQR = () => {
    const svg = document.getElementById('qr-code-svg');
    if (!svg) return;
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${qrEvent?.event_name ?? 'event'}-qr.svg`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('QR downloaded');
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">{user?.email ?? 'Your events & photos'}</p>
          </div>
          <div className="flex gap-3">
            <Button onClick={() => navigate('/dashboard/create-event')}>
              <Plus className="h-4 w-4 mr-2" /> Create Event
            </Button>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" /> Logout
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold">Events</h2>
          {meta && meta.total > 0 && (
            <span className="text-sm text-muted-foreground">{meta.total} total</span>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => <EventCardSkeleton key={i} />)}
          </div>
        ) : events.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold">No events yet</h3>
              <p className="text-muted-foreground mb-6">Create your first event to get started</p>
              <Button onClick={() => navigate('/dashboard/create-event')}>
                <Plus className="h-4 w-4 mr-2" /> Create Event
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {events.map((event) => (
                <Card
                  key={event.id}
                  className="hover:shadow-xl transition-shadow cursor-pointer"
                  onClick={() => navigate(`/dashboard/event/${event.id}`)}
                >
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg truncate">{event.event_name}</CardTitle>
                        <CardDescription>{event.photographer_name}</CardDescription>
                      </div>
                      <button
                        className="p-2 hover:bg-muted rounded-xl transition shrink-0"
                        onClick={(e) => { e.stopPropagation(); openQR(event); }}
                        title="Show QR Code"
                      >
                        <QrCode className="h-5 w-5" />
                      </button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4 mr-2 shrink-0" />
                      <span className="truncate">{event.event_location}</span>
                    </div>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4 mr-2 shrink-0" />
                      {event.event_date ? new Date(event.event_date).toLocaleDateString() : 'Date not set'}
                    </div>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Image className="h-4 w-4 mr-2 shrink-0" />
                      {event.total_photos ?? 0} photos
                    </div>
                    <Button
                      variant="outline"
                      className="w-full mt-3"
                      onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/event/${event.id}/upload-photos`); }}
                    >
                      <Upload className="h-4 w-4 mr-2" /> Upload Photos
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-4 mt-8">
                <Button
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* QR Modal */}
      {showQR && qrEvent && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-card rounded-xl shadow-xl p-6 w-[380px] relative">
            <button
              className="absolute top-4 right-4 p-1 hover:bg-muted rounded-full"
              onClick={() => setShowQR(false)}
            >
              <Close className="h-5 w-5" />
            </button>
            <h2 className="text-xl font-bold text-center mb-4">{qrEvent.event_name}</h2>
            <div className="flex justify-center p-4 bg-white rounded-xl">
              <QRCode
                id="qr-code-svg"
                value={`${publicURL}/guest/${qrEvent.id}`}
                size={220}
              />
            </div>
            <p className="text-xs text-center text-muted-foreground mt-2">
              Guests scan this QR to find their photos
            </p>
            <Button className="w-full mt-4" onClick={downloadQR}>
              <Download className="h-4 w-4 mr-2" /> Download QR
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
