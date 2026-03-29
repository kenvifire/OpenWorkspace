'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';

export default function SignUpPage() {
  const router = useRouter();
  const locale = useLocale();
  useEffect(() => { router.replace(`/${locale}/sign-in`); }, [router, locale]);
  return null;
}
