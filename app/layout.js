import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import '@/app/globals.css';
import ThemeProvider from '@/app/components/ThemeProvider';
import AuthProvider from '@/app/components/AuthProvider';
import AppShell from '@/app/components/AppShell';

export const metadata = {
  title: {
    template: '%s | National Beef AI Monitor',
    default: 'National Beef AI Monitor',
  },
  description: 'AI-powered safety, security, and operations monitoring platform for National Beef processing facilities.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <AuthProvider>
            <AppShell>{children}</AppShell>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
