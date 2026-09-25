import "./globals.css";

export const metadata = {
  title: "Factory Energy Management",
  description: "ระบบจัดการพลังงานโรงงาน",
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
