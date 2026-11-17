import React, { useState, useEffect } from 'react';
import { X, Send, CheckCircle2, Mail, MessageSquare } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { safeFetchJson } from '../utils/apiClient';
import { contactFormSchema, formatZodFieldErrors } from '../schemas/validation';
import { Button } from './ui/button';
import { Input } from './ui/input';

interface InquiryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InquiryModal: React.FC<InquiryModalProps> = ({ isOpen, onClose }) => {
  const { user, token } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      setName((prev) => prev || user.name || '');
      setEmail((prev) => prev || user.email || '');
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  const handleClose = () => {
    setErrors({});
    setSubmitted(false);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const parse = contactFormSchema.safeParse({
      name,
      email,
      subject,
      message,
      source: 'creator_studio',
    });

    if (!parse.success) {
      setErrors(formatZodFieldErrors(parse.error));
      return;
    }

    setIsSubmitting(true);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const res = await safeFetchJson<{
        success: boolean;
        message?: string;
        error?: string;
        errors?: Record<string, string>;
      }>('/api/inquiries', {
        method: 'POST',
        headers,
        body: JSON.stringify(parse.data),
      });

      if (!res.ok || !res.data?.success) {
        if (res.data?.errors) {
          setErrors(res.data.errors);
        } else {
          setErrors({
            _global: res.data?.error || res.error || 'Could not send your inquiry. Please try again.',
          });
        }
        return;
      }

      setSubmitted(true);
      setSubject('');
      setMessage('');
    } catch (err: any) {
      setErrors({
        _global: err?.message || 'Network error sending inquiry. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#181818] border border-[#282828] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-[#282828] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#1db954]/15 border border-[#1db954]/30 text-[#3fb970] flex items-center justify-center">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#e4e7ec] font-display">
                Send Inquiry to Support &amp; Admin
              </h3>
              <p className="text-xs text-[#9ca3af]">
                Questions about credits, custom plans, or technical support
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 text-[#9ca3af] hover:text-[#e4e7ec] rounded-full hover:bg-[#282828] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6">
          {submitted ? (
            <div className="py-8 text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 text-[#3fb970] mx-auto" />
              <h4 className="text-base font-bold text-[#e4e7ec]">Inquiry Submitted</h4>
              <p className="text-xs text-[#9ca3af] max-w-sm mx-auto leading-relaxed">
                Your inquiry has been delivered to the Scriby administration team. We will review and respond to <span className="text-[#d0d5dd] font-mono">{email}</span> shortly.
              </p>
              <div className="pt-2 flex items-center justify-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSubmitted(false)}
                  className="text-xs cursor-pointer"
                >
                  Send Another Inquiry
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleClose}
                  className="bg-[#1db954] hover:bg-[#1aa34a] text-[#08100b] font-semibold text-xs cursor-pointer"
                >
                  Done
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errors._global && (
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-xs text-rose-300">
                  {errors._global}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#9ca3af] block mb-1">Your Name</label>
                  <Input
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (errors.name) setErrors({ ...errors, name: '' });
                    }}
                    placeholder="Your name"
                    className="text-xs bg-[#121212] border-[#2e2e2e]"
                  />
                  {errors.name && <p className="text-xs text-rose-400 mt-1">{errors.name}</p>}
                </div>

                <div>
                  <label className="text-xs text-[#9ca3af] block mb-1">Email Address</label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errors.email) setErrors({ ...errors, email: '' });
                    }}
                    placeholder="you@studio.com"
                    className="text-xs bg-[#121212] border-[#2e2e2e]"
                  />
                  {errors.email && <p className="text-xs text-rose-400 mt-1">{errors.email}</p>}
                </div>
              </div>

              <div>
                <label className="text-xs text-[#9ca3af] block mb-1">Subject</label>
                <Input
                  type="text"
                  value={subject}
                  onChange={(e) => {
                    setSubject(e.target.value);
                    if (errors.subject) setErrors({ ...errors, subject: '' });
                  }}
                  placeholder="e.g. Custom quota request or billing question"
                  className="text-xs bg-[#121212] border-[#2e2e2e]"
                />
                {errors.subject && <p className="text-xs text-rose-400 mt-1">{errors.subject}</p>}
              </div>

              <div>
                <label className="text-xs text-[#9ca3af] block mb-1">Inquiry Message</label>
                <textarea
                  rows={4}
                  value={message}
                  onChange={(e) => {
                    setMessage(e.target.value);
                    if (errors.message) setErrors({ ...errors, message: '' });
                  }}
                  placeholder="Share details of your question, issue, or agency requirements..."
                  className="w-full px-3.5 py-2.5 bg-[#121212] border border-[#2e2e2e] rounded-xl text-sm text-[#d0d5dd] placeholder-[#6f7682] focus:outline-none focus:border-[#1db954]/60 transition-colors"
                />
                {errors.message && <p className="text-xs text-rose-400 mt-1">{errors.message}</p>}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[#282828]">
                <div className="flex items-center gap-1.5 text-xs text-[#6f7682]">
                  <Mail className="w-3.5 h-3.5 text-[#3fb970]" />
                  <span>Direct to SuperAdmin Inbox</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2 rounded-full bg-[#242424] hover:bg-[#2e2e2e] text-xs font-medium text-[#d0d5dd] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    size="sm"
                    className="bg-[#1db954] hover:bg-[#1aa34a] text-[#08100b] font-bold text-xs px-5 rounded-full flex items-center gap-1.5 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSubmitting ? 'Sending...' : 'Send Inquiry'}</span>
                  </Button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
