import Image from "next/image";
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col justify-center gap-6 text-center">
      <div className="relative -mx-4 -mt-6 mb-2 h-64 w-auto overflow-hidden">
        <Image
          src="/images/moods/beach/beach-papaya.jpg"
          alt=""
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/60 via-ink/0 to-ink/10" />
      </div>

      <div>
        <h1 className="font-headline text-4xl font-medium text-teal-700">Tripster</h1>
        <p className="mt-2 text-ink/60">
          Stop arguing about the group trip in WhatsApp. Everyone submits their budget, dates,
          and dealbreakers by a deadline, then AI finalizes one destination for the group.
        </p>
      </div>
      <Link
        href="/session/new"
        className="rounded-xl bg-teal px-6 py-3 font-semibold text-white shadow-sm active:bg-teal-700"
      >
        Start a new trip
      </Link>
      <Link href="/sessions" className="text-sm font-medium text-teal-700">
        My trips
      </Link>
      <Link href="/trips" className="text-xs text-ink/40">
        Looking for an older trip?
      </Link>
    </main>
  );
}
