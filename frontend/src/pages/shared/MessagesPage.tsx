import { MessageSquare } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { PageHeading } from '@/components/shared/page-heading';
import { StateMessage } from '@/components/shared/state-message';
import { ConversationList } from '@/features/chat/components/ConversationList';
import { MessageThread } from '@/features/chat/components/MessageThread';
import { useConversations } from '@/features/chat/hooks';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import type { ConversationView } from '@/lib/api-types';
import { cn } from '@/lib/utils';

/** Shared chat surface for clients and restaurant admins (same components,
 *  same endpoints; the counterpart shown adapts to the viewer's role). The
 *  active conversation lives in the URL (`?c=`), so the bell can deep-link. */
export function MessagesPage() {
  useDocumentTitle('Mensajes');
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('c');
  const { data } = useConversations();
  const selected = data?.items.find((c) => c.id === selectedId) ?? null;

  const select = (c: ConversationView) => setParams({ c: c.id });
  const clear = () => setParams({});

  return (
    <>
      <PageHeading
        title="Mensajes"
        description="Conversa en tiempo real sobre tu pensión."
      />
      <div className="grid h-[calc(100dvh-13rem)] min-h-[30rem] overflow-hidden rounded-lg border border-border bg-surface md:grid-cols-[20rem_1fr]">
        <div className={cn('min-h-0 border-border md:border-r', selected && 'hidden md:block')}>
          <ConversationList selectedId={selectedId} onSelect={select} />
        </div>
        <div className={cn('min-h-0', selected ? 'block' : 'hidden md:block')}>
          {selected ? (
            <MessageThread conversation={selected} onBack={clear} />
          ) : (
            <div className="flex h-full items-center justify-center p-6">
              <StateMessage
                icon={MessageSquare}
                title="Selecciona una conversación"
                description="Elige un chat de la lista para ver los mensajes."
                className="border-0"
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
