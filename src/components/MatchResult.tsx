import { Download, Share2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface Match {
  photoId: string;
  url: string;
  thumbUrl?: string;
  confidence: number;
}

interface MatchResultProps {
  matches: Match[];
  onDownload?: (photoId: string) => void;
  onViewPhoto?: (photoId: string) => void;
}

export const MatchResult = ({ matches, onDownload, onViewPhoto }: MatchResultProps) => {
  const handleShare = (match: Match) => {
    const shareUrl = `${window.location.origin}/photo/${match.photoId}`;
    navigator.clipboard.writeText(shareUrl);
    toast.success('Link copied to clipboard!');
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-green-500';
    if (confidence >= 0.6) return 'bg-yellow-500';
    return 'bg-orange-500';
  };

  if (matches.length === 0) {
    return (
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle>No Matches Found</CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground mb-4">
            We couldn't find any photos matching your face.
          </p>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>Tips for better matches:</p>
            <ul className="list-disc list-inside text-left max-w-xs mx-auto">
              <li>Ensure good lighting</li>
              <li>Face the camera directly</li>
              <li>Remove sunglasses or masks</li>
              <li>Try a different photo</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">
          Found {matches.length} {matches.length === 1 ? 'Match' : 'Matches'}!
        </h2>
        <p className="text-muted-foreground">
          Here are the photos we found with your face
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {matches.map((match) => (
          <Card key={match.photoId} className="overflow-hidden">
            <div className="relative aspect-square">
              <img
                src={match.thumbUrl || match.url}
                alt="Matched photo"
                className="w-full h-full object-cover"
              />
              <Badge
                className={`absolute top-2 right-2 ${getConfidenceColor(match.confidence)} text-white`}
              >
                {Math.round(match.confidence * 100)}% Match
              </Badge>
            </div>
            <CardFooter className="flex gap-2 pt-4">
              {onDownload && (
                <Button
                  onClick={() => onDownload(match.photoId)}
                  className="flex-1"
                  variant="default"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              )}
              <Button
                onClick={() => handleShare(match)}
                variant="outline"
                size="icon"
              >
                <Share2 className="h-4 w-4" />
              </Button>
              {onViewPhoto && (
                <Button
                  onClick={() => onViewPhoto(match.photoId)}
                  variant="outline"
                  size="icon"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
};
