import "./globals.css";
import Sidebar from "./components/Sidebar";

export const metadata = {
  title: "Factory Energy Management",
  description: "ระบบจัดการพลังงานโรงงาน",
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body style={{ display: "flex", margin: 0, minHeight: "100vh" }}>
        <Sidebar />

        <main className="main-content" style={{ flex: 1, minWidth: 0 }}>
          {children}
        </main>
      </body>
    </html>
  );
}
