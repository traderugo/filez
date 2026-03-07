import localFont from 'next/font/local'
import './globals.css'
import Header from '@/components/Header'

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  weight: '100 900',
})

export const metadata = {
  title: 'StationVA — Station Virtual Assistant',
  description: 'Manage your fuel station entries, subscriptions, and operations',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} font-sans antialiased`}>
        <Header />
        <main>{children}</main>
      </body>
    </html>
  )
}
