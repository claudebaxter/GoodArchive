"use client";

import React from "react";
import { useFormStatus } from "react-dom";

export default function ActionButton({
  children,
  pendingText,
}: {
  children: React.ReactNode;
  pendingText: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}>
      {pending ? pendingText : children}
    </button>
  );
}

