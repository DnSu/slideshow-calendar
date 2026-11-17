import styles from "./OfflineDot.module.css";
/** Small dim dot in a corner while the screen is showing saved content. */
export default function OfflineDot() {
  return (
    <div
      className={styles.offlineDot}
      role="status"
      aria-label="Offline: showing saved content"
    />
  );
}
