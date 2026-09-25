import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col justify-center gap-6 text-center">
      <div>
        <h1 className="text-3xl font-bold text-brand-700">Tripster</h1>
        <p className="mt-2 text-gray-600">
          Stop arguing about the group trip in WhatsApp. Collect everyone&apos;s budget,
          dates, and dealbreakers in one link, and get a real shortlist.
        </p>
      </div>
      <Link
        href="/trip/new"
        className="rounded-xl bg-brand-500 px-6 py-3 font-semibold text-white shadow-sm active:bg-brand-600"
      >
        Start a new trip
      </Link>
      <Link href="/trips" className="text-sm font-medium text-brand-700">
        My trips
      </Link>
    </main>
  );
}
