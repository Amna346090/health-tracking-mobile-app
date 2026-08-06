import { useState } from 'react';
import type { FormEvent } from 'react';
import { Modal } from './Modal';
import { createPhoto, updatePhoto } from '../api/photos';
import type { Photo } from '../api/photos';
import { ApiError } from '../api/client';

interface Props {
  patientId: number;
  editingPhoto?: Photo;
  onClose: () => void;
  onSaved: (photo: Photo) => void;
}

export function PhotoModal({ patientId, editingPhoto, onClose, onSaved }: Props) {
  const isEditing = !!editingPhoto;
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState(editingPhoto?.caption ?? '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isEditing && !file) {
      setError('Choose a photo');
      return;
    }

    setLoading(true);
    try {
      const photo = isEditing
        ? await updatePhoto(patientId, editingPhoto.id, { file, caption: caption.trim() || null })
        : await createPhoto(patientId, file!, caption.trim() || null);
      onSaved(photo);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Could not ${isEditing ? 'update' : 'upload'} photo.`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      title={isEditing ? 'Edit Photo' : 'Upload Photo'}
      subtitle={isEditing ? 'Replace the file and/or update the caption' : "Add a progress photo to this patient's record"}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit}>
        {error && <div className="form-error">{error}</div>}

        <div className="field">
          <label htmlFor="photo-file">{isEditing ? 'Replace file (optional)' : 'Photo'}</label>
          <input
            id="photo-file"
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {isEditing && !file && (
            <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', marginTop: 6 }}>
              Leave blank to keep the current file.
            </p>
          )}
        </div>

        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="photo-caption">Caption (optional)</label>
          <input
            id="photo-caption"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="e.g. Week 4 progress"
          />
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Saving…' : isEditing ? 'Save changes' : 'Upload'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
