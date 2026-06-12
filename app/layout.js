import { Open_Sans, Nunito } from 'next/font/google';
import '@/app/globals.css';
import ThemeProvider from '@/app/components/ThemeProvider';
import AppShell from '@/app/components/AppShell';

const openSans = Open_Sans({
  subsets: ['latin'],
  variable: '--font-open-sans',
  display: 'swap',
});

const nunito = Nunito({
  subsets: ['latin'],
  variable: '--font-nunito',
  display: 'swap',
});

export const metadata = {
  title: {
    template: '%s | National Beef AI Monitor',
    default: 'National Beef AI Monitor',
  },
  description: 'AI-powered safety, security, and operations monitoring platform for National Beef processing facilities.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${openSans.variable} ${nunito.variable}`} suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
