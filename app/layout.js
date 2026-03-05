import localFont from 'next/font/local'
import './globals.css'
import Header from '@/components/Header'

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  weight: '100 900',
})

export const metadata = {
  title: 'FilePortal — Your Files, Organized',
  description: 'Subscription-based file portal for businesses',
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
