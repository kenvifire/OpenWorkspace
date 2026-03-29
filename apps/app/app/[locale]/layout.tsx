import { getMessages } from 'next-intl/server';
import { Providers } from '@/components/providers';
import { locales } from '@/i18n';
import type { Locale } from '@/i18n';
import { notFound } from 'next/navigation';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!locales.includes(locale as Locale)) notFound();

  const messages = await getMessages({ locale });

  return (
    <Providers locale={locale} messages={messages} lang={locale}>
      {children}
    </Providers>
  );
}
