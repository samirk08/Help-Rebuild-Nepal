import Link from "next/link";

import SituationItemActions from "@/components/SituationItemActions";
import { SKILLS } from "@/lib/matching/catalog";
import { ITEM_KIND_LABEL } from "@/lib/situation/keys";
import { loadQueue } from "@/lib/situation/data";
import { formatAge, metricsView } from "@/lib/situation/metrics";
import { parseQueueQuery, queueSearchParams, FILTER_KINDS } from "@/lib/situation/query";
import {
  resolveQueueItem,
  snoozeQueueItem,
  updateQueueItem,
} from "@/lib/situation/actions";
import { QUEUE_PRIORITIES, type QueueEvent, type QueueItem } from "@/lib/situation/types";
import { listMissions } from "@/lib/missions";

export const dynamic = "force-dynamic";

const PRIORITY_BADGE: Record<string, string> = {
  urgent: "rejected",
  high: "submitted",
  normal: "under_review",
  low: "filled",
};

export default async function SituationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = parseQueueQuery(params);
  const [result, missions] = await Promise.all([loadQueue(query), listMissions()]);

  if (result.state === "unavailable") {
    const metrics = metricsView(result, new Date().toISOString());
    return (
      <div>
        <Header handover={query.handover} />
        <Metrics tiles={metrics} />
        <div className="admin-empty">
          <p className="admin-empty__title">Situation Room is unavailable</p>
          <p className="admin-empty__hint">
            The queue could not be loaded, so these figures are not zero — they are unknown. {result.reason}
          </p>
        </div>
      </div>
    );
  }

  const { snapshot, metrics, visible, page, pages, total, now, coordinators, events } = result.data;
  const eventsByKey = new Map<string, QueueEvent[]>();
  for (const event of events) {
    const list = eventsByKey.get(event.item_key) ?? [];
    list.push(event);
    eventsByKey.set(event.item_key, list);
  }

  return (
    <div>
      <Header handover={query.handover} />
      <Metrics tiles={metrics} />

      {!snapshot.assignmentsAvailable ? (
        <p className="admin-banner" role="status">
          Assignment, snooze and resolve are not stored yet. Apply <code>supabase/016-situation-room.sql</code>.
        </p>
      ) : null}

      <p className="admin-head__note" style={{ marginTop: 0, marginBottom: 16 }}>
        {total === 0
          ? query.handover
            ? "Nothing currently assigned to this coordinator."
            : "Nothing in this view of the queue."
          : `${total} ${total === 1 ? "item" : "items"} · page ${page} of ${pages}`}
        {!snapshot.matchingAvailable
          ? " Matching-derived items are absent until migration 010 is applied."
          : ""}
        {!snapshot.requesterEventsAvailable
          ? " Requester feedback items are absent until migration 014 is applied."
          : ""}
      </p>

      <form className="admin-filters" method="get">
        {query.handover ? <input type="hidden" name="view" value="handover" /> : null}
        <input
          type="search"
          name="q"
          placeholder="Search subject"
          defaultValue={query.q}
          aria-label="Search the queue"
        />
        <select name="type" defaultValue={query.kind} aria-label="Filter by type">
          <option value="">Any type</option>
          {FILTER_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {ITEM_KIND_LABEL[kind]}
            </option>
          ))}
        </select>
        <select name="owner" defaultValue={query.owner} aria-label="Filter by owner">
          <option value="">Any owner</option>
          <option value="unassigned">Unassigned</option>
          {coordinators.map((person) => (
            <option key={person.id} value={person.id}>
              {person.email}
            </option>
          ))}
        </select>
        <select name="priority" defaultValue={query.priority} aria-label="Filter by priority">
          <option value="">Any priority</option>
          {QUEUE_PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>
              {priority}
            </option>
          ))}
        </select>
        <select name="state" defaultValue={query.state} aria-label="Filter by status">
          <option value="open">Open</option>
          <option value="snoozed">Snoozed</option>
          <option value="resolved">Dealt with</option>
          <option value="overdue">Overdue</option>
          <option value="all">All</option>
        </select>
        <select name="skill" defaultValue={query.skill} aria-label="Filter by skill">
          <option value="">Any skill</option>
          {SKILLS.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
        {missions.length > 0 ? (
          <select name="mission" defaultValue={query.mission} aria-label="Filter by mission">
            <option value="">Any mission</option>
            {missions.map((mission) => (
              <option key={mission.id} value={mission.id}>
                {mission.title}
              </option>
            ))}
          </select>
        ) : null}
        <button type="submit" className="btn btn--outline btn--sm">
          Filter
        </button>
        <Link href="/admin/situation" className="btn btn--outline btn--sm">
          Clear
        </Link>
        <Link
          href={`/admin/situation${queueSearchParams({ ...query, handover: true, page: 1, owner: query.owner })}`}
          className="btn btn--outline btn--sm admin-filters__end"
        >
          Handover view
        </Link>
      </form>

      {query.handover ? (
        <HandoverList
          items={visible}
          coordinators={coordinators}
          eventsByKey={eventsByKey}
          now={now}
        />
      ) : (
        <QueueTable
          items={visible}
          coordinators={coordinators}
          eventsByKey={eventsByKey}
          now={now}
        />
      )}

      {pages > 1 ? (
        <nav className="situation-pager" aria-label="Queue pages">
          {page > 1 ? (
            <Link href={`/admin/situation${queueSearchParams(query, { page: page - 1 })}`}>Previous</Link>
          ) : (
            <span>Previous</span>
          )}
          <span>
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <Link href={`/admin/situation${queueSearchParams(query, { page: page + 1 })}`}>Next</Link>
          ) : (
            <span>Next</span>
          )}
        </nav>
      ) : null}
    </div>
  );
}

function Header({ handover }: { handover: boolean }) {
  return (
    <div className="admin-head">
      <div>
        <h1 className="admin-h1">{handover ? "Handover" : "Situation Room"}</h1>
        <p className="admin-head__note">
          {handover
            ? "Everything currently assigned to one coordinator, in one list."
            : "What needs a human next. Items are derived from live records; assigning, snoozing or marking dealt with does not change the record itself."}
        </p>
      </div>
    </div>
  );
}

function Metrics({ tiles }: { tiles: { open: string; overdue: string; oldest: string } }) {
  const unavailable = tiles.open === "Unavailable";
  return (
    <div className="admin-stats">
      <div className={`admin-stat ${unavailable ? "admin-stat--unavailable" : "admin-stat--amber"}`}>
        <p className="admin-stat__value">{tiles.open}</p>
        <p className="admin-stat__label">Open items</p>
      </div>
      <div className={`admin-stat ${unavailable ? "admin-stat--unavailable" : "admin-stat--navy"}`}>
        <p className="admin-stat__value">{tiles.oldest}</p>
        <p className="admin-stat__label">Oldest waiting</p>
      </div>
      <div className={`admin-stat ${unavailable ? "admin-stat--unavailable" : "admin-stat--green"}`}>
        <p className="admin-stat__value">{tiles.overdue}</p>
        <p className="admin-stat__label">Overdue</p>
      </div>
    </div>
  );
}

function QueueTable({
  items,
  coordinators,
  eventsByKey,
  now,
}: {
  items: QueueItem[];
  coordinators: { id: string; email: string }[];
  eventsByKey: Map<string, QueueEvent[]>;
  now: string;
}) {
  if (items.length === 0) {
    return (
      <div className="admin-empty">
        <p className="admin-empty__title">Nothing waiting in this view</p>
        <p className="admin-empty__hint">
          Open items appear here when a need is awaiting verification, an invitation needs follow-up,
          a profile is stale, or similar. An empty list means none of those are true right now — not
          that the queue failed to load.
        </p>
      </div>
    );
  }

  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Type</th>
            <th>Item</th>
            <th>Owner</th>
            <th>Next action</th>
            <th>Due</th>
            <th>Priority</th>
            <th>Waiting</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.key}>
              <td>{ITEM_KIND_LABEL[item.kind]}</td>
              <td>
                <Link href={item.href}>{item.subject}</Link>
                <Activity events={eventsByKey.get(item.key) ?? []} compact />
              </td>
              <td>{item.ownerLabel}</td>
              <td>{item.nextAction}</td>
              <td className="admin-table__time">{item.dueAt ? new Date(item.dueAt).toLocaleDateString() : "—"}</td>
              <td>
                <span className={`admin-badge admin-badge--${PRIORITY_BADGE[item.priority] ?? "filled"}`}>
                  {item.priority}
                </span>
              </td>
              <td className="admin-table__time">{formatAge(Date.parse(now) - Date.parse(item.waitingSince))}</td>
              <td>
                <SituationItemActions
                  item={item}
                  coordinators={coordinators}
                  updateAction={updateQueueItem}
                  snoozeAction={snoozeQueueItem}
                  resolveAction={resolveQueueItem}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HandoverList({
  items,
  coordinators,
  eventsByKey,
  now,
}: {
  items: QueueItem[];
  coordinators: { id: string; email: string }[];
  eventsByKey: Map<string, QueueEvent[]>;
  now: string;
}) {
  if (items.length === 0) {
    return (
      <div className="admin-empty">
        <p className="admin-empty__title">Nothing to hand over</p>
        <p className="admin-empty__hint">
          Choose a coordinator in the owner filter to see their assigned open and snoozed items.
        </p>
      </div>
    );
  }

  return (
    <div className="situation-handover">
      {items.map((item) => (
        <article key={item.key} className="situation-handover__item">
          <p className="situation-handover__type">{ITEM_KIND_LABEL[item.kind]}</p>
          <h2>
            <Link href={item.href}>{item.subject}</Link>
          </h2>
          <p>
            <strong>Next:</strong> {item.nextAction}
          </p>
          <p>
            Owner {item.ownerLabel} · due{" "}
            {item.dueAt ? new Date(item.dueAt).toLocaleDateString() : "not specified"} · {item.priority} · waiting{" "}
            {formatAge(Date.parse(now) - Date.parse(item.waitingSince))}
            {item.state === "snoozed" && item.snoozedUntil
              ? ` · snoozed until ${new Date(item.snoozedUntil).toLocaleDateString()}`
              : ""}
          </p>
          <Activity events={eventsByKey.get(item.key) ?? []} compact={false} />
          <SituationItemActions
            item={item}
            coordinators={coordinators}
            updateAction={updateQueueItem}
            snoozeAction={snoozeQueueItem}
            resolveAction={resolveQueueItem}
          />
        </article>
      ))}
    </div>
  );
}

function Activity({ events, compact }: { events: QueueEvent[]; compact: boolean }) {
  if (events.length === 0) {
    return compact ? null : <p className="situation-log situation-log--empty">No activity yet.</p>;
  }
  const shown = compact ? events.slice(0, 3) : events;
  return (
    <ol className={compact ? "situation-log situation-log--compact" : "situation-log"}>
      {shown.map((event) => (
        <li key={event.id}>
          <span>{event.event.replace(/_/g, " ")}</span>
          {event.detail ? ` — ${event.detail}` : ""}
          <time dateTime={event.created_at}> {new Date(event.created_at).toLocaleString()}</time>
        </li>
      ))}
    </ol>
  );
}
