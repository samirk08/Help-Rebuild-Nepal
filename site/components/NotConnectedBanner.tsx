import { added } from "@/lib/added-strings";
import type { Lang } from "@/lib/content";

/**
 * Standing notice that a form does not store anything.
 *
 * This used to rely on a toast that appears after submission and disappears
 * after six seconds — long after someone has spent ten minutes filling in nine
 * sections believing they were registering. In a disaster that is the one way
 * this site could do real harm, so the warning is permanent and sits above the
 * form rather than after it.
 *
 * Delete this component when `app/api/submissions/route.ts` persists records.
 */
export default function NotConnectedBanner({ lang }: { lang: Lang }) {
  const t = added(lang);

  return (
    <aside className="notconnected" role="note">
      <p className="notconnected__title">{t.notConnectedTitle}</p>
      <p className="notconnected__body">{t.notConnectedBody}</p>
    </aside>
  );
}
