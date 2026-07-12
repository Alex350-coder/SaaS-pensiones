import { Send } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface MessageComposerProps {
  disabled?: boolean;
  /** Returns true when the send succeeded (clears the input). */
  onSend: (content: string) => Promise<boolean>;
}

export function MessageComposer({ disabled, onSend }: MessageComposerProps) {
  const [value, setValue] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async () => {
    const content = value.trim();
    if (!content || sending || disabled) return;
    setSending(true);
    const ok = await onSend(content);
    setSending(false);
    if (ok) setValue('');
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends; Shift+Enter inserts a newline.
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      className="flex items-end gap-2 border-t border-border p-3"
    >
      <label htmlFor="message-input" className="sr-only">
        Mensaje
      </label>
      <Textarea
        id="message-input"
        rows={1}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled || sending}
        placeholder={
          disabled ? 'La pensión ya no está vigente (solo lectura)' : 'Escribe un mensaje…'
        }
        className="max-h-32 resize-none"
      />
      <Button
        type="submit"
        size="icon"
        aria-label="Enviar mensaje"
        loading={sending}
        disabled={disabled || value.trim().length === 0}
      >
        <Send aria-hidden="true" />
      </Button>
    </form>
  );
}
