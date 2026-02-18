import {
  ActionIcon,
  CopyButton as MantineCopyButton,
  Tooltip,
} from '@mantine/core';
import { Check, Copy } from 'lucide-preact';

interface CopyButtonProps {
  value: string;
}

/**
 * Button that copies a value to clipboard
 */
export function CopyButton({ value }: CopyButtonProps) {
  return (
    <MantineCopyButton value={value}>
      {({ copied, copy }) => (
        <Tooltip label={copied ? 'Copied!' : 'Copy'} withArrow>
          <ActionIcon
            variant="subtle"
            color={copied ? 'teal' : 'gray'}
            onClick={(e: MouseEvent) => {
              e.stopPropagation();
              copy();
            }}
            size="sm"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </ActionIcon>
        </Tooltip>
      )}
    </MantineCopyButton>
  );
}
