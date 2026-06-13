import styles from './report-page.module.css';

export default function ReportsJobLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className={styles.reportRoute}>{children}</div>;
}
