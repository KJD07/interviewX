"""
Tiny plain-Python graph runner for multi-step AI/decision pipelines.

Instead of one long function with nested ifs, a pipeline is a graph:
  * nodes   — fn(state: dict) -> dict | None; the returned dict is merged
              into state (a partial update), None means "no change".
  * edges   — static a -> b transitions (.edge).
  * routers — fn(state) -> next node name or END, decided in code, never by
              the model (.route). A node has either an edge or a router.
  * on_error — if a node raises, jump to a fallback node instead of failing
              the whole run (the error is recorded in the trace).
A run stops at END, at a node with no outgoing transition, or after
max_steps (guards against accidental cycles). Every run returns a trace of
{node, ms, error} so callers can log/expose which path was taken.
"""

import logging
import time

logger = logging.getLogger(__name__)

END = "__end__"


class GraphError(RuntimeError):
    pass


class Graph:
    def __init__(self, name: str, max_steps: int = 25):
        self.name = name
        self.max_steps = max_steps
        self._nodes: dict = {}
        self._next: dict = {}  # node -> node name (str) or router callable
        self._fallback: dict = {}
        self._start = None

    def node(self, name: str, fn):
        if name in self._nodes or name == END:
            raise GraphError(f"{self.name}: duplicate or reserved node name {name!r}")
        self._nodes[name] = fn
        if self._start is None:
            self._start = name  # first node added is the entry point
        return self

    def edge(self, a: str, b: str):
        self._set_next(a, b)
        return self

    def route(self, a: str, router):
        self._set_next(a, router)
        return self

    def on_error(self, a: str, fallback: str):
        self._fallback[a] = fallback
        return self

    def _set_next(self, a, nxt):
        if a in self._next:
            raise GraphError(f"{self.name}: node {a!r} already has an outgoing transition")
        self._next[a] = nxt

    def _resolve(self, current: str, state: dict):
        nxt = self._next.get(current, END)
        if callable(nxt):
            nxt = nxt(state)
        if nxt != END and nxt not in self._nodes:
            raise GraphError(f"{self.name}: {current!r} routed to unknown node {nxt!r}")
        return nxt

    def run(self, state: dict | None = None, start: str | None = None):
        """Returns (state, trace). Exceptions propagate unless the failing node
        has an on_error fallback."""
        state = dict(state or {})
        trace = []
        current = start or self._start
        while current not in (END, None):
            if len(trace) >= self.max_steps:
                raise GraphError(f"{self.name}: exceeded max_steps={self.max_steps}")
            t0 = time.perf_counter()
            try:
                update = self._nodes[current](state)
                error = None
            except Exception as exc:
                if current not in self._fallback:
                    trace.append({"node": current, "ms": _ms(t0), "error": type(exc).__name__})
                    raise
                update, error = None, type(exc).__name__
                logger.warning("%s: node %s failed (%s), falling back", self.name, current, error)
            if update:
                state.update(update)
            trace.append({"node": current, "ms": _ms(t0), "error": error})
            current = self._fallback[current] if error else self._resolve(current, state)
        logger.debug("%s path: %s", self.name, " -> ".join(t["node"] for t in trace))
        return state, trace


def path(trace) -> list[str]:
    return [t["node"] for t in trace]


def _ms(t0) -> float:
    return round((time.perf_counter() - t0) * 1000, 2)
