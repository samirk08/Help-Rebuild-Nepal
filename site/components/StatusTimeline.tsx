import { STATUSES } from "@/lib/site-data";

/**
 * The six states a request moves through, drawn as a connected sequence.
 *
 * The design showed these as a flat row of dots, which reads as a colour key
 * rather than a process. A request has an order — Submitted through Completed —
 * and showing the connection is the whole point of publishing it.
 */
export default function StatusTimeline({
  tr,
  orientation = "horizontal",
  label,
}: {
  tr: (value: string) => string;
  orientation?: "horizontal" | "vertical";
  label?: string;
}) {
  return (
    <div className="timeline" data-orientation={orientation}>
      {label ? <p className="timeline__label">{label}</p> : null}
      <ol className="timeline__list">
        {STATUSES.map((status) => (
          <li className="timeline__step" key={status.label}>
            <span
              className="timeline__marker"
              style={{ ["--dot-color" as string]: status.color }}
              aria-hidden="true"
            />
            <span className="timeline__text">{tr(status.label)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
