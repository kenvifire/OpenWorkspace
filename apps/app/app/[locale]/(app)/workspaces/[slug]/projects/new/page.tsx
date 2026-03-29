'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { workspacesApi, projectsApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export default function NewProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const locale = useLocale();
  const qc = useQueryClient();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const { data: workspace } = useQuery({
    queryKey: ['workspace', slug],
    queryFn: () => workspacesApi.get(slug),
  });

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => projectsApi.create(workspace!.id, { name, description }),
    onSuccess: (project) => {
      qc.invalidateQueries({ queryKey: ['projects', workspace!.id] });
      router.push(`/${locale}/workspaces/${slug}/projects/${project.id}/board`);
    },
  });

  return (
    <div className="flex min-h-screen items-start justify-center p-8">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>New project</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Project name</Label>
            <Input placeholder="e.g. Website Redesign" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Description / Requirements</Label>
            <Textarea
              placeholder="Describe the project goals, scope, and requirements…"
              rows={6}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
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
            <Button variant="outline" className="flex-1" onClick={() => router.back()}>Cancel</Button>
            <Button
              className="flex-1"
              disabled={!name || !description || !workspace || isPending}
              onClick={() => mutate()}
            >
              {isPending ? 'Creating…' : 'Create project'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
