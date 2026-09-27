import Image from "next/image";
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col">
      <div className="relative left-1/2 -ml-[50vw] -mt-6 flex h-screen w-screen items-end overflow-hidden">
        <Image
          src="/images/moods/beach/beach-papaya.jpg"
          alt=""
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/10 to-ink/30" />
        <h1 className="relative px-6 pb-8 font-headline text-5xl font-medium text-white">Tripster</h1>
      </div>

      <div className="flex flex-col items-center gap-6 pt-6 text-center">
        <p className="text-ink/60">
          Stop arguing about the group trip in WhatsApp. Everyone submits their budget, dates,
          and dealbreakers by a deadline, then AI finalizes one destination for the group.
        </p>
        <Link
          href="/session/new"
          className="w-full rounded-xl bg-teal px-6 py-3 text-center font-semibold text-white shadow-sm active:bg-teal-700"
        >
          Start a new trip
        </Link>
        <Link href="/sessions" className="text-sm font-medium text-teal-700">
          My trips
        </Link>
        <Link href="/trips" className="text-xs text-ink/40">
          Looking for an older trip?
        </Link>
      </div>
    </main>
  );
}
