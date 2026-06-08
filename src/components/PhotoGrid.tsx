import { useState } from 'react';
import { Download, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

interface Photo {
  id: string;
  url: string;
  thumbUrl?: string;
  filename?: string;
  metadata?: {
    uploadedBy?: string;
    createdAt?: string;
  };
}

interface PhotoGridProps {
  photos: Photo[];
  onPhotoClick?: (photo: Photo) => void;
  onDelete?: (photoIds: string[]) => void;
  onDownload?: (photoIds: string[]) => void;
  selectable?: boolean;
}

export const PhotoGrid = ({
  photos,
  onPhotoClick,
  onDelete,
  onDownload,
  selectable = false,
}: PhotoGridProps) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === photos.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(photos.map((p) => p.id)));
    }
  };

  const handleBulkAction = (action: 'delete' | 'download') => {
    const ids = Array.from(selectedIds);
    if (action === 'delete' && onDelete) {
      onDelete(ids);
    } else if (action === 'download' && onDownload) {
      onDownload(ids);
    }
    setSelectedIds(new Set());
  };

  if (photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <p className="text-lg">No photos yet</p>
        <p className="text-sm">Upload some photos to get started</p>
      </div>
    );
  }

  return (
    <div>
      {selectable && selectedIds.size > 0 && (
        <div className="mb-4 flex items-center justify-between p-4 bg-muted rounded-lg">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <div className="flex gap-2">
            {onDownload && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleBulkAction('download')}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            )}
            {onDelete && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleBulkAction('delete')}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
          </div>
        </div>
      )}

      {selectable && (
        <div className="mb-4">
          <Button variant="outline" size="sm" onClick={handleSelectAll}>
            {selectedIds.size === photos.length ? 'Deselect All' : 'Select All'}
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {photos.map((photo) => (
          <div
            key={photo.id}
            className={cn(
              'group relative aspect-square rounded-lg overflow-hidden cursor-pointer transition-transform hover:scale-105',
              selectedIds.has(photo.id) && 'ring-2 ring-accent'
            )}
          >
            {selectable && (
              <div
                className="absolute top-2 left-2 z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSelection(photo.id);
                }}
              >
                <Checkbox checked={selectedIds.has(photo.id)} />
              </div>
            )}

            <img
              src={photo.thumbUrl || photo.url}
              alt={photo.filename || 'Photo'}
              className="w-full h-full object-cover"
              onClick={() => onPhotoClick?.(photo)}
              loading="lazy"
            />

            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              {onDownload && (
                <Button
                  size="icon"
                  variant="secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDownload([photo.id]);
                  }}
                >
                  <Download className="h-4 w-4" />
                </Button>
              )}
              {onDelete && (
                <Button
                  size="icon"
                  variant="destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete([photo.id]);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
