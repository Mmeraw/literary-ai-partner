import styles from "./agent-readiness.module.css";

export default function AgentReadinessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className={styles.agentReadinessRoute}>{children}</div>;
}
