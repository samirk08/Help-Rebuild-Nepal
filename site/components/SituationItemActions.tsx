import MatchingActionForm from "./MatchingActionForm";
import {
  resolveQueueItem,
  snoozeQueueItem,
  updateQueueItem,
} from "@/lib/situation/actions";
import { QUEUE_PRIORITIES, type Coordinator, type QueueItem } from "@/lib/situation/types";
import type { ActionState } from "@/lib/matching/validation";

export default function SituationItemActions({
  item,
  coordinators,
  updateAction = updateQueueItem,
  snoozeAction = snoozeQueueItem,
  resolveAction = resolveQueueItem,
}: {
  item: QueueItem;
  coordinators: Coordinator[];
  updateAction?: (state: ActionState, form: FormData) => Promise<ActionState>;
  snoozeAction?: (state: ActionState, form: FormData) => Promise<ActionState>;
  resolveAction?: (state: ActionState, form: FormData) => Promise<ActionState>;
}) {
  const dueValue = item.dueAt ? item.dueAt.slice(0, 10) : "";

  return (
    <div className="situation-actions">
      <MatchingActionForm action={updateAction} label="Save">
        <input type="hidden" name="itemKey" value={item.key} />
        <label>
          Owner
          <select name="ownerId" defaultValue={item.ownerId ?? ""} aria-label={`Owner for ${item.subject}`}>
            <option value="">Unassigned</option>
            {coordinators.map((person) => (
              <option key={person.id} value={person.id}>
                {person.email}
              </option>
            ))}
          </select>
        </label>
        <label>
          Due
          <input type="date" name="dueAt" defaultValue={dueValue} aria-label={`Due date for ${item.subject}`} />
        </label>
        <label>
          Priority
          <select name="priority" defaultValue={item.priority} aria-label={`Priority for ${item.subject}`}>
            {QUEUE_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
        </label>
      </MatchingActionForm>

      {item.state === "resolved" ? null : (
        <>
          <MatchingActionForm action={snoozeAction} label="Snooze">
            <input type="hidden" name="itemKey" value={item.key} />
            <label>
              Days
              <input
                type="number"
                name="snoozeDays"
                min={1}
                max={30}
                defaultValue={2}
                aria-label={`Snooze days for ${item.subject}`}
              />
            </label>
          </MatchingActionForm>
          <MatchingActionForm action={resolveAction} label="Mark dealt with">
            <input type="hidden" name="itemKey" value={item.key} />
          </MatchingActionForm>
        </>
      )}
    </div>
  );
}
