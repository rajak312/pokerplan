'use client';

import { Check, Link2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button, type ButtonProps } from '@/components/ui/button';

export function inviteUrl(roomId: string): string {
  return `${window.location.origin}/r/${roomId}`;
}

export function InviteButton({
  roomId,
  label = 'Invite',
  ...props
}: { roomId: string; label?: string } & ButtonProps) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const url = inviteUrl(roomId);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Invite link copied', { description: url });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this invite link:', url);
    }
  };
  return (
    <Button onClick={copy} aria-label="Copy invite link" {...props}>
      {copied ? <Check className="size-4" /> : <Link2 className="size-4" />}
      {copied ? 'Copied' : label}
    </Button>
  );
}
