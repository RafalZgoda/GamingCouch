import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'GamingCouch',
  description: 'Party gaming platform — phone as controller',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
