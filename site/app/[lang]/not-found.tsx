import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page page--narrow">
      <h1 className="h1 h1--page">Page not found</h1>
      <p className="intro">
        That page does not exist. No requests have been published yet, so most request links are
        not live.
      </p>
      <div className="btn-row">
        <Link href="/en" className="btn btn--green btn--sm">
          Go to the home page
        </Link>
        <Link href="/en/needs" className="btn btn--outline btn--sm">
          Open the needs dashboard
        </Link>
      </div>
    </div>
  );
}
