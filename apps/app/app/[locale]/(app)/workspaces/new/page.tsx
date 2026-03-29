'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { workspacesApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function NewWorkspacePage() {
  const router = useRouter();
  const locale = useLocale();
  const qc = useQueryClient();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => workspacesApi.create({ name, slug }),
    onSuccess: (ws) => {
      qc.invalidateQueries({ queryKey: ['workspaces'] });
      router.push(`/${locale}/workspaces/${ws.slug}`);
    },
    onError: (err) => {
      console.error('[workspace create] error:', err);
    },
  });

  const handleNameChange = (v: string) => {
    setName(v);
    setSlug(v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
  };

  return (
    <div className="flex min-h-screen items-start justify-center p-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create a workspace</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="Acme Corp"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              placeholder="acme-corp"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
            <p className="text-xs text-zinc-500">Unique URL identifier — lowercase letters, numbers, and hyphens only.</p>
          </div>
          {error && (
            <p className="text-sm text-red-500">
              {(() => {
                const msg = (error as any)?.response?.data?.message;
                if (typeof msg === 'string') return msg;
                if (Array.isArray(msg)) return msg[0];
                if (msg?.message) return msg.message;
                return (error as Error)?.message ?? 'Something went wrong';
              })()}
            </p>
          )}
          <div className="flex gap-2 pt-2">
            <Button onClick={() => router.back()} variant="outline" className="flex-1">Cancel</Button>
            <Button onClick={() => mutate()} disabled={!name || !slug || isPending} className="flex-1">
              {isPending ? 'Creating…' : 'Create'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
