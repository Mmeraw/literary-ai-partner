import styles from "./cockpit.module.css";

export default function Layout(props: any) {
  return <div className={styles.cockpit}>{props.children}</div>;
}
