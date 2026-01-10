import { ArrowUp } from 'lucide-preact';
import { useEffect, useState } from 'preact/hooks';
import styles from './ScrollToTop.module.css';

/**
 * Floating action button to scroll to top of page
 * Only visible when scrolled down
 */
export function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > 200);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <button
      type="button"
      class={`${styles.fab} ${visible ? styles.fabVisible : ''}`}
      onClick={scrollToTop}
      aria-label="Scroll to top"
    >
      <ArrowUp size={24} />
    </button>
  );
}
