import Image from "next/image";
import Link from "next/link";

import { added } from "@/lib/added-strings";
import type { Dict, Lang } from "@/lib/content";
import { translator } from "@/lib/i18n";
import { screenPath, type ScreenKey } from "@/lib/routes";
import { FOOTER_COLUMNS } from "@/lib/site-data";

export default function Footer({ lang, t }: { lang: Lang; t: Dict }) {
  const tr = translator(lang);

  return (
    <footer className="footer">
      <div className="footer__inner">
        <div>
          <div className="footer__logo">
            <Image src="/logo.png" alt="Help Rebuild Nepal" width={84} height={44} />
          </div>
          <p className="footer__tagline">{t.footerTagline}</p>
        </div>

        {FOOTER_COLUMNS.map((col) => (
          <div key={col.title}>
            <h2 className="footer__coltitle">{tr(col.title)}</h2>
            <div className="footer__links">
              {col.items.map((item) => (
                <Link
                  key={item.label}
                  href={screenPath(lang, item.screen as ScreenKey)}
                  className="footer__link"
                >
                  {/* Relief items post-dates the design, so its Nepali lives in
                      added-strings rather than the generated NP_MAP. */}
                  {item.screen === "relief" ? added(lang).reliefNav : tr(item.label)}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="footer__bar">
        {/* Not t.footerNote: the generated string still says the forms are not
            connected, which stopped being true when the backend shipped. */}
        <p className="footer__note">{added(lang).footerNote}</p>
      </div>
    </footer>
  );
}
