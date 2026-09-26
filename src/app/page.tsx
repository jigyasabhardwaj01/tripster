import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col justify-center gap-6 text-center">
      <div>
        <h1 className="text-3xl font-bold text-brand-700">Tripster</h1>
        <p className="mt-2 text-gray-600">
          Stop arguing about the group trip in WhatsApp. Everyone submits their budget, dates,
          and dealbreakers by a deadline — then AI finalizes one destination for the group.
        </p>
      </div>
      <Link
        href="/session/new"
        className="rounded-xl bg-brand-500 px-6 py-3 font-semibold text-white shadow-sm active:bg-brand-600"
      >
        Start a new trip
      </Link>
      <Link href="/sessions" className="text-sm font-medium text-brand-700">
        My trips
      </Link>
      <Link href="/trips" className="text-xs text-gray-400">
        Looking for an older trip?
      </Link>
    </main>
  );
}
