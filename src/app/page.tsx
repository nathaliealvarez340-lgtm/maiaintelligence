export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#05050a] text-white flex items-center justify-center px-6">
      <section className="max-w-3xl">
        <p className="text-sm uppercase tracking-[0.35em] text-purple-300 mb-4">
          MAIA Intelligence Core
        </p>

        <h1 className="text-5xl font-semibold tracking-tight mb-6">
          Foundation Layer is online.
        </h1>

        <p className="text-lg text-zinc-300 leading-8">
          Sprint 1 is focused on authentication, tenant isolation,
          permissions, sensitive access, memory foundation and basic chat.
        </p>
      </section>
    </main>
  );
}