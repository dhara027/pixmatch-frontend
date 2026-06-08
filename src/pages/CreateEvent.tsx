import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, MapPin, User, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import apiClient from '@/api/apiClient';
import { toast } from 'sonner';

const CreateEvent = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const [eventUuid, setEventUuid] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const [formData, setFormData] = useState({
    photographer_name: '',
    event_name: '',
    event_location: '',
    event_date: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await apiClient.post('/api/v1/events', formData);

      const data = response.data?.data;
      if (!data) throw new Error('Invalid response from server');

      const { event, qr_code_base64 } = data;
      setEventUuid(event.id);

      // Create preview URL from base64
      const qrUrl = `data:image/png;base64,${qr_code_base64}`;
      setQrPreview(qrUrl);

      // Open modal
      setShowModal(true);

      toast.success("Event created successfully!");

    } catch (error: unknown) {
      const msg =
        (error as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? 'Failed to create event';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const downloadQR = () => {
    if (!qrPreview) return;
    const link = document.createElement("a");
    link.href = qrPreview;
    link.download = `event-qr-${eventUuid}.png`;
    link.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      <div className="container mx-auto px-4 py-8">

        <Button
          variant="ghost"
          onClick={() => navigate('/dashboard')}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>

        <div className="flex items-center justify-center min-h-[calc(100vh-12rem)]">
          <Card className="w-full max-w-2xl shadow-xl">

            <CardHeader className="text-center space-y-2 pb-6">
              <div className="flex justify-center mb-4">
                <div className="rounded-full bg-primary/10 p-3">
                  <Camera className="h-8 w-8 text-primary" />
                </div>
              </div>
              <CardTitle className="text-3xl font-bold">Create Event</CardTitle>
              <CardDescription className="text-base">
                Add new event details
              </CardDescription>
            </CardHeader>

            <CardContent>

              <form onSubmit={handleSubmit} className="space-y-6">

                {/* Photographer Name */}
                <div className="space-y-2">
                  <Label htmlFor="photographer_name" className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Photographer Name
                  </Label>
                  <Input
                    id="photographer_name"
                    name="photographer_name"
                    type="text"
                    placeholder="Enter photographer name"
                    value={formData.photographer_name}
                    onChange={handleChange}
                    required
                    className="h-11"
                  />
                </div>

                {/* Event Name */}
                <div className="space-y-2">
                  <Label htmlFor="event_name" className="flex items-center gap-2">
                    <Camera className="h-4 w-4" />
                    Event Name
                  </Label>
                  <Input
                    id="event_name"
                    name="event_name"
                    type="text"
                    placeholder="Enter event name"
                    value={formData.event_name}
                    onChange={handleChange}
                    required
                    className="h-11"
                  />
                </div>

                {/* Event Location */}
                <div className="space-y-2">
                  <Label htmlFor="event_location" className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Event Location
                  </Label>
                  <Input
                    id="event_location"
                    name="event_location"
                    type="text"
                    placeholder="Enter event location"
                    value={formData.event_location}
                    onChange={handleChange}
                    required
                    className="h-11"
                  />
                </div>

                {/* Event Date */}
                <div className="space-y-2">
                  <Label htmlFor="event_date" className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Event Date
                  </Label>
                  <Input
                    id="event_date"
                    name="event_date"
                    type="date"
                    value={formData.event_date}
                    onChange={handleChange}
                    required
                    className="h-11"
                  />
                </div>

                {/* Buttons */}
                <div className="flex gap-4 pt-4">
                  <Button
                    variant="outline"
                    type="button"
                    className="flex-1"
                    onClick={() => navigate('/dashboard')}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1" disabled={loading}>
                    {loading ? 'Creating...' : 'Create Event'}
                  </Button>
                </div>

              </form>
            </CardContent>

          </Card>
        </div>

      </div>

      {/* QR Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Event QR Code</DialogTitle>
          </DialogHeader>

          {qrPreview && (
            <img
              src={qrPreview}
              alt="QR Code"
              className="w-48 h-48 mx-auto border rounded-lg p-2 bg-white shadow"
            />
          )}

          <DialogFooter className="flex flex-col gap-3 mt-4">
            <Button onClick={downloadQR}>Download QR</Button>

            {eventUuid && (
              <Button
                variant="default"
                onClick={() => navigate(`/dashboard/event/${eventUuid}/upload-photos`)}
              >
                Go to Upload Photos
              </Button>
            )}

            <Button variant="outline" onClick={() => navigate('/dashboard')}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CreateEvent;
