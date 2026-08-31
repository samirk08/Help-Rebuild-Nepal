import Link from "next/link";

import { createMatch } from "@/lib/admin-actions";
import { statusLabel } from "@/lib/admin-render";
import { bandLabel, dimensionLabel, signalText } from "@/lib/match-copy";
import type { RankedVolunteer } from "@/lib/matching";

/**
 * Ranked volunteers for one need, with the reasoning shown.
 *
 * What this replaces is an alphabetical dropdown of every verified volunteer,
 * which asked a coordinator to hold three hundred registrations in their head
 * and pick. The ranking does the reading; the person still decides, and the
 * button below each row is the same `createMatch` action the dropdown used —
 * the only thing that has changed is that the form now says the click came
 * from a suggestion, and at what position (migration 009).
 *
 * Everything the engine used is on screen: the score, how much of the
 * registration it rested on, the reasons for it, and the things a person
 * should check before making contact. A suggestion nobody can argue with is a
 * suggestion nobody should act on.
 */
export default function MatchSuggestions({
  needId,
  suggestions,
  startRank = 1,
}: {
  needId: string;
  suggestions: RankedVolunteer[];
  startRank?: number;
}) {
  if (suggestions.length === 0) return null;

  return (
    <ol className="matchlist">
      {suggestions.map((entry, index) => {
        const { volunteer, assessment } = entry;
        const rank = startRank + index;

        return (
          <li className="match" key={volunteer.id} data-band={assessment.band}>
            <div className="match__head">
              <div>
                <p className="match__name">
                  <Link href={`/admin/volunteers/${volunteer.id}`}>
                    {volunteer.name ?? "Unnamed registration"}
                  </Link>
                </p>
                <p className="match__meta">
                  {[
                    volunteer.district,
                    volunteer.primarySkill,
                    statusLabel(volunteer.status),
                    volunteer.activeMatches > 0
                      ? `${volunteer.activeMatches} other ${volunteer.activeMatches === 1 ? "match" : "matches"}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <div className="match__scorebox">
                <span className="match__score">{assessment.score}</span>
                <span className={`match__band match__band--${assessment.band}`}>
                  {bandLabel("en", assessment.band)}
                </span>
              </div>
            </div>

            <MatchBars assessment={assessment} />

            {assessment.reasons.length > 0 ? (
              <ul className="match__signals">
                {assessment.reasons.slice(0, 4).map((signal, i) => (
                  <li key={`${signal.code}-${i}`}>
                    <span className="match__tick" aria-hidden="true">
                      ✓
                    </span>{" "}
                    {signalText("en", signal)}
                  </li>
                ))}
              </ul>
            ) : null}

            {assessment.cautions.length > 0 ? (
              <ul className="match__signals match__signals--caution">
                {assessment.cautions.map((signal, i) => (
                  <li key={`${signal.code}-${i}`}>
                    <span className="match__tick" aria-hidden="true">
                      !
                    </span>{" "}
                    {signalText("en", signal)}
                  </li>
                ))}
              </ul>
            ) : null}

            <form action={createMatch} className="match__action">
              <input type="hidden" name="needId" value={needId} />
              <input type="hidden" name="volunteerId" value={volunteer.id} />
              <input type="hidden" name="source" value="suggested" />
              <input type="hidden" name="suggestedScore" value={assessment.score} />
              <input type="hidden" name="suggestedRank" value={rank} />
              <button type="submit" className="btn btn--outline btn--sm">
                Mark matched
              </button>
              <span className="match__confidence">
                {Math.round(assessment.confidence * 100)}% of the registration answered
              </span>
            </form>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * The score broken back into the dimensions it came from.
 *
 * A dimension with no answer behind it is drawn as an empty track labelled
 * "not stated" rather than as a zero bar. The difference matters: one says the
 * volunteer is a poor fit on that count, the other says nobody knows, and
 * they call for different things from whoever is reading.
 */
function MatchBars({ assessment }: { assessment: RankedVolunteer["assessment"] }) {
  return (
    <div className="match__bars">
      {assessment.dimensions.map((dimension) => (
        <div className="match__bar" key={dimension.id}>
          <span className="match__bar-label">{dimensionLabel("en", dimension.id)}</span>
          <span
            className="match__bar-track"
            data-empty={dimension.ratio === null ? "true" : undefined}
            role="img"
            aria-label={
              dimension.ratio === null
                ? `${dimensionLabel("en", dimension.id)}: not stated`
                : `${dimensionLabel("en", dimension.id)}: ${Math.round(dimension.ratio * 100)}%`
            }
          >
            {dimension.ratio === null ? null : (
              <span className="match__bar-fill" style={{ width: `${dimension.ratio * 100}%` }} />
            )}
          </span>
        </div>
      ))}
    </div>
  );
}
