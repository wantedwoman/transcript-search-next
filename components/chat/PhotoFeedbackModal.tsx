'use client';

import { useState, useRef } from 'react';
import { FEEDBACK_TEMPLATES, ImageType } from '@/lib/photo-feedback/feedback-templates';

interface PhotoFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFeedbackReceived: (feedback: string, imageType: ImageType) => void;
}

export default function PhotoFeedbackModal({ isOpen, onClose, onFeedbackReceived }: PhotoFeedbackModalProps) {
  const [step, setStep] = useState<'select' | 'upload' | 'analyzing' | 'result'>('select');
  const [selectedType, setSelectedType] = useState<ImageType | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTypeSelect = (type: ImageType) => {
    setSelectedType(type);
    setStep('upload');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (PNG, JPG, or WebP)');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be under 10MB');
      return;
    }

    setSelectedFile(file);
    setError(null);

    // Create preview
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleSubmit = async () => {
    if (!selectedFile || !selectedType) return;

    setStep('analyzing');
    setError(null);

    try {
      const formData = new FormData();
      formData.append('image', selectedFile);
      formData.append('imageType', selectedType);

      const response = await fetch('/api/suzy/photo-feedback', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || `Server error: ${response.status}`);
      }

      setFeedback(data.feedback);
      setStep('result');

      // Also push the feedback to the parent chat
      onFeedbackReceived(data.feedback, selectedType);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze image');
      setStep('upload');
    }
  };

  const handleReset = () => {
    setStep('select');
    setSelectedType(null);
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setFeedback(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={handleClose}>
      <div
        className="bg-[#171117] border border-outline-variant/20 rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-outline-variant/20">
          <h2 className="text-2xl font-headline font-bold text-primary tracking-tight">Photo Feedback</h2>
          <button
            onClick={handleClose}
            className="p-2 text-secondary/60 hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-2xl">close</span>
          </button>
        </div>

        {/* Step: Select Type */}
        {step === 'select' && (
          <div className="p-6 space-y-4">
            <p className="text-secondary/70 font-body text-lg">
              Upload a screenshot and tell me what you want feedback on.
            </p>
            <div className="space-y-3">
              {FEEDBACK_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleTypeSelect(template.id)}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-outline-variant/20 bg-surface-container-low hover:border-primary/40 hover:bg-primary/5 transition-all active:scale-[0.98] text-left"
                >
                  <span className="material-symbols-outlined text-2xl text-primary">{template.icon}</span>
                  <div className="flex-1">
                    <div className="font-label font-semibold text-on-surface text-lg">{template.label}</div>
                    <div className="text-sm text-secondary/60">{template.description}</div>
                  </div>
                  <span className="material-symbols-outlined text-secondary/40">chevron_right</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step: Upload Image */}
        {step === 'upload' && selectedType && (
          <div className="p-6 space-y-4">
            <button
              onClick={() => { setStep('select'); setSelectedType(null); }}
              className="flex items-center gap-2 text-secondary/60 hover:text-primary transition-colors text-sm font-label"
            >
              <span className="material-symbols-outlined text-lg">arrow_back</span>
              Back
            </button>

            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary">{FEEDBACK_TEMPLATES.find(t => t.id === selectedType)?.icon}</span>
              <h3 className="font-label font-semibold text-on-surface text-lg">
                {FEEDBACK_TEMPLATES.find(t => t.id === selectedType)?.label}
              </h3>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
              accept="image/png,image/jpeg,image/webp"
            />

            {previewUrl ? (
              <div className="relative rounded-xl overflow-hidden border border-outline-variant/20">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-full max-h-64 object-contain bg-black/20"
                />
                <button
                  onClick={() => {
                    setSelectedFile(null);
                    setPreviewUrl(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-full text-white hover:bg-black/80 transition-colors"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full p-8 border-2 border-dashed border-outline-variant/30 rounded-xl text-secondary/50 hover:border-primary/40 hover:text-primary transition-all flex flex-col items-center gap-3"
              >
                <span className="material-symbols-outlined text-4xl">add_photo_alternate</span>
                <span className="font-label font-semibold text-lg">Upload Image</span>
                <span className="text-sm">PNG, JPG, or WebP up to 10MB</span>
              </button>
            )}

            {error && (
              <div className="text-error px-4 py-2 rounded-lg bg-error-container/10 border border-error/20 font-body text-sm">
                {error}
              </div>
            )}

            {selectedFile && (
              <button
                onClick={handleSubmit}
                className="w-full bg-primary text-on-primary py-4 rounded-xl font-label font-semibold text-lg shadow-lg active:scale-[0.98] transition-all hover:bg-primary/90"
              >
                Get Feedback
              </button>
            )}
          </div>
        )}

        {/* Step: Analyzing */}
        {step === 'analyzing' && (
          <div className="p-12 flex flex-col items-center gap-4">
            <div className="flex gap-2 items-center">
              <span className="w-2 h-2 rounded-full bg-tertiary/60 animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="w-2 h-2 rounded-full bg-tertiary/60 animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="w-2 h-2 rounded-full bg-tertiary/60 animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </div>
            <p className="text-secondary/60 font-body text-lg">Reading the energy...</p>
          </div>
        )}

        {/* Step: Result */}
        {step === 'result' && feedback && selectedType && (
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="material-symbols-outlined text-primary">
                {FEEDBACK_TEMPLATES.find(t => t.id === selectedType)?.icon}
              </span>
              <h3 className="font-label font-semibold text-on-surface text-lg">
                {FEEDBACK_TEMPLATES.find(t => t.id === selectedType)?.label} Feedback
              </h3>
            </div>

            <div className="glass-panel-solid bg-surface-container-high/60 text-on-surface px-6 py-5 rounded-lg rounded-tl-none border-tl-4 border-tertiary message-shadow">
              <p style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{feedback}</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleReset}
                className="flex-1 bg-surface-container-low border border-outline-variant/20 hover:border-primary/40 py-3 rounded-xl font-label font-semibold text-on-surface transition-all active:scale-[0.98]"
              >
                New Photo
              </button>
              <button
                onClick={handleClose}
                className="flex-1 bg-primary text-on-primary py-3 rounded-xl font-label font-semibold shadow-lg active:scale-[0.98] transition-all hover:bg-primary/90"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}