import type { ReactNode } from 'react';
import styles from './report-page.module.css';

export default function ReportsJobLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <div className={styles.reportRoute}>{children}</div>;
}
