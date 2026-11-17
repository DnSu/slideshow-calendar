import type { EmptyReason } from "@/lib/emptyState";
import styles from "./NothingToShow.module.css";

type Props =
  | { reasons: EmptyReason[]; checkMinutes: number; unreachable?: false }
  | { unreachable: true; checkMinutes?: number; reasons?: undefined };

/** Shown instead of a black screen when there is nothing to show, saying why. */
export default function NothingToShow(props: Props) {
  if (props.unreachable) {
    return (
      <div className={styles.nothing} role="status">
        <div className={styles.title}>Starting up…</div>
        <div className={styles.lead}>
          This screen can&apos;t reach its server yet and has no saved content.
          It will keep trying, and the slideshow starts as soon as it connects.
        </div>
      </div>
    );
  }
  return (
    <div className={styles.nothing} role="status">
      <div className={styles.title}>Nothing to show right now</div>
      <div className={styles.lead}>
        There are no pictures, events or weather to display:
      </div>
      <ul className={styles.reasons}>
        {props.reasons.map((r) => (
          <li key={r.source}>
            <div className={styles.source}>{r.source}</div>
            <div className={styles.text}>{r.text}</div>
            {r.hint && <div className={styles.hint}>{r.hint}</div>}
          </li>
        ))}
      </ul>
      <div className={styles.footer}>
        This screen checks for new content every {props.checkMinutes} minutes.
      </div>
    </div>
  );
}
