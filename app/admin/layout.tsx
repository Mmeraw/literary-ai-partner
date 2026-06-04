import styles from "./admin-readable.module.css";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className={`admin-route ${styles.adminRoute}`}>{children}</div>;
}
