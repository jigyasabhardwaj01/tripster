/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdfkit (a dependency of @react-pdf/renderer) loads its standard-font
  // data files (e.g. standard-fonts/Helvetica.cjs, data/*.afm) via a
  // computed require() path that Next's file tracer can't statically
  // follow, so Vercel's serverless bundle silently omits them — found live
  // as "Cannot find module '.../pdfkit/js/standard-fonts/Helvetica.cjs'"
  // on the very first production PDF download. Forcing the whole package
  // into the trace for that one route fixes it without pulling these into
  // every other route's bundle.
  experimental: {
    outputFileTracingIncludes: {
      "/api/sessions/[id]/itinerary": ["./node_modules/pdfkit/**/*", "./node_modules/@react-pdf/**/*"],
    },
  },
};

export default nextConfig;
