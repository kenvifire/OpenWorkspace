import { getMessages } from 'next-intl/server';
import { cookies } from 'next/headers';
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
  const cookieStore = await cookies();
  const initialTheme = cookieStore.get('theme')?.value ?? 'dark-purple';

  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `document.documentElement.dataset.theme=document.cookie.match(/(?:^|; )theme=([^;]+)/)?.[1]??'dark-purple'`,
        }}
      />
      <Providers locale={locale} messages={messages} lang={locale} initialTheme={initialTheme}>
        {children}
      </Providers>
    </>
  );
}
