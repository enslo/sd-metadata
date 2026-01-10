import { Check, Copy, X } from 'lucide-preact';
import { useState } from 'preact/hooks';
import styles from './CopyButton.module.css';

interface CopyButtonProps {
  value: string;
}

/**
 * Button that copies a value to clipboard
 */
export function CopyButton({ value }: CopyButtonProps) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'error'>('idle');

  const handleClick = async (e: Event) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setStatus('copied');
      setTimeout(() => setStatus('idle'), 1500);
    } catch {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 1500);
    }
  };

  const Icon = status === 'copied' ? Check : status === 'error' ? X : Copy;

  return (
    <button
      type="button"
      class={styles.copyBtn}
      title="Copy to clipboard"
      onClick={handleClick}
    >
      <Icon size={14} />
    </button>
  );
}
