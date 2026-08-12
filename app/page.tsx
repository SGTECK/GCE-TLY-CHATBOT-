import ChatWindow from "@/components/ChatWindow";

export default function Home() {
  return (
    <main className="min-h-screen w-full flex items-center justify-center p-4 bg-mist dark:bg-night transition-colors">
      <div className="pointer-events-none fixed rounded-full blur-3xl opacity-60" style={{ width: 340, height: 340, left: "8%", top: "6%", background: "radial-gradient(circle, rgba(76,95,213,.5) 0%, rgba(76,95,213,0) 70%)" }} />
      <div className="pointer-events-none fixed rounded-full blur-3xl opacity-60" style={{ width: 340, height: 340, right: "10%", bottom: "6%", background: "radial-gradient(circle, rgba(23,195,162,.45) 0%, rgba(23,195,162,0) 70%)" }} />
      <ChatWindow />
    </main>
  );
}
