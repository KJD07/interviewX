import { Button } from "./Button";
import { Card } from "./Card";
import type { ReactNode } from "react";

export function EmptyState({
  title,
  body,
  action,
  icon,
}: {
  title: string;
  body?: string;
  action?: { label: string; onClick: () => void };
  icon?: ReactNode;
}) {
  return (
    <Card pad="lg" className="text-center py-10">
      {icon && <div className="mb-3 flex justify-center text-ink-faint">{icon}</div>}
      <p className="text-sm font-medium text-ink">{title}</p>
      {body && <p className="mt-1 text-sm text-ink-dim">{body}</p>}
      {action && (
        <Button variant="primary" size="sm" className="mt-5" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </Card>
  );
}
