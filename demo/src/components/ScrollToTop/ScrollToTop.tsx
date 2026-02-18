import { ActionIcon, Affix, Transition } from '@mantine/core';
import { useWindowScroll } from '@mantine/hooks';
import { ArrowUp } from 'lucide-preact';

/**
 * Floating action button to scroll to top of page
 * Only visible when scrolled down
 */
export function ScrollToTop() {
  const [scroll, scrollTo] = useWindowScroll();

  return (
    <Affix position={{ bottom: 20, right: 20 }} zIndex={100}>
      <Transition transition="slide-up" mounted={scroll.y > 200}>
        {(transitionStyles) => (
          <ActionIcon
            variant="filled"
            size="xl"
            radius="xl"
            aria-label="Scroll to top"
            style={transitionStyles}
            onClick={() => scrollTo({ y: 0 })}
          >
            <ArrowUp size={24} />
          </ActionIcon>
        )}
      </Transition>
    </Affix>
  );
}
