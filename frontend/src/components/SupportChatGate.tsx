"use client";

import { usePathname } from "next/navigation";
import { isLiveInterviewPath } from "@/lib/supportChatPaths";
import SupportChatWidget from "@/components/SupportChatWidget";

/** Site-wide help chat — hidden during an active mock interview session. */
export default function SupportChatGate() {
  const pathname = usePathname() ?? "";
  if (isLiveInterviewPath(pathname)) {
    return null;
  }
  return <SupportChatWidget />;
}
