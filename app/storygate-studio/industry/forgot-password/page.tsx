import React from 'react';
import styles from '../storygate-studio.module.css';

export default function StorygateStudioPage() {
  return (
    <main className={styles.container}>
      <section className={styles.hero}>
        <h1>Storygate Studio</h1>
        <p>Professional manuscript evaluation & submission guidance</p>
        <div className={styles.ctaGroup}>
          <button className={styles.primary}>Get Started</button>
          <button className={styles.secondary}>Learn More</button>
        </div>
      </section>

      <section className={styles.features}>
        <div className={styles.featureCard}>
          <h2>Evaluate Manuscripts</h2>
          <p>Evidence-backed structural feedback and scoring.</p>
        </div>
        <div className={styles.featureCard}>
          <h2>Revise with Guidance</h2>
          <p>Author-controlled revisions with A/B/C suggestions.</p>
        </div>
        <div className={styles.featureCard}>
          <h2>Track Readiness</h2>
          <p>See your manuscript’s progress toward Storygate readiness.</p>
        </div>
      </section>
    </main>
  );
}
