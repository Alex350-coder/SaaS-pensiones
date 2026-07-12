import { Megaphone, Send } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { PageHeading } from '@/components/shared/page-heading';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { usePublishNotice, useMyNotices } from '@/features/notices/hooks';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { ApiError } from '@/lib/api-client';
import type { NoticeType } from '@/lib/api-types';
import { formatDateTime } from '@/lib/format';

const NOTICE_TYPES: { value: NoticeType; label: string }[] = [
  { value: 'GENERAL', label: 'General' },
  { value: 'MENU_CHANGE', label: 'Cambio de menú' },
  { value: 'SCHEDULE_CHANGE', label: 'Horario' },
  { value: 'PROMOTION', label: 'Promoción' },
  { value: 'CLOSURE', label: 'Cierre' },
];

export function NoticesPage() {
  useDocumentTitle('Avisos');
  const publish = usePublishNotice();
  const { data, isLoading } = useMyNotices();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState<NoticeType>('GENERAL');

  const canSubmit = title.trim().length > 0 && body.trim().length > 0;

  const handlePublish = () => {
    if (!canSubmit) return;
    publish.mutate(
      { title: title.trim(), body: body.trim(), type },
      {
        onSuccess: (result) => {
          toast.success(
            `Aviso enviado a ${result.recipientCount} pensionario(s).`,
          );
          setTitle('');
          setBody('');
          setType('GENERAL');
        },
        onError: (error) =>
          toast.error(
            error instanceof ApiError ? error.message : 'No se pudo publicar.',
          ),
      },
    );
  };

  return (
    <>
      <PageHeading
        title="Avisos"
        description="Comunica cambios de menú, horarios, promociones o cierres a tus pensionarios activos."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nuevo aviso</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="notice-title">Título</Label>
              <Input
                id="notice-title"
                maxLength={140}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej. Cambio en el menú del viernes"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notice-type">Tipo</Label>
              <select
                id="notice-type"
                value={type}
                onChange={(e) => setType(e.target.value as NoticeType)}
                className="flex h-11 w-full rounded-md border border-border bg-surface px-3.5 text-sm text-text focus-visible:border-primary focus-visible:shadow-focus-ring focus-visible:outline-none"
              >
                {NOTICE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notice-body">Mensaje</Label>
              <Textarea
                id="notice-body"
                rows={5}
                maxLength={4000}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Escribe el aviso…"
                className="resize-none"
              />
            </div>
            <Button
              disabled={!canSubmit}
              loading={publish.isPending}
              onClick={handlePublish}
            >
              <Send aria-hidden="true" />
              Publicar aviso
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Avisos publicados</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (data?.items.length ?? 0) === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <Megaphone className="size-8 text-text-muted" aria-hidden="true" />
                <p className="text-sm text-text-muted">
                  Aún no publicaste avisos.
                </p>
              </div>
            ) : (
              <ul className="space-y-4">
                {data?.items.map((notice) => (
                  <li
                    key={notice.id}
                    className="border-b border-border pb-4 last:border-0 last:pb-0"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-text">{notice.title}</p>
                      <span className="shrink-0 text-xs text-text-muted">
                        {notice.readCount} leído(s)
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-text-muted text-pretty">
                      {notice.body}
                    </p>
                    <p className="mt-1 text-xs text-text-muted">
                      {formatDateTime(notice.publishedAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
