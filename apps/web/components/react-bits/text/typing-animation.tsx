'use client';

import { useEffect, useRef, useState } from 'react';

interface TypingAnimationProps {
  text: string;
  className?: string;
  typingSpeed?: number;
  initialDelay?: number;
  showCursor?: boolean;
  cursorCharacter?: string;
  cursorClassName?: string;
  loop?: boolean;
  pauseDuration?: number;
  deletingSpeed?: number;
  onComplete?: () => void;
}

export default function TypingAnimation({
  text,
  className = '',
  typingSpeed = 50,
  initialDelay = 0,
  showCursor = true,
  cursorCharacter = '|',
  cursorClassName = '',
  loop = false,
  pauseDuration = 2000,
  deletingSpeed = 30,
  onComplete,
}: TypingAnimationProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [charIndex, setCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [started, setStarted] = useState(false);
  const completedRef = useRef(false);

  // Initial delay
  useEffect(() => {
    const timeout = setTimeout(() => setStarted(true), initialDelay);
    return () => clearTimeout(timeout);
  }, [initialDelay]);

  useEffect(() => {
    if (!started) return;

    let timeout: ReturnType<typeof setTimeout>;

    if (isDeleting) {
      if (displayedText === '') {
        setIsDeleting(false);
        setCharIndex(0);
      } else {
        timeout = setTimeout(() => {
          setDisplayedText((prev) => prev.slice(0, -1));
        }, deletingSpeed);
      }
    } else {
      if (charIndex < text.length) {
        timeout = setTimeout(() => {
          setDisplayedText((prev) => prev + text[charIndex]);
          setCharIndex((prev) => prev + 1);
        }, typingSpeed);
      } else if (loop) {
        timeout = setTimeout(() => {
          setIsDeleting(true);
        }, pauseDuration);
      } else if (!completedRef.current) {
        completedRef.current = true;
        onComplete?.();
      }
    }

    return () => clearTimeout(timeout);
  }, [
    started,
    charIndex,
    displayedText,
    isDeleting,
    text,
    typingSpeed,
    deletingSpeed,
    loop,
    pauseDuration,
    onComplete,
  ]);

  return (
    <span className={`inline-block ${className}`}>
      {displayedText}
      {showCursor && (
        <span
          className={`ml-0.5 inline-block animate-blink ${cursorClassName}`}
          style={{
            animation: 'blink 1s step-end infinite',
          }}
        >
          {cursorCharacter}
        </span>
      )}
    </span>
  );
}
